import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin, getSupabaseAuthClient } from '@/lib/supabase';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipientId } = await req.json();
    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId is required' }, { status: 400 });
    }

    const supabaseAuth = getSupabaseAuthClient();
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authData.user.id;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('recipients')
      .select('id, email, name')
      .eq('id', recipientId)
      .eq('user_id', userId)
      .single();

    if (recipientError || !recipient?.email) {
      return NextResponse.json({ error: '配信先が見つかりません。' }, { status: 404 });
    }

    const { data: userSetting, error: settingError } = await supabaseAdmin
      .from('user_settings')
      .select('smtp_settings')
      .eq('user_id', userId)
      .single();

    const smtp = userSetting?.smtp_settings as any;
    if (settingError || !smtp?.host || !smtp?.port || !smtp?.auth?.user || !smtp?.auth?.pass) {
      return NextResponse.json({ error: 'SMTP設定が未完了です。設定画面でSMTP情報を保存してください。' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.auth.user,
        pass: smtp.auth.pass,
      },
    });

    const recipientName = recipient.name || recipient.email;
    const safeRecipientName = escapeHtml(recipientName);

    await transporter.sendMail({
      from: smtp.from || smtp.auth.user,
      to: recipient.email,
      subject: '【AI News Curator】テストメール',
      text: `${recipientName} 様\n\nAI News Curator からのテストメールです。\nこのメールが届いていれば、SMTP設定と配信先アドレスは正常に動作しています。`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>AI News Curator テストメール</h2>
          <p>${safeRecipientName} 様</p>
          <p>これは AI News Curator からのテストメールです。</p>
          <p>このメールが届いていれば、SMTP設定と配信先アドレスは正常に動作しています。</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: `${recipient.email} へテストメールを送信しました。` });
  } catch (err: any) {
    console.error('Test email error:', err);
    return NextResponse.json({ error: err.message || 'テストメール送信に失敗しました。' }, { status: 500 });
  }
}
