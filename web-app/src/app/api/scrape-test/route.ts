import { NextRequest, NextResponse } from 'next/server';
import { fetchRss, fetchHtml, fetchSpa, scrapeArticlesWithGemini } from '@/lib/curator';

type SourceType = 'AUTO' | 'RSS' | 'HTML' | 'SPA';

const defaultPrompt = 'あなたは有能なデータ抽出アシスタントです。提供されるHTMLから、主要なニュース記事のタイトルとURLを抽出し、JSONの配列形式`[{"title": "...", "url": "..."}]`で出力してください。';

const resolveUrl = (baseUrl: string, href: string) => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
};

const findFeedUrls = (pageUrl: string, html: string) => {
  const feedUrls: string[] = [];
  const linkTagRegex = /<link\s+[^>]*>/gi;
  const hrefRegex = /href=["']([^"']+)["']/i;
  const typeRegex = /type=["']([^"']+)["']/i;

  let match = linkTagRegex.exec(html);
  while (match) {
    const tag = match[0];
    const type = tag.match(typeRegex)?.[1]?.toLowerCase() || '';
    const href = tag.match(hrefRegex)?.[1] || '';
    if (href && (type.includes('rss') || type.includes('atom') || type.includes('xml'))) {
      const resolved = resolveUrl(pageUrl, href);
      if (resolved) feedUrls.push(resolved);
    }
    match = linkTagRegex.exec(html);
  }

  return Array.from(new Set(feedUrls));
};

const hasArticleLikeHtml = (html: string) =>
  html.length >= 500 && (html.includes('<article') || html.includes('<a') || html.includes('href'));

