'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { Trash2, Plus, Mail } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);

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
      email,
      name,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* タイトル */}
      <div>
        <h2 style={{ fontSize: '2em', marginBottom: '8px' }}>配信先アドレス設定</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          ニュースレターの送信先となるメールアドレスのリストを管理します。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '30px' }}>
        
        {/* 左側：登録フォーム */}
        <div className="glass-card" style={{ padding: '24px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} className="gradient-text" /> 新規宛先の追加
          </h3>

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
