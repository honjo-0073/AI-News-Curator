import { GoogleGenerativeAI } from '@google/generative-ai';
import { XMLParser } from 'fast-xml-parser';

export type FetchDiagnostic = {
  stage: string;
  level: 'info' | 'warning' | 'error';
  message: string;
};

export type ArticleCandidate = {
  title: string;
  url: string;
  context?: string;
};

export type HtmlFetchResult = {
  html: string;
  finalUrl: string;
  status: number;
  contentType: string;
  charset: string;
  blocked: boolean;
  blockReason?: string;
  diagnostics: FetchDiagnostic[];
};

const HTML_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
};

const stripTags = (value: string) =>
  value.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const decodeHtmlEntities = (value: string) =>
  value.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

const normalizeCharset = (charset: string) => {
  const normalized = charset.trim().toLowerCase().replace(/^["']|["']$/g, '');
  if (['shift_jis', 'shift-jis', 'sjis', 'x-sjis', 'windows-31j', 'cp932'].includes(normalized)) return 'shift_jis';
  if (['euc-jp', 'euc_jp'].includes(normalized)) return 'euc-jp';
  if (['iso-2022-jp', 'jis'].includes(normalized)) return 'iso-2022-jp';
  if (['utf8', 'utf-8'].includes(normalized)) return 'utf-8';
  return normalized || 'utf-8';
};

const detectCharset = (contentType: string, headText: string) => {
  const headerMatch = contentType.match(/charset=([^;]+)/i);
  if (headerMatch?.[1]) return normalizeCharset(headerMatch[1]);

  const metaCharset = headText.match(/<meta[^>]+charset=["']?\s*([^"'\s/>]+)/i)?.[1];
  if (metaCharset) return normalizeCharset(metaCharset);

  const httpEquiv = headText.match(/<meta[^>]+http-equiv=["']?content-type["']?[^>]+content=["'][^"']*charset=([^"';\s/>]+)/i)?.[1];
  if (httpEquiv) return normalizeCharset(httpEquiv);

  return 'utf-8';
};

const decodeBuffer = (buffer: ArrayBuffer, charset: string, diagnostics: FetchDiagnostic[]) => {
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    diagnostics.push({
      stage: 'charset',
      level: 'warning',
      message: `文字コード ${charset} のデコードに失敗したため UTF-8 として処理しました。`,
    });
    return new TextDecoder('utf-8').decode(buffer);
  }
};

const resolveUrl = (baseUrl: string, href: string) => {
  try {
    return new URL(decodeHtmlEntities(href), baseUrl).toString();
  } catch {
    return '';
  }
};

const getAttribute = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
    || tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, 'i'));
  return match?.[1] || '';
};

const detectBlockPage = (html: string, status: number) => {
  const lower = html.toLowerCase();
  const patterns: Array<{ reason: string; tokens: string[] }> = [
    { reason: 'captcha', tokens: ['captcha', 'recaptcha', 'hcaptcha'] },
    { reason: 'js_challenge', tokens: ['please enable javascript', 'checking your browser', 'cf-chl', 'cloudflare'] },
    { reason: 'access_denied', tokens: ['access denied', 'forbidden', 'request blocked', 'not authorized'] },
    { reason: 'login_required', tokens: ['login', 'sign in', 'ログイン'] },
    { reason: 'cookie_wall', tokens: ['cookie consent', 'accept cookies', '同意'] },
  ];

  if (status === 401 || status === 403) {
    return { blocked: true, reason: `http_${status}` };
  }

  for (const pattern of patterns) {
    if (pattern.tokens.some(token => lower.includes(token))) {
      return { blocked: true, reason: pattern.reason };
    }
  }

  return { blocked: false };
};

export function findFeedUrls(pageUrl: string, html: string) {
  const feedUrls: string[] = [];
  const linkTagRegex = /<link\s+[^>]*>/gi;

  let match = linkTagRegex.exec(html);
  while (match) {
    const tag = match[0];
    const rel = getAttribute(tag, 'rel').toLowerCase();
    const type = getAttribute(tag, 'type').toLowerCase();
    const href = getAttribute(tag, 'href');
    if (href && (rel.includes('alternate') || type.includes('rss') || type.includes('atom') || type.includes('xml'))) {
      const resolved = resolveUrl(pageUrl, href);
      if (resolved && (type.includes('rss') || type.includes('atom') || resolved.match(/(rss|atom|feed|xml)/i))) {
        feedUrls.push(resolved);
      }
    }
    match = linkTagRegex.exec(html);
  }

  const base = new URL(pageUrl);
  ['/feed', '/rss', '/rss.xml', '/atom.xml', '/index.xml'].forEach(path => {
    feedUrls.push(new URL(path, base.origin).toString());
  });

  return Array.from(new Set(feedUrls)).slice(0, 10);
}

export const hasArticleLikeHtml = (html: string) => {
  const candidates = extractArticleCandidates('', html, 10);
  return html.length >= 500 && (candidates.length > 0 || html.includes('<article') || html.includes('href'));
};

export function extractArticleCandidates(baseUrl: string, html: string, limit = 80): ArticleCandidate[] {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const candidates: ArticleCandidate[] = [];
  const seen = new Set<string>();
  let match = anchorRegex.exec(withoutNoise);

  while (match) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const href = getAttribute(attrs, 'href');
    const title = decodeHtmlEntities(stripTags(body));
    const url = baseUrl ? resolveUrl(baseUrl, href) : href;
    const lowerUrl = url.toLowerCase();
    const lowerTitle = title.toLowerCase();

    const looksArticlePath = /\/(20\d{2}|19\d{2}|news|article|posts?|entry|archives?|press|release|story|topics?)[/-]/i.test(url);
    const hasUsefulTitle = title.length >= 8 && !['more', 'read more', '詳しく', '続きを読む', '次へ', '前へ'].includes(lowerTitle);
    const isSkippable = !url
      || seen.has(url)
      || href.startsWith('#')
      || href.startsWith('mailto:')
      || href.startsWith('tel:')
      || lowerUrl.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip)(\?|#|$)/);

    if (!isSkippable && hasUsefulTitle && (looksArticlePath || title.length >= 14)) {
      seen.add(url);
      candidates.push({ title, url, context: attrs.replace(/\s+/g, ' ').trim().substring(0, 180) });
    }
    match = anchorRegex.exec(withoutNoise);
  }

  return candidates.slice(0, limit);
}

export function extractReadableText(html: string, maxLength = 5000) {
  const mainContent = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    || html;

  return stripTags(mainContent).substring(0, maxLength);
}

export async function fetchArticleContent(url: string): Promise<string> {
  const htmlResult = await fetchHtmlAdvanced(url);
  if (htmlResult.blocked) return '';
  return extractReadableText(htmlResult.html, 5000);
}

export async function fetchHtmlAdvanced(url: string): Promise<HtmlFetchResult> {
  const diagnostics: FetchDiagnostic[] = [];
  const response = await fetch(url, {
    headers: HTML_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || '';
  const headText = new TextDecoder('utf-8').decode(buffer.slice(0, Math.min(buffer.byteLength, 4096)));
  const charset = detectCharset(contentType, headText);
  const html = decodeBuffer(buffer, charset, diagnostics);
  const block = detectBlockPage(html, response.status);

  diagnostics.push({
    stage: 'fetch',
    level: response.ok ? 'info' : 'error',
    message: `HTTP ${response.status} ${response.statusText || ''}`.trim(),
  });
  diagnostics.push({
    stage: 'charset',
    level: 'info',
    message: `${charset} としてHTMLをデコードしました。`,
  });
  if (block.blocked) {
    diagnostics.push({
      stage: 'block-detection',
      level: 'warning',
      message: `ブロックページの可能性があります: ${block.reason}`,
    });
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
  }

  return {
    html,
    finalUrl: response.url || url,
    status: response.status,
    contentType,
    charset,
    blocked: block.blocked,
    blockReason: block.reason,
    diagnostics,
  };
}

// RSS/Atom フィードの取得・パース
export async function fetchRss(url: string): Promise<Array<{ title: string; url: string; content?: string }>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
  }
  const xmlText = await response.text();
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const jsonObj = parser.parse(xmlText);
  
  let items: any[] = [];
  
  // RSS 2.0
  if (jsonObj.rss?.channel?.item) {
    items = Array.isArray(jsonObj.rss.channel.item) 
      ? jsonObj.rss.channel.item 
      : [jsonObj.rss.channel.item];
  } 
  // Atom
  else if (jsonObj.feed?.entry) {
    items = Array.isArray(jsonObj.feed.entry) 
      ? jsonObj.feed.entry 
      : [jsonObj.feed.entry];
  }
  
  return items.map((item: any) => {
    let title = item.title || '';
    if (typeof title === 'object') title = title['#text'] || '';
    
    let link = '';
    if (item.link) {
      if (typeof item.link === 'string') {
        link = item.link;
      } else if (Array.isArray(item.link)) {
        // Atomで複数のlink要素がある場合、通常はrel="alternate"を探す
        const altLink = item.link.find((l: any) => l.rel === 'alternate' || !l.rel);
        link = altLink?.href || item.link[0]?.href || '';
      } else if (item.link.href) {
        link = item.link.href;
      }
    }
    
    const description = item.description || item.summary || item.content || '';
    const descText = typeof description === 'object' ? description['#text'] || '' : description;
    
    return {
      title: String(title).trim(),
      url: String(link).trim(),
      content: String(descText).replace(/<[^>]*>?/gm, '').substring(0, 1000), // タグ削除して一部制限
    };
  }).slice(0, 5); // 最新5件
}

// 静的HTMLの取得
export async function fetchHtml(url: string): Promise<string> {
  return (await fetchHtmlAdvanced(url)).html;
}

// SPA (動的JS) の取得 (Jina Reader APIを利用してMarkdown変換)
export async function fetchSpa(url: string): Promise<string> {
  // Jina Reader API を使用して、SPAをレンダリングした結果を取得
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
  const response = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/plain',
    },
    signal: AbortSignal.timeout(15000) // SPAは少し長めにタイムアウトを設定
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch SPA content via Jina: ${response.status} ${response.statusText}`);
  }
  
  return await response.text();
}

// Gemini を使用してHTML/Markdownから記事タイトルとURLを抽出
export async function scrapeArticlesWithGemini(
  apiKey: string,
  htmlContent: string,
  systemPrompt: string,
  baseUrl?: string
): Promise<Array<{ title: string; url: string }>> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // 高速な最新Flashモデルを使用
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    }
  });

  const candidates = baseUrl ? extractArticleCandidates(baseUrl, htmlContent, 80) : [];
  const content = candidates.length > 0
    ? JSON.stringify(candidates, null, 2).substring(0, 30000)
    : htmlContent.substring(0, 30000);
  const prompt = candidates.length > 0
    ? `以下の記事候補リンク一覧から、ニュース記事として重要な最新記事のタイトルとURLを最大5件抽出してください。\n\n${content}`
    : `以下のHTML/Markdownから最新記事のタイトルとURLを抽出してください。\n\n${content}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    const json = JSON.parse(responseText);
    if (Array.isArray(json)) {
      return json.map((item: any) => ({
        title: String(item.title || '').trim(),
        url: String(item.url || '').trim()
      })).filter(item => item.title && item.url);
    }
    return [];
  } catch (e) {
    console.error('Failed to parse Gemini scrape output:', responseText);
    throw new Error('Gemini APIが正しいJSON形式のリストを返しませんでした。');
  }
}

// 記事詳細の要約とセキュリティ検閲
export async function summarizeAndCheckSecurity(
  apiKey: string,
  articleContent: string,
  systemPrompt: string
): Promise<{ summary: string; securityRisk: boolean }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    }
  });

  const prompt = `以下の記事内容を要約し、検閲結果を返してください。\n\n${articleContent}`;
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    const json = JSON.parse(responseText);
    return {
      summary: String(json.summary || '').trim(),
      securityRisk: !!json.securityRisk
    };
  } catch (e) {
    console.error('Failed to parse Gemini review output:', responseText);
    throw new Error('Gemini APIが正しい要約JSONフォーマットを返しませんでした。');
  }
}
