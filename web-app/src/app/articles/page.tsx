'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { Check, X, ShieldAlert, ExternalLink, Calendar, BookOpen } from 'lucide-react';

interface Article {
  id: string;
  source_name: string;
  title: string;
  url: string;
  summary: string;
  security_flag: boolean;
  status: 'pending' | 'approved' | 'sent';
  fetched_at: string;
}

export default function ArticlesPage() {
  return (
    <AuthGuard>
      <ArticlesContent />
    </AuthGuard>
  );
}

function ArticlesContent() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'sent'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadArticles();
    }
  }, [user, activeTab]);

  const loadArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', user?.id)
      .eq('status', activeTab)
      .order('fetched_at', { ascending: false });

    if (!error && data) {
      setArticles(data as Article[]);
    }
    setLoading(false);
  };

  // ステータス更新（承認・非承認）
  const updateStatus = async (id: string, newStatus: 'pending' | 'approved') => {
    const { error } = await supabase
      .from('articles')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      // ローカル状態を更新して再読み込みの手間を省く
      setArticles(prev => prev.filter(art => art.id !== id));
    } else {
      alert('ステータスの更新に失敗しました: ' + error.message);
    }
  };

  // 記事の削除
  const handleDeleteArticle = async (id: string) => {
    if (!confirm('この記事をリストから削除しますか？')) return;
    const { error } = await supabase.from('articles').delete().eq('id', id);
    if (!error) {
      setArticles(prev => prev.filter(art => art.id !== id));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* ページタイトル ＆ タブ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '2em', marginBottom: '8px' }}>収集記事一覧</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            AIが自動収集・要約した記事をチェックし、配信対象を「承認」します。
          </p>
        </div>

        {/* タブ切り替えボタン */}
        <div className="glass-card" style={{ display: 'inline-flex', padding: '4px', borderRadius: '8px' }}>
          {(['pending', 'approved', 'sent'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? 'var(--gradient-main)' : 'none',
                color: activeTab === tab ? 'white' : 'var(--text-primary)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.9em',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {tab === 'pending' ? '承認待ち' : tab === 'approved' ? '承認済み' : '配信完了'}
            </button>
          ))}
        </div>
      </div>

      {/* 記事リスト表示エリア */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>読み込み中...</p>
        </div>
      ) : articles.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            該当する記事はありません。
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {articles.map(article => (
            <div 
              key={article.id} 
              className="glass-card" 
              style={{ 
                padding: '24px', 
                borderLeft: article.security_flag ? '4px solid var(--color-error)' : undefined,
                position: 'relative'
              }}
            >
              {/* ヘッダー情報 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="badge badge-sent" style={{ fontSize: '0.75em' }}>
                  {article.source_name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8em' }}>
                  <Calendar size={14} />
                  {new Date(article.fetched_at).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>

              {/* 記事タイトル */}
              <h3 style={{ fontSize: '1.3em', lineHeight: '1.4', marginBottom: '12px' }}>
                {article.title}
              </h3>

              {/* セキュリティリスクの警告 */}
              {article.security_flag && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid var(--color-error)', 
                  borderRadius: '6px', 
                  padding: '12px 16px', 
                  color: '#fca5a5', 
                  fontSize: '0.9em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px'
                }}>
                  <ShieldAlert size={20} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
                  <div>
                    <strong>セキュリティリスク検出:</strong> AIがフィッシングや悪意あるサイトへの誘導、不正コード実行のリスクを検知しました。このまま承認しても、ニュースレター配信時に自動的に除外されます。
                  </div>
                </div>
              )}

              {/* AI要約テキスト */}
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.01)', 
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                color: 'var(--text-primary)',
                fontSize: '0.95em',
                lineHeight: '1.6'
              }}>
                <div style={{ fontSize: '0.75em', fontWeight: 'bold', color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  AI Summary
                </div>
                {article.summary}
              </div>

              {/* フッターアクションエリア */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a 
                  href={article.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-secondary"
                  style={{ fontSize: '0.85em', padding: '8px 12px' }}
                >
                  元記事を読む <ExternalLink size={14} />
                </a>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* 削除 */}
                  <button 
                    onClick={() => handleDeleteArticle(article.id)}
                    className="btn-secondary"
                    style={{ fontSize: '0.85em', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                  >
                    削除
                  </button>

                  {/* 承認待ちタブ：承認ボタン */}
                  {activeTab === 'pending' && (
                    <button
                      onClick={() => updateStatus(article.id, 'approved')}
                      className="btn-primary"
                      style={{ fontSize: '0.85em', padding: '8px 16px' }}
                    >
                      <Check size={16} /> 配信を承認する
                    </button>
                  )}

                  {/* 承認済みタブ：承認解除ボタン */}
                  {activeTab === 'approved' && (
                    <button
                      onClick={() => updateStatus(article.id, 'pending')}
                      className="btn-secondary"
                      style={{ fontSize: '0.85em', padding: '8px 16px', borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
                    >
                      <X size={16} /> 承認を解除
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
