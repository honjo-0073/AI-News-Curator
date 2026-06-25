import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { markWeeklyTriggerRun, shouldRunWeeklyTrigger } from '@/lib/scheduler';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    // --- 1. セキュリティ検証（Cron Secretのチェック） ---
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const manualUserId = searchParams.get('userId'); // 手動送信用のユーザーID

    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && (
      authHeader === `Bearer ${cronSecret}` || token === cronSecret
    );

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
      // 全ユーザーをスキャン
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('user_settings')
        .select('user_id, send_trigger_settings');

      if (settingsError) throw settingsError;
      const scheduledSettings = settings.filter(setting => shouldRunWeeklyTrigger(setting.send_trigger_settings));
      skippedBySchedule = settings.length - scheduledSettings.length;
      usersToProcess = scheduledSettings.map(setting => setting.user_id);
    }

    let summaryStats = {
      processedUsers: 0,
      sentEmails: 0,
      sentArticlesCount: 0,
      approvedArticlesCount: 0,
      activeRecipientsCount: 0,
      skippedMissingSmtp: 0,
      skippedNoApprovedArticles: 0,
      skippedNoActiveRecipients: 0,
      skippedBySchedule,
      errors: 0
    };

    const markSendTriggerExecuted = async (userId: string, currentSettings: any) => {
      if (manualUserId) return;
      await supabaseAdmin
        .from('user_settings')
        .update({
          send_trigger_settings: markWeeklyTriggerRun(currentSettings),
          updated_at: new Date()
        })
        .eq('user_id', userId);
    };

    for (const userId of usersToProcess) {
      // ユーザー設定の取得 (APIキーやSMTP設定)
      const { data: userSetting, error: settingError } = await supabaseAdmin
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settingError || !userSetting?.smtp_settings) {
        console.error(`Skipping user ${userId} due to missing SMTP settings.`);
        summaryStats.skippedMissingSmtp++;
        continue;
      }

      // 承認済み ＆ セキュリティリスクなし ＆ 未送信 の記事を取得
      const { data: approvedArticles, error: articlesError } = await supabaseAdmin
        .from('articles')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .eq('security_flag', false)
        .order('fetched_at', { ascending: false });

      if (articlesError) {
        console.error(`Failed to fetch approved articles for user ${userId}:`, articlesError);
        summaryStats.errors++;
        continue;
      }

      summaryStats.approvedArticlesCount += approvedArticles.length;

      if (approvedArticles.length === 0) {
        console.log(`No approved articles to send for user ${userId}.`);
        summaryStats.skippedNoApprovedArticles++;
        await markSendTriggerExecuted(userId, userSetting.send_trigger_settings);
        continue;
      }

      // 配信先リスト（アクティブのみ）の取得
      const { data: recipients, error: recipientsError } = await supabaseAdmin
        .from('recipients')
        .select('email')
        .eq('user_id', userId)
        .eq('active', true);

      if (recipientsError) {
        console.error(`Failed to fetch recipients for user ${userId}:`, recipientsError);
        summaryStats.errors++;
        continue;
      }

      const bccList = recipients.map(r => r.email).filter(Boolean);
      summaryStats.activeRecipientsCount += bccList.length;

      if (bccList.length === 0) {
        console.log(`No active recipients found for user ${userId}.`);
        summaryStats.skippedNoActiveRecipients++;
        await markSendTriggerExecuted(userId, userSetting.send_trigger_settings);
        continue;
      }

      summaryStats.processedUsers++;

      // SMTPトランスポーターの作成
      // smtp_settings は { host, port, secure, auth: { user, pass }, from } 形式を想定
      const smtp = userSetting.smtp_settings as any;
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure, // true for 465, false for other ports
        auth: {
          user: smtp.auth?.user,
          pass: smtp.auth?.pass,
        },
      });

      // メール本文のHTMLの構築
      const subject = userSetting.email_subject || '【AIニュースレター】最新の技術・業界動向をお届けします';
      
      let htmlBody = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
          <h2 style="color: #1a0dab; border-bottom: 2px solid #1a0dab; padding-bottom: 10px;">AI自動生成 ニュースレター</h2>
          <p style="color: #666; font-size: 0.9em; margin-bottom: 25px;">※本メールはAIが収集・要約し、承認されたニュースのみをお届けしています。</p>
      `;

      approvedArticles.forEach(article => {
        htmlBody += `
          <div style="margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px;">
            <h3 style="margin-bottom: 8px;">
              <a href="${article.url}" style="color: #1a0dab; text-decoration: none; font-size: 1.15em;">${article.title}</a>
              <span style="font-size: 0.75em; color: #888; font-weight: normal; margin-left: 8px;">(${article.source_name})</span>
            </h3>
            <p style="margin: 0; color: #444; font-size: 0.95em;">${article.summary}</p>
          </div>
        `;
      });

      htmlBody += `
          <div style="margin-top: 40px; text-align: center; font-size: 0.8em; color: #888; border-top: 1px solid #ddd; padding-top: 20px;">
            <p>配信元: AI自動キュレーションシステム</p>
          </div>
        </div>
      `;

      // メール送信処理 (BCCで一斉送信)
      try {
        await transporter.sendMail({
          from: smtp.from || smtp.auth?.user || 'noreply@curator.app',
          to: smtp.from || smtp.auth?.user, // 送信元をToに設定
          bcc: bccList.join(','),
          subject: subject,
          html: htmlBody,
        });

        // 配信済みフラグ (status -> sent) の更新
        const articleIds = approvedArticles.map(a => a.id);
        const { error: updateError } = await supabaseAdmin
          .from('articles')
          .update({ status: 'sent' })
          .in('id', articleIds);

        if (updateError) {
          console.error(`Failed to update article status to sent for user ${userId}:`, updateError);
        }

        await markSendTriggerExecuted(userId, userSetting.send_trigger_settings);

        summaryStats.sentEmails++;
        summaryStats.sentArticlesCount += approvedArticles.length;

      } catch (emailError) {
        console.error(`SMTP transmission failed for user ${userId}:`, emailError);
        summaryStats.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Newsletter distribution completed.',
      stats: summaryStats
    });

  } catch (err: any) {
    console.error('Newsletter distribution global error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
