'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { Trash2, AlertTriangle, CheckCircle, RefreshCw, Layers } from 'lucide-react';

interface Source {
  id: string;
  name: string;
  url: string;
  type: 'RSS' | 'HTML' | 'SPA';
  active: boolean;
}

export default function SourcesPage() {
  return (
    <AuthGuard>
      <SourcesContent />
    </AuthGuard>
  );
}

function SourcesContent() {
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [geminiKey, setGeminiKey] = useState('');
  const [promptScrape, setPromptScrape] = useState('');
  const [loading, setLoading] = useState(true);

  // 新規登録フォーム用
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'RSS' | 'HTML' | 'SPA'>('RSS');
  
  // テスト接続状態
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    articles?: Array<{ title: string; url: string }>;
    previewOnly?: boolean;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      loadSources();
      loadUserSettings();
    }
  }, [user]);

  // データ取得
  const loadSources = async () => {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setSources(data as Source[]);
    }
    setLoading(false);
  };

  const loadUserSettings = async () => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('gemini_api_key, prompt_scrape')
      .eq('user_id', user?.id)
      .single();
    if (!error && data) {
      setGeminiKey(data.gemini_api_key || '');
      setPromptScrape(data.prompt_scrape || '');
    }
  };

  // 新規登録
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;

    const { error } = await supabase.from('sources').insert({
      user_id: user?.id,
      name,
      url,
      type,
      active: true
    });

    if (!error) {
      setName('');
      setUrl('');
      setType('RSS');
      setTestResult(null);
      loadSources();
    } else {
      alert('登録に失敗しました: ' + error.message);
    }
  };

  // 接続テスト
  const handleTestConnection = async () => {
    if (!url) {
      alert('テストするURLを入力してください。');
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/scrape-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          type,
          geminiApiKey: geminiKey,
          promptScrape
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({
        success: false,
        error: 'テスト実行中にエラーが発生しました。ネットワーク接続をご確認ください。'
      });
    } finally {
      setTesting(false);
    }
  };

  // 削除
  const handleDeleteSource = async (id: string) => {
    if (!confirm('この収集元を削除しますか？紐づく記事も全て削除されます。')) return;
    const { error } = await supabase.from('sources').delete().eq('id', id);
    if (!error) {
      loadSources();
    }
  };

  // アクティブ切り替え
  const toggleActive = async (source: Source) => {
    const { error } = await supabase
      .from('sources')
      .update({ active: !source.active })
      .eq('id', source.id);
    if (!error) {
      loadSources();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* ページタイトル */}
      <div>
        <h2 style={{ fontSize: '2em', marginBottom: '8px' }}>
          情報収集元設定
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          情報を収集したいWebサイト、RSSフィードを登録し、正しく取得できるかテストします。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px' }}>
        
        {/* 左側：登録フォーム ＆ テスト結果 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} className="gradient-text" /> 収集元の追加
            </h3>
            
            <form onSubmit={handleAddSource} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  サイト名 / ソース名
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="例: TechCrunch Japan" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  URL / RSSフィードURL
                </label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="例: https://techcrunch.com/feed/" 
                  required
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  取得タイプ
                </label>
                <select 
                  className="form-select" 
                  value={type} 
                  onChange={e => setType(e.target.value as any)}
                >
                  <option value="RSS">RSS (最も正確かつ軽量)</option>
                  <option value="HTML">HTML (静的HTMLのスクレイピング)</option>
                  <option value="SPA">SPA (動的JSレンダリングが必要なサイト)</option>
                </select>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75em', marginTop: '6px' }}>
                  ※SPAはJS描画されるサイト（Note、一部のニュースサイトなど）に適用します。Jina経由で取得します。
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleTestConnection}
                  disabled={testing || !url}
                >
                  {testing ? <RefreshCw className="animate-spin" size={16} /> : '接続テスト実行'}
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  disabled={!name || !url}
                >
                  この内容で登録
                </button>
              </div>
            </form>
          </div>

          {/* テスト結果のプレビュー表示エリア */}
          {testResult && (
            <div className="glass-card" style={{ 
              padding: '20px', 
              borderColor: testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
              background: testResult.success ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)'
            }}>
              <h4 style={{ fontSize: '1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {testResult.success ? (
                  <>
                    <CheckCircle color="var(--color-success)" size={18} />
                    <span style={{ color: 'var(--color-success)' }}>テスト成功 ({testResult.count || 0}件取得)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle color="var(--color-error)" size={18} />
                    <span style={{ color: 'var(--color-error)' }}>取得エラーが発生しました</span>
                  </>
                )}
              </h4>

              {testResult.success && testResult.articles && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {testResult.articles.map((art, idx) => (
                    <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: '4px', fontSize: '0.85em' }}>
                      <p style={{ fontWeight: '500', marginBottom: '2px' }}>{art.title}</p>
                      <a href={art.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', wordBreak: 'break-all', fontSize: '0.9em' }}>
                        {art.url}
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {testResult.success && testResult.previewOnly && (
                <p style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>{testResult.message}</p>
              )}

              {!testResult.success && (
                <div style={{ color: '#fca5a5', fontSize: '0.9em', lineHeight: '1.5' }}>
                  <p>{testResult.error}</p>
                  
                  {/* 動的SPAを提案する特別インテリジェントUI */}
                  {type === 'HTML' && testResult.error?.includes('SPA') && (
                    <button 
                      className="btn-primary" 
                      style={{ marginTop: '12px', fontSize: '0.8em', padding: '6px 12px' }}
                      onClick={() => {
                        setType('SPA');
                        setTimeout(() => handleTestConnection(), 100);
                      }}
                    >
                      タイプを「SPA」に切り替えて再テスト
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* 右側：登録済みの収集元一覧 */}
        <div className="glass-card" style={{ padding: '24px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px' }}>登録済みの収集元 ({sources.length})</h3>
          
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>読み込み中...</p>
          ) : sources.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>収集元が登録されていません。左側のフォームから追加してください。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sources.map(src => (
                <div key={src.id} style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid var(--border-card)',
                  borderRadius: '8px', 
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '80%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '600' }}>{src.name}</span>
                      <span className={`badge badge-sent`} style={{ fontSize: '0.7em', padding: '2px 6px' }}>{src.type}</span>
                    </div>
                    <span style={{ fontSize: '0.8em', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{src.url}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* アクティブトグル */}
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={src.active}
                        onChange={() => toggleActive(src)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8em', marginLeft: '6px', color: src.active ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {src.active ? '有効' : '無効'}
                      </span>
                    </label>

                    {/* 削除ボタン */}
                    <button 
                      onClick={() => handleDeleteSource(src.id)}
                      style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