export async function POST(req: NextRequest) {
  try {
    const { url, type = 'AUTO', geminiApiKey, promptScrape } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URLを入力してください。' }, { status: 400 });
    }
    if (!type || !['AUTO', 'RSS', 'HTML', 'SPA'].includes(type)) {
      return NextResponse.json({ error: '正しいタイプ（自動 / RSS / HTML / SPA）を選択してください。' }, { status: 400 });
    }

    const selectedType = type as SourceType;
    const prompt = promptScrape || defaultPrompt;
    let rawContent = '';
    let articles: Array<{ title: string; url: string }> = [];
    let recommendedType: 'RSS' | 'HTML' | 'SPA' | null = null;
    let recommendedUrl = url;
    let message = '';

    // --- 1. 自動判定または指定タイプでのスクレイピング試行 ---
    try {
      if (selectedType === 'AUTO') {
        try {
          const rssArticles = await fetchRss(url);
          if (rssArticles.length > 0) {
            return NextResponse.json({
              success: true,
              recommendedType: 'RSS',
              recommendedUrl: url,
              message: '入力URLはRSS/Atomフィードとして取得できました。RSS方式で登録するのがおすすめです。',
              articles: rssArticles,
              count: rssArticles.length
            });
          }
        } catch {
          // 入力URLがRSSでない場合はHTML判定へ進む
        }

        rawContent = await fetchHtml(url);
        const feedUrls = findFeedUrls(url, rawContent);
        for (const feedUrl of feedUrls) {
          try {
            const rssArticles = await fetchRss(feedUrl);
            if (rssArticles.length > 0) {
              return NextResponse.json({
                success: true,
                recommendedType: 'RSS',
                recommendedUrl: feedUrl,
                message: 'ページ内にRSS/Atomフィードを見つけました。安定運用のためRSS方式で登録します。',
                articles: rssArticles,
                count: rssArticles.length
              });
            }
          } catch {
            // 壊れているfeed候補は無視して次を試す
          }
        }

        if (hasArticleLikeHtml(rawContent)) {
          recommendedType = 'HTML';
          message = 'RSSは見つかりませんでしたが、静的HTMLから記事リンクを抽出できそうです。HTML方式で登録します。';
        } else {
          recommendedType = 'SPA';
          recommendedUrl = url;
          rawContent = await fetchSpa(url);
          message = '静的HTMLに記事情報が少ないため、SPA方式で登録します。';
        }
      } else if (selectedType === 'RSS') {
        const rssArticles = await fetchRss(url);
        if (rssArticles.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'RSSフィードが空、または認識できない形式です。他の形式を試すか、URLを確認してください。'
          });
        }
        articles = rssArticles;
        recommendedType = 'RSS';
      } else if (selectedType === 'HTML') {
        rawContent = await fetchHtml(url);
        recommendedType = 'HTML';
        
        // 簡易チェック: SPA（クライアントサイドレンダリング）の疑いがあるか
        if (!hasArticleLikeHtml(rawContent)) {
          return NextResponse.json({
            success: false,
            error: 'HTML内に記事情報がほぼ見当たりません。SPA（動的JSサイト）の可能性があります。タイプを「SPA」に変更して再試行してください。'
          });
        }
      } else if (selectedType === 'SPA') {
        rawContent = await fetchSpa(url);
        recommendedType = 'SPA';
      }
    } catch (scrapingError: any) {
      console.error('Test Scrape Connection Error:', scrapingError);
      
      const errorMsg = getErrorText(scrapingError);
      let friendlyError = '接続に失敗しました。URLが正しいかご確認ください。';

      if (errorMsg.includes('ERR_TLS_CERT_ALTNAME_INVALID') || errorMsg.includes('altnames') || errorMsg.includes('certificate')) {
        friendlyError = 'サイトのSSL証明書がURLのドメインと一致していません。サイト側のSSL設定不備が原因です。サイト管理者に証明書設定を確認してもらうか、確認用に http:// から始まるURLで再試行してください。';
      } else if (errorMsg.includes('403')) {
        friendlyError = 'アクセスが拒否されました (403 Forbidden)。サイト側でスクレイピング対策が導入されている可能性があります。RSSフィードが公開されていないかお調べください。';
      } else if (errorMsg.includes('404')) {
        friendlyError = 'ページが見つかりません (404 Not Found)。URLのスペルミスがないかご確認ください。';
      } else if (errorMsg.includes('timeout')) {
        friendlyError = '接続タイムアウトです。サイトの応答が遅すぎるか、アクセスが制限されています。';
      } else if (errorMsg.includes('Jina')) {
        friendlyError = 'SPAレンダリングプロキシ(Jina)でのデータ取得に失敗しました。時間をおいて試すか、静的HTMLとして試してください。';
      }

      return NextResponse.json({ success: false, error: friendlyError });
    }

    // --- 2. HTML / SPA の場合は Gemini による記事抽出のテスト ---
    if ((recommendedType === 'HTML' || recommendedType === 'SPA') && articles.length === 0) {
      if (!geminiApiKey) {
        return NextResponse.json({
          success: true,
          previewOnly: true,
          recommendedType,
          recommendedUrl,
          message: message || 'スクレイピングに成功しました。Gemini APIキーを設定すると、記事タイトル・URLのAI抽出テストも実行できます。'
        });
      }

      try {
        articles = await scrapeArticlesWithGemini(geminiApiKey, rawContent, prompt);
        if (articles.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Geminiによる解析は完了しましたが、記事のリストを1件も抽出できませんでした。プロンプト（抽出指示）の調整が必要な可能性があります。'
          });
        }
      } catch (geminiError: any) {
        console.error('Test Scrape Gemini Error:', geminiError);
        return NextResponse.json({
          success: false,
          error: `Gemini API呼び出しでエラーが発生しました: ${geminiError.message || 'APIキーが無効である可能性があります。'}`
        });
      }
    }

    return NextResponse.json({
      success: true,
      recommendedType,
      recommendedUrl,
      message,
      articles,
      count: articles.length
    });

  } catch (globalError: any) {
    console.error('Global Scrape Test Error:', globalError);
    return NextResponse.json({ error: 'サーバー内で予期せぬエラーが発生しました。' }, { status: 500 });
  }
}
