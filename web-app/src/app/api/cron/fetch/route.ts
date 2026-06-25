import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchRss, fetchHtml, fetchSpa, scrapeArticlesWithGemini, summarizeAndCheckSecurity } from '@/lib/curator';
import { markWeeklyTriggerRun, shouldRunWeeklyTrigger } from '@/lib/scheduler';

// レートリミット回避用のスリープヘルパー
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    // --- 1. セキュリティ検証（Cron Secretのチェック） ---
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const manualUserId = searchParams.get('userId'); // 手動実行用のユーザーID

    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && (
      authHeader === `Bearer ${cronSecret}` || token === cronSecret
    );

    // 手動実行かつログインセッションが有効な場合はセキュアに判定（ここでは簡易的にCronSecretか手動パラメータがある場合のみ許可）
    if (!isCronAuthorized && !manualUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    
    // --- 2. 処理対象ユーザーの決定 ---
    let usersToProcess: string[] = [];
    let skippedBySchedule = 0;

    if (manualUserId) {
      usersToProcess = [manualUserId];
    } else {
      // 自動定期実行の場合：設定が登録されているすべてのアクティブなユーザーをスキャン
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('user_settings')
        .select('user_id, fetch_trigger_settings')
        .not('gemini_api_key', 'is', null);

      if (settingsError) {
        throw new Error(`Failed to fetch user settings: ${settingsError.message}`);
      }
      const scheduledSettings = settings.filter(setting => shouldRunWeeklyTrigger(setting.fetch_trigger_settings));
      skippedBySchedule = settings.length - scheduledSettings.length;
      usersToProcess = scheduledSettings.map(setting => setting.user_id);
    }

    let summaryStats = {
      processedUsers: 0,
      processedSources: 0,
      fetchedArticles: 0,
      duplicateArticles: 0,
      newArticles: 0,
      errors: 0,
      skippedUsers: 0,
      usersWithoutActiveSources: 0,
      registeredSources: 0,
      inactiveSources: 0,
      skippedBySchedule
    };

    // --- 3. ユーザーごとにキュレーション処理を実行 ---
    for (const userId of usersToProcess) {
      // ユーザー設定の取得
      const { data: userSetting, error: settingError } = await supabaseAdmin
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settingError || !userSetting?.gemini_api_key) {
        console.error(`Skipping user ${userId} due to missing Gemini API key.`);
        summaryStats.skippedUsers++;
        continue;
      }

      const apiKey = userSetting.gemini_api_key;
      const promptScrape = userSetting.prompt_scrape;
      const promptReview = userSetting.prompt_review;

      // ユーザーが登録している収集元の取得
      const { data: registeredSources, error: sourcesError } = await supabaseAdmin
        .from('sources')
        .select('*')
        .eq('user_id', userId);

      if (sourcesError) {
        console.error(`Failed to fetch sources for user ${userId}:`, sourcesError);
        summaryStats.errors++;
        continue;
      }

      summaryStats.processedUsers++;
      summaryStats.registeredSources += registeredSources?.length || 0;

      // 古いデータで active が NULL / 未設定の場合は有効扱いにして、登録済みURLが無視されないようにする
      const activeSources = (registeredSources || []).filter(source => source.active !== false);
      summaryStats.inactiveSources += (registeredSources?.length || 0) - activeSources.length;

      if (activeSources.length === 0) {
        console.warn(`No active sources found for user ${userId}. Registered sources: ${registeredSources?.length || 0}.`);
        summaryStats.usersWithoutActiveSources++;
        continue;
      }

      let successfulSourcesForUser = 0;

      for (const source of activeSources) {
        summaryStats.processedSources++;
        let fetchedArticles: Array<{ title: string; url: string; content?: string }> = [];
        let rawContent = '';

        try {
          // A. タイプ別のスクレイピング処理
          if (source.type === 'RSS') {
            fetchedArticles = await fetchRss(source.url);
          } else if (source.type === 'HTML') {
            rawContent = await fetchHtml(source.url);
            fetchedArticles = await scrapeArticlesWithGemini(apiKey, rawContent, promptScrape);
          } else if (source.type === 'SPA') {
            rawContent = await fetchSpa(source.url);
            fetchedArticles = await scrapeArticlesWithGemini(apiKey, rawContent, promptScrape);
          } else {
            throw new Error(`Unsupported source type: ${source.type || '未設定'}`);
          }

          summaryStats.fetchedArticles += fetchedArticles.length;

          // B. 取得済みの既存URLリストを取得して重複排除
          const articleUrls = fetchedArticles.map(a => a.url);
          const existingArticles = articleUrls.length > 0
            ? await supabaseAdmin
              .from('articles')
              .select('url')
              .eq('user_id', userId)
              .in('url', articleUrls)
            : { data: [], error: null };

          if (existingArticles.error) throw existingArticles.error;
          const existingUrls = new Set((existingArticles.data || []).map(a => a.url));

          const newArticles = fetchedArticles.filter(a => !existingUrls.has(a.url));
          summaryStats.duplicateArticles += fetchedArticles.length - newArticles.length;

          // C. 各新着記事の要約 ＆ セキュリティリスク判定
          for (const article of newArticles) {
            // APIレートリミット回避のためにウェイトを入れる
            await sleep(3000); 

            let articleBody = article.title + '\n\n' + (article.content || '');

            // RSS等の場合に詳細本文を追加取得する（任意）
            if (!article.content && source.type === 'RSS') {
              try {
                const html = await fetchHtml(article.url);
                articleBody += '\n\n' + html.replace(/<[^>]*>?/gm, '').substring(0, 5000);
              } catch (e) {
                // 本文取得失敗でもタイトルで進行
              }
            }

            // Geminiによる要約とセキュリティ審査
            const reviewResult = await summarizeAndCheckSecurity(apiKey, articleBody, promptReview);

            // DBに登録
            const { error: insertError } = await supabaseAdmin
              .from('articles')
              .insert({
                user_id: userId,
                source_id: source.id,
                source_name: source.name,
                title: article.title,
                url: article.url,
                summary: reviewResult.summary,
                security_flag: reviewResult.securityRisk,
                status: 'pending' // 承認待ち
              });

            if (insertError) throw insertError;
            summaryStats.newArticles++;
          }

          // 成功ログの書き込み
          await supabaseAdmin.from('execution_logs').insert({
            user_id: userId,
            source_id: source.id,
            trigger_type: manualUserId ? 'manual' : 'auto',
            status: 'success'
          });
          successfulSourcesForUser++;

        } catch (sourceError: any) {
          console.error(`Error processing source ${source.name} (${source.url}) for user ${userId}:`, sourceError);
          summaryStats.errors++;

          // エラーログの書き込み
          await supabaseAdmin.from('execution_logs').insert({
            user_id: userId,
            source_id: source.id,
            trigger_type: manualUserId ? 'manual' : 'auto',
            status: 'error',
            error_message: sourceError.message || '予期せぬエラーが発生しました。'
          });
        }
      }

      if (!manualUserId && successfulSourcesForUser > 0) {
        await supabaseAdmin
          .from('user_settings')
          .update({
            fetch_trigger_settings: markWeeklyTriggerRun(userSetting.fetch_trigger_settings),
            updated_at: new Date()
          })
          .eq('user_id', userId);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Curation batch execution completed.',
      stats: summaryStats
    });

  } catch (err: any) {
    console.error('Curation Batch Global Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
