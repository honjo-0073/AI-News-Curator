'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // ログインフォーム用のローカルステート
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // 現在のセッションの確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setMessage('');
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('確認メールを送信しました。メールをご確認の上、ログインしてください。');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || '認証に失敗しました。');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>読み込み中...</p>
      </div>
    );
  }

  // 未ログイン時は認証フォームを表示
  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '20px' }}>
        <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '40px' }}>
          <h2 style={{ fontSize: '1.8em', marginBottom: '8px', textAlign: 'center' }}>
            <span className="gradient-text">{isSignUp ? 'アカウント作成' : 'サインイン'}</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', textAlign: 'center', marginBottom: '24px' }}>
            AI News Curator を開始する
          </p>

          {authError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)', color: '#fca5a5', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85em' }}>
              {authError}
            </div>
          )}

          {message && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-success)', color: '#a7f3d0', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85em' }}>
              {message}
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>メールアドレス</label>
              <input 
                type="email" 
                className="form-input" 
                required 
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>パスワード</label>
              <input 
                type="password" 
                className="form-input" 
                required 
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              {isSignUp ? 'アカウント作成' : 'ログイン'}
            </button>
          </form>

          <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
            {isSignUp ? 'すでにアカウントをお持ちですか？' : 'アカウントをお持ちではないですか？'}{' '}
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setMessage(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isSignUp ? 'ログイン' : '新規登録'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {/* 画面右上に簡易ログアウトを表示するためのフック */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}>
        <button 
          onClick={handleSignOut}
          className="btn-secondary"
          style={{ fontSize: '0.8em', padding: '8px 12px', borderRadius: '20px' }}
        >
          ログアウト ({user.email})
        </button>
      </div>
      {children}
    </AuthContext.Provider>
  );
}
export { AuthContext };
