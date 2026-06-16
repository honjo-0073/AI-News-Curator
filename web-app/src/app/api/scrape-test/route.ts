import { NextRequest, NextResponse } from 'next/server';
import { fetchRss, fetchHtml, fetchSpa, scrapeArticlesWithGemini } from '@/lib/curator';

export async function POST(req: NextRequest) {
  try {
    const { url, type, geminiApiKey, promptScrape } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URLを入力してください。' }, { status: 400 });
    }
    if (!type || !['RSS', 'HTML', 'SPA'].includes(type)) {
      return NextResponse.json({ error: '正しいタイプ（RSS / HTML / SPA）を選択してください。' }, { status: 400 });
    }

    let rawContent = '';
    let articles: Array<{ title: string; url: string }> = [];

    // --- 1. スクレイピングの試行とエラー診断 ---
    try {
      if (type === 'RSS') {
        const rssArticles = await fetchRss(url);
        if (rssArticles.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'RSSフィードが空、または認識できない形式です。他の形式を試すか、URLを確認してください。'
          });
        }
        articles = rssArticles;
      } else if (type === 'HTML') {
        rawContent = await fetchHtml(url);
        
        // 簡易チェック: SPA（クライアントサイドレンダリング）の疑いがあるか
        if (rawContent.length < 500 || (!rawContent.includes('<article') && !rawContent.includes('<a') && !rawContent.includes('href'))) {
          return NextResponse.json({
            success: false,
            error: 'HTML内に記事情報がほぼ見当たりません。SPA（動的JSサイト）の可能性があります。タイプを「SPA」に変更して再試行してください。'
          });
        }
      } else if (type === 'SPA') {
        rawContent = await fetchSpa(url);
      }
    } catch (scrapingError: any) {
      console.error('Test Scrape Connection Error:', scrapingError);
      
      const errorMsg = scrapingError.message || '';
      let friendlyError = '接続に失敗しました。URLが正しいかご確認ください。';

      if (errorMsg.includes('403')) {
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
    if (type === 'HTML' || type === 'SPA') {
      if (!geminiApiKey) {
        return NextResponse.json({
          success: true,
          previewOnly: true,
          message: 'スクレイピングに成功しました（HTMLデータを取得済）。Gemini APIキーを設定すると、記事タイトル・URLのAI抽出テストも実行できます。'
        });
      }

      const defaultPrompt = 'あなたは有能なデータ抽出アシスタントです。提供されるHTMLから、主要なニュース記事のタイトルとURLを抽出し、JSONの配列形式`[{"title": "...", "url": "..."}]`で出力してください。';
      const prompt = promptScrape || defaultPrompt;

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
      articles,
      count: articles.length
    });

  } catch (globalError: any) {
    console.error('Global Scrape Test Error:', globalError);
    return NextResponse.json({ error: 'サーバー内で予期せぬエラーが発生しました。' }, { status: 500 });
  }
}
