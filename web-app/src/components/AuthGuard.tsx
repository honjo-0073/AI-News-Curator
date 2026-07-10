'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'update-password';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password');
        setMessage('新しいパスワードを設定してください。');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const resetNotices = () => {
    setAuthError('');
    setMessage('');
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    resetNotices();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotices();
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage('確認メールを送信しました。届かない場合は迷惑メールフォルダを確認し、下の「確認メールを再送」をお試しください。');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || '認証に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setAuthError('確認メールを再送するメールアドレスを入力してください。');
      return;
    }
    resetNotices();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setMessage('確認メールを再送しました。迷惑メールフォルダもご確認ください。');
    } catch (err: any) {
      setAuthError(err.message || '確認メールを再送できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setAuthError('メールアドレスを入力してください。');
      return;
    }
    resetNotices();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage('パスワード再設定メールを送信しました。メール内のリンクを開いてください。');
    } catch (err: any) {
      setAuthError(err.message || '再設定メールを送信できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setAuthError('パスワードは6文字以上で入力してください。');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('確認用パスワードが一致しません。');
      return;
    }
    resetNotices();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('パスワードを更新しました。ログインを続けられます。');
      setPassword('');
      setConfirmPassword('');
      setMode('signin');
    } catch (err: any) {
      setAuthError(err.message || 'パスワードを更新できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><p style={{ color: 'var(--text-secondary)' }}>読み込み中...</p></div>;
  }

  if (!user || mode === 'update-password') {
    const title = mode === 'signup' ? 'アカウント作成' : mode === 'forgot-password' ? 'パスワードを再設定' : mode === 'update-password' ? '新しいパスワードを設定' : 'サインイン';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '20px' }}>
        <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '40px' }}>
          <h2 style={{ fontSize: '1.8em', marginBottom: '8px', textAlign: 'center' }}><span className="gradient-text">{title}</span></h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', textAlign: 'center', marginBottom: '24px' }}>AI News Curator を開始する</p>

          {authError && <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)', color: '#fca5a5', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85em' }}>{authError}</div>}
          {message && <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-success)', color: '#a7f3d0', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85em' }}>{message}</div>}

          {mode === 'forgot-password' ? (
            <form onSubmit={handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>メールアドレス<input type="email" className="form-input" required value={email} onChange={e => setEmail(e.target.value)} style={{ marginTop: '6px' }} /></label>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>{submitting ? '送信中...' : '再設定メールを送信'}</button>
            </form>
          ) : mode === 'update-password' ? (
            <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>新しいパスワード<input type="password" className="form-input" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} style={{ marginTop: '6px' }} /></label>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>新しいパスワード（確認）<input type="password" className="form-input" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ marginTop: '6px' }} /></label>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>{submitting ? '更新中...' : 'パスワードを更新'}</button>
            </form>
          ) : (
            <>
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>メールアドレス<input type="email" className="form-input" required value={email} onChange={e => setEmail(e.target.value)} style={{ marginTop: '6px' }} /></label>
                <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>パスワード<input type="password" className="form-input" required value={password} onChange={e => setPassword(e.target.value)} style={{ marginTop: '6px' }} /></label>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>{submitting ? '処理中...' : mode === 'signup' ? 'アカウント作成' : 'ログイン'}</button>
              </form>
              {mode === 'signup' && <button type="button" onClick={handleResendConfirmation} disabled={submitting} style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85em' }}>確認メールを再送</button>}
            </>
          )}

          {mode !== 'update-password' && <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85em', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {mode === 'signin' ? <>アカウントをお持ちではないですか？ <button onClick={() => changeMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>新規登録</button><br /><button onClick={() => changeMode('forgot-password')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>パスワードを忘れた場合</button></> : <button onClick={() => changeMode('signin')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>ログインへ戻る</button>}
          </p>}
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, loading }}><div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}><button onClick={handleSignOut} className="btn-secondary" style={{ fontSize: '0.8em', padding: '8px 12px', borderRadius: '20px' }}>ログアウト ({user.email})</button></div>{children}</AuthContext.Provider>;
}
export { AuthContext };
