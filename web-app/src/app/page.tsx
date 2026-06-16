'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard, { useAuth } from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Play, Send, ListCollapse, Database, Users, Calendar, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface Stats {
  sourcesCount: number;
  pendingArticlesCount: number;
  recipientsCount: number;
}

interface ArticlePreview {
  id: string;
  title: string;
  source_name: string;
  fetched_at: string;
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ sourcesCount: 0, pendingArticlesCount: 0, recipientsCount: 0 });
  const [recentArticles, setRecentArticles] = useState<ArticlePreview[]>([]);
  const [loading, setLoading] = useState(true);

  // セットアップ確認用
  const [setupChecked, setSetupChecked] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasSmtp, setHasSmtp] = useState(false);

  // 手動実行の状態管理
  const [fetchingNews, setFetchingNews] = useState(false);
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    if (user) {
      loadStatsAndPreviews();
    }
  }, [user]);

  const loadStatsAndPreviews = async () => {
    setLoading(true);
    
    // 1. 収集元数
    const { count: sourcesCount } = await supabase
      .from('sources')
      .select('*', { count: 'exact', head: true });

    // 2. 承認待ち記事数
    const { count: pendingCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 3. 宛先数
    const { count: recipientsCount } = await supabase
      .from('recipients')
      .select('*', { count: 'exact', head: true });

    setStats({
      sourcesCount: sourcesCount || 0,
      pendingArticlesCount: pendingCount || 0,
      recipientsCount: recipientsCount || 0
    });

    // 4. 最近の記事プレビュー (最新5件)
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title, source_name, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(5);

    if (articles) {
      setRecentArticles(articles as ArticlePreview[]);
    }

    // 5. 設定状況のロード
    const { data: setting } = await supabase
      .from('user_settings')
      .select('gemini_api_key, smtp_settings')
      .eq('user_id', user?.id)
      .single();

    if (setting) {
      setHasApiKey(!!setting.gemini_api_key);
      setHasSmtp(!!setting.smtp_settings && Object.keys(setting.smtp_settings).length > 0);
    }

    setSetupChecked(true);
    setLoading(false);
  };

  // 手動ニュース収集の実行
  const handleFetchNews = async () => {
    if (fetchingNews) return;
    setFetchingNews(true);
    setActionMessage('AIがニュースを収集中です。これには数分かかる場合があります...');

    try {
      const res = await fetch(`/api/cron/fetch?userId=${user?.id}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`キュレーション完了！ 新規記事: ${data.stats.newArticles}件 / エラー: ${data.stats.errors}件`);
        loadStatsAndPreviews();
      } else {
        setActionMessage(`エラーが発生しました: ${data.error}`);
      }
    } catch (e) {
      setActionMessage('ネットワーク接続エラーが発生しました。');
    } finally {
      setFetchingNews(false);
      setTimeout(() => setActionMessage(''), 5000);
    }
  };

  // 手動ニュースレター配信の実行
  const handleSendNewsletter = async () => {
    if (sendingNewsletter) return;
    if (!confirm('承認済みの記事を登録されている宛先へ今すぐ配信します。よろしいですか？')) return;
    
    setSendingNewsletter(true);
    setActionMessage('ニュースレターを配信中...');

    try {
      const res = await fetch(`/api/cron/send?userId=${user?.id}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        if (data.stats.sentEmails > 0) {
          setActionMessage(`配信完了！ ${data.stats.processedUsers}件のユーザーのニュースレターを配信しました。`);
        } else {
          setActionMessage('配信対象の記事（承認済み）がない、または有効な宛先が登録されていません。');
        }
        loadStatsAndPreviews();
      } else {
        setActionMessage(`エラーが発生しました: ${data.error}`);
      }
    } catch (e) {
      setActionMessage('ネットワーク接続エラーが発生しました。');
    } finally {
      setSendingNewsletter(false);
      setTimeout(() => setActionMessage(''), 5000);
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
      
      {/* イントロダクション */}
      <div>
        <h2 style={{ fontSize: '2.5em', marginBottom: '8px' }}>
          Welcome, <span className="gradient-text">AI Curator Hub</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          情報を自動収集し、要約してメールで配信。キュレーション運用のすべてをここで行います。
        </p>
      </div>

      {/* 設定未完了時の警告 */}
      {setupChecked && (!hasApiKey || !hasSmtp) && (
        <div className="glass-card" style={{ padding: '20px', borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.03)' }}>
          <h3 style={{ color: 'var(--color-warning)', fontSize: '1.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} /> 初期設定を行ってください
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginBottom: '16px' }}>
            システムを正常に稼働させるためには、Gemini APIキーおよびメール配信用SMTPの設定が必要です。
          </p>
          <Link href="/settings" className="btn-primary" style={{ fontSize: '0.85em', background: 'var(--color-warning)' }}>
            設定画面へ移動する <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* 手動トリガースイッチ ＆ アクションメッセージ */}
      <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
        <h3 style={{ fontSize: '1.2em', marginBottom: '16px' }}>手動トリガー実行（デバッグ・テスト用）</h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          
          <button 
            onClick={handleFetchNews} 
            className="btn-primary" 
            disabled={fetchingNews || !hasApiKey}
            style={{ minWidth: '200px' }}
          >
            <Play size={16} /> {fetchingNews ? 'ニュース収集中...' : '今すぐ収集を開始'}
          </button>

          <button 
            onClick={handleSendNewsletter} 
            className="btn-secondary" 
            disabled={sendingNewsletter || !hasSmtp || stats.pendingArticlesCount === 0}
            style={{ minWidth: '200px', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
          >
            <Send size={16} /> {sendingNewsletter ? '配信中...' : 'ニュースレターを今すぐ配信'}
          </button>

        </div>

        {actionMessage && (
          <div style={{ 
            marginTop: '16px', 
            background: 'rgba(255, 255, 255, 0.03)', 
            borderLeft: '4px solid var(--color-accent)', 
            padding: '12px 16px',
            borderRadius: '4px',
            fontSize: '0.9em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} style={{ color: 'var(--color-accent)' }} />
            {actionMessage}
          </div>
        )}
      </div>

      {/* 統計パネル */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* 統計：収集元 */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', color: 'var(--color-primary)' }}>
            <Database size={28} />
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em', display: 'block', marginBottom: '4px' }}>登録収集元</span>
            <span style={{ fontSize: '2em', fontWeight: 'bold' }}>{stats.sourcesCount}</span> 件
          </div>
        </div>

        {/* 統計：承認待ち */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '12px', color: 'var(--color-warning)' }}>
            <ListCollapse size={28} />
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em', display: 'block', marginBottom: '4px' }}>承認待ち記事数</span>
            <span style={{ fontSize: '2em', fontWeight: 'bold' }}>{stats.pendingArticlesCount}</span> 件
          </div>
        </div>

        {/* 統計：配信先 */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', color: 'var(--color-success)' }}>
            <Users size={28} />
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em', display: 'block', marginBottom: '4px' }}>配信先アドレス</span>
            <span style={{ fontSize: '2em', fontWeight: 'bold' }}>{stats.recipientsCount}</span> 件
          </div>
        </div>

      </div>

      {/* 最近収集された記事の簡易プレビュー */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2em' }}>最近収集された記事 (最新5件)</h3>
          <Link href="/articles" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '4px' }}>
            すべて表示 <ArrowRight size={14} />
          </Link>
        </div>

        {recentArticles.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>収集された記事はありません。「今すぐ収集を開始」を押してテストしてください。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentArticles.map(art => (
              <div key={art.id} style={{ 
                background: 'rgba(255, 255, 255, 0.01)', 
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '6px', 
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '75%' }}>
                  <span style={{ fontWeight: '500', fontSize: '0.95em' }}>{art.title}</span>
                  <span style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>{art.source_name}</span>
                </div>
                <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  {new Date(art.fetched_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
