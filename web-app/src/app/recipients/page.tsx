'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { Trash2, Plus, Mail, Send } from 'lucide-react';

interface Recipient {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export default function RecipientsPage() {
  return (
    <AuthGuard>
      <RecipientsContent />
    </AuthGuard>
  );
}

function RecipientsContent() {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [loading, setLoading] = useState(true);
  const [testingRecipientId, setTestingRecipientId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadRecipients();
    }
  }, [user]);

  const loadRecipients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRecipients(data as Recipient[]);
    }
    setLoading(false);
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const { error } = await supabase.from('recipients').insert({
      user_id: user?.id,
      email: email.trim(),
      name: name.trim(),
      active: true
    });

    if (!error) {
      setEmail('');
      setName('');
      loadRecipients();
    } else {
      alert('登録に失敗しました: ' + error.message);
    }
  };

  const handleBulkAddRecipients = async () => {
    const emails = Array.from(new Set(
      bulkEmails
        .split(/[\s,;]+/)
        .map(item => item.trim())
        .filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    ));

    if (emails.length === 0) {
      alert('追加できるメールアドレスが見つかりませんでした。');
      return;
    }

    const { error } = await supabase.from('recipients').insert(
      emails.map(item => ({
        user_id: user?.id,
        email: item,
        name: '',
        active: true
      }))
    );

    if (!error) {
      setBulkEmails('');
      loadRecipients();
      alert(`${emails.length}件の配信先を追加しました。`);
    } else {
      alert('一括登録に失敗しました: ' + error.message);
    }
  };

  const toggleActive = async (recipient: Recipient) => {
    const { error } = await supabase
      .from('recipients')
      .update({ active: !recipient.active })
      .eq('id', recipient.id);

    if (!error) {
      loadRecipients();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この配信先を削除しますか？')) return;
    const { error } = await supabase.from('recipients').delete().eq('id', id);
    if (!error) {
      loadRecipients();
    }
  };

  const handleTestSend = async (recipient: Recipient) => {
    if (!confirm(`${recipient.email} へテストメールを送信します。よろしいですか？`)) return;

    setTestingRecipientId(recipient.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('ログインセッションが見つかりません。再ログインしてください。');
        return;
      }

      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ recipientId: recipient.id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'テストメール送信に失敗しました。');
      }

      alert(data.message || 'テストメールを送信しました。');
    } catch (err: any) {
      alert(err.message || 'テストメール送信に失敗しました。');
    } finally {
      setTestingRecipientId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* タイトル */}
      <div>
        <h2 style={{ fontSize: '2em', marginBottom: '8px' }}>配信先アドレス設定</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          ニュースレターを受け取る人のメールアドレスを管理します。ここでは受信者のメールアドレスだけ登録すればOKです。送信元メールの設定は「システム設定」で行います。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '30px' }}>
        
        {/* 左側：登録フォーム */}
        <div className="glass-card" style={{ padding: '24px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} className="gradient-text" /> 配信先の追加
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginBottom: '16px', lineHeight: '1.5' }}>
            受信者はメールアドレスだけで登録できます。名前は省略可能です。複数人に送りたい場合は、メールアドレスをまとめて貼り付けてください。
          </p>

          <form onSubmit={handleAddRecipient} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                メールアドレス
              </label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="例: user@example.com" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                宛名 / お名前 (省略可能)
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="例: 山田 太郎" 
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              <Plus size={18} /> 配信先を追加
            </button>
          </form>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-card)' }}>
            <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              複数メールアドレスをまとめて追加
            </label>
            <textarea
              className="form-input"
              placeholder={'例:\nuser1@example.com\nuser2@example.com\nuser3@example.com'}
              value={bulkEmails}
              onChange={e => setBulkEmails(e.target.value)}
              rows={5}
              style={{ resize: 'vertical', marginBottom: '10px' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleBulkAddRecipients}
              disabled={!bulkEmails.trim()}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              貼り付けたメールをまとめて追加
            </button>
          </div>
        </div>

        {/* 右側：一覧 */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px' }}>
            宛先リスト ({recipients.length})
          </h3>

          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>読み込み中...</p>
          ) : recipients.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
              登録されている宛先はありません。左側のフォームから追加してください。
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recipients.map(recipient => (
                <div 
                  key={recipient.id} 
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid var(--border-card)',
                    borderRadius: '8px', 
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: '500' }}>
                      {recipient.name || '名前なし'}
                    </span>
                    <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                      {recipient.email}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* アクティブトグル */}
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={recipient.active}
                        onChange={() => toggleActive(recipient)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8em', marginLeft: '6px', color: recipient.active ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {recipient.active ? '配信中' : '停止中'}
                      </span>
                    </label>

                    {/* テスト送信 */}
                    <button
                      onClick={() => handleTestSend(recipient)}
                      disabled={testingRecipientId === recipient.id}
                      style={{
                        background: 'none',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '6px',
                        color: 'var(--color-success)',
                        cursor: testingRecipientId === recipient.id ? 'not-allowed' : 'pointer',
                        padding: '6px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: testingRecipientId === recipient.id ? 0.6 : 1
                      }}
                    >
                      <Send size={14} />
                      <span style={{ fontSize: '0.8em' }}>
                        {testingRecipientId === recipient.id ? '送信中' : 'テスト送信'}
                      </span>
                    </button>

                    {/* 削除 */}
                    <button 
                      onClick={() => handleDelete(recipient.id)}
                      style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
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
