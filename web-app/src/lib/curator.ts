import { GoogleGenAI } from '@google/generative-ai';
import { XMLParser } from 'fast-xml-parser';

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
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
  }
  return await response.text();
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
  systemPrompt: string
): Promise<Array<{ title: string; url: string }>> {
  const ai = new GoogleGenAI({ apiKey });
  // 高速な最新Flashモデルを使用
  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    }
  });

  // HTMLが大きすぎる場合の制限 (最大30,000文字)
  const content = htmlContent.substring(0, 30000);
  const prompt = `以下のHTML/Markdownから最新記事のタイトルとURLを抽出してください。\n\n${content}`;

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
  const ai = new GoogleGenAI({ apiKey });
  const model = ai.getGenerativeModel({
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
