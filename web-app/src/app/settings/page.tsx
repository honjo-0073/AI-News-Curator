'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { Settings, Save, Key, Mail, Cpu, Eye, EyeOff, Info, Calendar } from 'lucide-react';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // フォーム用ステート
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [promptScrape, setPromptScrape] = useState('');
  const [promptReview, setPromptReview] = useState('');

  // SMTP設定
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // 自動実行設定（曜日は 0=日曜, 1=月曜 ... 6=土曜）
  const [fetchTriggerEnabled, setFetchTriggerEnabled] = useState(false);
  const [fetchDaysOfWeek, setFetchDaysOfWeek] = useState<number[]>([]);
  const [fetchLastRunDate, setFetchLastRunDate] = useState<string | null>(null);
  const [sendTriggerEnabled, setSendTriggerEnabled] = useState(false);
  const [sendDaysOfWeek, setSendDaysOfWeek] = useState<number[]>([]);
  const [sendLastRunDate, setSendLastRunDate] = useState<string | null>(null);

  const weekDays = [
    { value: 0, label: '日' },
    { value: 1, label: '月' },
    { value: 2, label: '火' },
    { value: 3, label: '水' },
    { value: 4, label: '木' },
    { value: 5, label: '金' },
    { value: 6, label: '土' },
  ];

  const toggleDay = (days: number[], day: number) => (
    days.includes(day)
      ? days.filter(value => value !== day)
      : [...days, day].sort((a, b) => a - b)
  );

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    if (!error && data) {
      setGeminiKey(data.gemini_api_key || '');
      setEmailSubject(data.email_subject || '');
      setPromptScrape(data.prompt_scrape || '');
      setPromptReview(data.prompt_review || '');

      if (data.smtp_settings) {
        const smtp = data.smtp_settings as any;
        setSmtpHost(smtp.host || '');
        setSmtpPort(smtp.port?.toString() || '587');
        setSmtpSecure(!!smtp.secure);
        setSmtpUser(smtp.auth?.user || '');
        setSmtpPass(smtp.auth?.pass || '');
        setSmtpFrom(smtp.from || '');
      }

      const fetchTrigger = data.fetch_trigger_settings as any;
      setFetchTriggerEnabled(!!fetchTrigger?.enabled);
      setFetchDaysOfWeek(Array.isArray(fetchTrigger?.daysOfWeek) ? fetchTrigger.daysOfWeek : []);
      setFetchLastRunDate(fetchTrigger?.last_run_date || null);

      const sendTrigger = data.send_trigger_settings as any;
      setSendTriggerEnabled(!!sendTrigger?.enabled);
      setSendDaysOfWeek(Array.isArray(sendTrigger?.daysOfWeek) ? sendTrigger.daysOfWeek : []);
      setSendLastRunDate(sendTrigger?.last_run_date || null);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');

    const smtpSettings = {
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      from: smtpFrom
    };

    const { error } = await supabase
      .from('user_settings')
      .update({
        gemini_api_key: geminiKey,
        email_subject: emailSubject,
        prompt_scrape: promptScrape,
        prompt_review: promptReview,
        smtp_settings: smtpSettings,
        fetch_trigger_settings: {
          enabled: fetchTriggerEnabled,
          daysOfWeek: fetchDaysOfWeek,
          last_run_date: fetchLastRunDate
        },
        send_trigger_settings: {
          enabled: sendTriggerEnabled,
          daysOfWeek: sendDaysOfWeek,
          last_run_date: sendLastRunDate
        },
        updated_at: new Date()
      })
      .eq('user_id', user?.id);

    setSaving(false);
    if (!error) {
      setSaveMessage('設定を保存しました。');
      setTimeout(() => setSaveMessage(''), 3000);
    } else {
      alert('保存に失敗しました: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* タイトル */}
      <div>
        <h2 style={{ fontSize: '2em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings /> システム設定
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          各種APIキー、要約プロンプト、メール送信に使用するSMTPサーバーの設定を管理します。
        </p>
        <div style={{ marginTop: '16px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.22)', borderRadius: '10px', padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9em', lineHeight: '1.7' }}>
          <strong style={{ color: 'var(--text-primary)' }}>この画面で設定するもの</strong>
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            <li><strong>Gemini APIキー</strong>: 記事の抽出・要約に使います。</li>
            <li><strong>SMTP設定</strong>: ニュースレターを「送信する側」のメール設定です。受信者のメールアドレスは「配信先」画面で登録します。</li>
            <li><strong>プロンプト</strong>: AIにどのように記事を抽出・要約してほしいかの指示文です。最初は初期値のままで構いません。</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* APIキー設定 */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} className="gradient-text" /> AI (Gemini) 設定
          </h3>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '6px', fontSize: '0.85em', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
            Gemini APIキーは、登録したサイトから記事候補を抽出したり、記事本文を要約したりするために使います。
            RSSだけで運用する場合も、記事要約にはGemini APIキーが必要です。
          </div>
          
          <div>
            <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Gemini API キー
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showGeminiKey ? 'text' : 'password'} 
                className="form-input" 
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                style={{ paddingRight: '45px' }}
              />
              <button 
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75em', marginTop: '6px' }}>
              ※Google AI Studio で取得したAPIキーをご入力ください。料金は各自のアカウントに請求されます。
            </p>
          </div>
        </div>

        {/* SMTP設定 */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} className="gradient-text" /> メール配信 (SMTP) 設定
          </h3>

          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.22)', padding: '14px', borderRadius: '8px', fontSize: '0.86em', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '18px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>SMTPは「ニュースレターを送るための差出人設定」です。</strong>
            <div style={{ marginTop: '6px' }}>
              配信先のメールアドレスを登録するだけでは、アプリはメールを送れません。
              Gmail / Outlook / 独自ドメインなど、送信に使うメールアカウントのSMTP情報を入力してください。
            </div>
            <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
              <li><strong>587</strong> を使う場合: SSL/TLS接続のチェックは通常OFF</li>
              <li><strong>465</strong> を使う場合: SSL/TLS接続のチェックはON</li>
              <li>GmailやYahooでは、通常のログインパスワードではなく <strong>アプリパスワード</strong> が必要です。</li>
              <li>まずは配信先に自分のメールを登録し、「テスト送信」で確認してください。</li>
            </ul>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                SMTP ホスト名
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="例: smtp.gmail.com"
                value={smtpHost}
                onChange={e => setSmtpHost(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                ポート番号
              </label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="例: 587 または 465"
                value={smtpPort}
                onChange={e => setSmtpPort(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                ユーザー名 / メールアドレス
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="例: name@gmail.com"
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                パスワード / アプリパスワード
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showSmtpPass ? 'text' : 'password'} 
                  className="form-input" 
                  value={smtpPass}
                  onChange={e => setSmtpPass(e.target.value)}
                  style={{ paddingRight: '45px' }}
                />
                <button 
                  type="button"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                  style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showSmtpPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                送信元 (From) アドレス
              </label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="例: noreply@example.com"
                value={smtpFrom}
                onChange={e => setSmtpFrom(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', marginTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  checked={smtpSecure}
                  onChange={e => setSmtpSecure(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '0.9em' }}>SSL/TLS接続 (Port 465等)</span>
              </label>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '6px', fontSize: '0.8em', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-secondary)' }}>よく使う設定例:</strong>
              <div style={{ marginTop: '6px' }}>Gmail: smtp.gmail.com / 587 / SSLチェックOFF、または 465 / SSLチェックON</div>
              <div>Outlook・Microsoft 365: smtp.office365.com / 587 / SSLチェックOFF</div>
              <div>Yahoo: smtp.mail.yahoo.com / 587 / SSLチェックOFF、または 465 / SSLチェックON</div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '6px', fontSize: '0.8em', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              Gmailを使用する場合は、事前にGoogleアカウントの設定で二段階認証を有効化し、<strong>「アプリパスワード」</strong>を生成してそのパスワードを入力する必要があります。通常のログインパスワードでは接続できません。
            </div>
          </div>
        </div>

        {/* 自動実行設定 */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} className="gradient-text" /> 自動実行設定
          </h3>
          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.22)', padding: '14px', borderRadius: '8px', fontSize: '0.86em', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '18px' }}>
            Gemini API の無料枠を考慮し、自動収集・自動配信は指定した曜日につき1回だけ実行されます。
            曜日の判定は <strong style={{ color: 'var(--text-primary)' }}>Asia/Tokyo</strong> 基準です。
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', padding: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  checked={fetchTriggerEnabled}
                  onChange={e => setFetchTriggerEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 700 }}>自動収集を有効にする</span>
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8em', lineHeight: '1.6', marginBottom: '12px' }}>
                指定した曜日に、登録済みの収集元から記事候補を収集します。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {weekDays.map(day => (
                  <label key={`fetch-${day.value}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '8px 12px', cursor: 'pointer', background: fetchDaysOfWeek.includes(day.value) ? 'rgba(59, 130, 246, 0.16)' : 'transparent' }}>
                    <input
                      type="checkbox"
                      checked={fetchDaysOfWeek.includes(day.value)}
                      onChange={() => setFetchDaysOfWeek(days => toggleDay(days, day.value))}
                    />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
              {fetchLastRunDate && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75em', marginTop: '12px' }}>
                  最終自動収集日: {fetchLastRunDate}
                </p>
              )}
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', padding: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  checked={sendTriggerEnabled}
                  onChange={e => setSendTriggerEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 700 }}>自動配信を有効にする</span>
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8em', lineHeight: '1.6', marginBottom: '12px' }}>
                指定した曜日に、承認済みかつセキュリティリスクなしの記事を配信します。配信対象が0件でもその日は実行済みになります。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {weekDays.map(day => (
                  <label key={`send-${day.value}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '8px 12px', cursor: 'pointer', background: sendDaysOfWeek.includes(day.value) ? 'rgba(59, 130, 246, 0.16)' : 'transparent' }}>
                    <input
                      type="checkbox"
                      checked={sendDaysOfWeek.includes(day.value)}
                      onChange={() => setSendDaysOfWeek(days => toggleDay(days, day.value))}
                    />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
              {sendLastRunDate && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75em', marginTop: '12px' }}>
                  最終自動配信日: {sendLastRunDate}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ニュースレター設定 */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} className="gradient-text" /> キュレーション ＆ プロンプト設定
          </h3>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '6px', fontSize: '0.85em', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
            プロンプトはAIへの指示文です。最初は初期値のまま運用し、抽出される記事や要約の品質を見ながら少しずつ調整してください。
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              メール件名
            </label>
            <input 
              type="text" 
              className="form-input" 
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              記事抽出プロンプト (HTML/SPA用)
            </label>
            <textarea 
              className="form-textarea" 
              rows={3}
              value={promptScrape}
              onChange={e => setPromptScrape(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              要約 ＆ 検閲プロンプト (共通)
            </label>
            <textarea 
              className="form-textarea" 
              rows={4}
              value={promptReview}
              onChange={e => setPromptReview(e.target.value)}
            />
          </div>
        </div>

        {/* 保存ボタン */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'flex-end' }}>
          {saveMessage && <span style={{ color: 'var(--color-success)', fontSize: '0.9em' }}>{saveMessage}</span>}
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={18} /> {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>

      </form>
    </div>
  );
}
