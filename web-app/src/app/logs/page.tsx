'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';

interface Log {
  id: string;
  status: 'success' | 'error';
  trigger_type: 'auto' | 'manual';
  error_message: string | null;
  executed_at: string;
  sources?: {
    name: string;
    url: string;
  } | null;
}

export default function LogsPage() {
  return (
    <AuthGuard>
      <LogsContent />
    </AuthGuard>
  );
}

function LogsContent() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLogs();
    }
  }, [user]);

  const loadLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('execution_logs')
      .select(`
        id,
        status,
        trigger_type,
        error_message,
        executed_at,
        sources (
          name,
          url
        )
      `)
      .eq('user_id', user?.id)
      .order('executed_at', { ascending: false })
      .limit(100); // 最新100件を表示

    if (!error && data) {
      setLogs(data as any as Log[]);
    }
    setLoading(false);
  };

  const handleClearLogs = async () => {
    if (!confirm('実行ログ履歴をすべて削除しますか？')) return;
    const { error } = await supabase.from('execution_logs').delete().eq('user_id', user?.id);
    if (!error) {
      setLogs([]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* タイトル */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '2em', marginBottom: '8px' }}>実行ログ履歴</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            自動・手動トリガーによる記事収集バッチの成功・失敗ログを確認できます。
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadLogs} className="btn-secondary" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 更新
          </button>
          <button onClick={handleClearLogs} className="btn-secondary" style={{ color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            ログをクリア
          </button>
        </div>
      </div>

      {/* ログ一覧 */}
      <div className="glass-card" style={{ padding: '24px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>読み込み中...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>実行履歴はありません。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-card)', color: 'var(--text-secondary)', fontSize: '0.9em' }}>
                  <th style={{ padding: '12px 8px' }}>ステータス</th>
                  <th style={{ padding: '12px 8px' }}>収集元サイト</th>
                  <th style={{ padding: '12px 8px' }}>トリガー</th>
                  <th style={{ padding: '12px 8px' }}>エラー詳細 / 診断メッセージ</th>
                  <th style={{ padding: '12px 8px' }}>実行日時</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', fontSize: '0.9em', verticalAlign: 'top' }}>
                    
                    {/* ステータス */}
                    <td style={{ padding: '16px 8px' }}>
                      {log.status === 'success' ? (
                        <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                          <CheckCircle size={16} /> 成功
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                          <AlertCircle size={16} /> 失敗
                        </span>
                      )}
                    </td>

                    {/* 収集元名 */}
                    <td style={{ padding: '16px 8px', fontWeight: '500' }}>
                      {log.sources?.name || <span style={{ color: 'var(--text-muted)' }}>削除された収集元</span>}
                    </td>

                    {/* トリガータイプ */}
                    <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>
                      {log.trigger_type === 'auto' ? '自動 (Cron)' : '手動実行'}
                    </td>

                    {/* エラー内容 / 診断 */}
                    <td style={{ padding: '16px 8px', maxWidth: '350px' }}>
                      {log.status === 'success' ? (
                        <span style={{ color: 'var(--text-muted)' }}>正常終了</span>
                      ) : (
                        <div style={{ color: '#fca5a5', lineHeight: '1.4' }}>
                          <p style={{ fontWeight: '500', marginBottom: '4px' }}>{log.error_message}</p>
                          {/* 解決へのアドバイス */}
                          <p style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                            {log.error_message?.includes('403') && '💡 アドバイス: サイトのスクレイピング制限です。RSSフィードを探すか、タイプをSPAへ変更してください。'}
                            {log.error_message?.includes('SPA') && '💡 アドバイス: JS描画サイトの可能性があります。タイプをSPAへ設定してください。'}
                            {log.error_message?.includes('API key') && '💡 アドバイス: 設定画面でGemini APIキーを確認してください。'}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* 実行日時 */}
                    <td style={{ padding: '16px 8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                      <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                      {new Date(log.executed_at).toLocaleString('ja-JP')}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
