'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { Settings, Save, Key, Mail, Cpu, Eye, EyeOff, Info } from 'lucide-react';

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
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* APIキー設定 */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} className="gradient-text" /> AI (Gemini) 設定
          </h3>
          
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

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '6px', fontSize: '0.8em', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              Gmailを使用する場合は、事前にGoogleアカウントの設定で二段階認証を有効化し、<strong>「アプリパスワード」</strong>を生成してそのパスワードを入力する必要があります。通常のログインパスワードでは接続できません。
            </div>
          </div>
        </div>

        {/* ニュースレター設定 */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} className="gradient-text" /> キュレーション ＆ プロンプト設定
          </h3>

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
