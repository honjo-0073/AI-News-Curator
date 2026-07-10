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
        setMessage('譁ｰ縺励＞繝代せ繝ｯ繝ｼ繝峨ｒ險ｭ螳壹＠縺ｦ縺上□縺輔＞縲・);
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
        setMessage('遒ｺ隱阪Γ繝ｼ繝ｫ繧帝∽ｿ｡縺励∪縺励◆縲ょｱ翫°縺ｪ縺・ｴ蜷医・霑ｷ諠代Γ繝ｼ繝ｫ繝輔か繝ｫ繝繧堤｢ｺ隱阪＠縲∽ｸ九・縲檎｢ｺ隱阪Γ繝ｼ繝ｫ繧貞・騾√阪ｒ縺願ｩｦ縺励￥縺縺輔＞縲・);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || '隱崎ｨｼ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setAuthError('遒ｺ隱阪Γ繝ｼ繝ｫ繧貞・騾√☆繧九Γ繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・);
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
      setMessage('遒ｺ隱阪Γ繝ｼ繝ｫ繧貞・騾√＠縺ｾ縺励◆縲りｿｷ諠代Γ繝ｼ繝ｫ繝輔か繝ｫ繝繧ゅ＃遒ｺ隱阪￥縺縺輔＞縲・);
    } catch (err: any) {
      setAuthError(err.message || '遒ｺ隱阪Γ繝ｼ繝ｫ繧貞・騾√〒縺阪∪縺帙ｓ縺ｧ縺励◆縲・);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setAuthError('繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    resetNotices();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage('繝代せ繝ｯ繝ｼ繝牙・險ｭ螳壹Γ繝ｼ繝ｫ繧帝∽ｿ｡縺励∪縺励◆縲ゅΓ繝ｼ繝ｫ蜀・・繝ｪ繝ｳ繧ｯ繧帝幕縺・※縺上□縺輔＞縲・);
    } catch (err: any) {
      setAuthError(err.message || '蜀崎ｨｭ螳壹Γ繝ｼ繝ｫ繧帝∽ｿ｡縺ｧ縺阪∪縺帙ｓ縺ｧ縺励◆縲・);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setAuthError('繝代せ繝ｯ繝ｼ繝峨・6譁・ｭ嶺ｻ･荳翫〒蜈･蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('遒ｺ隱咲畑繝代せ繝ｯ繝ｼ繝峨′荳閾ｴ縺励∪縺帙ｓ縲・);
      return;
    }
    resetNotices();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('繝代せ繝ｯ繝ｼ繝峨ｒ譖ｴ譁ｰ縺励∪縺励◆縲ゅΟ繧ｰ繧､繝ｳ繧堤ｶ壹￠繧峨ｌ縺ｾ縺吶・);
      setPassword('');
      setConfirmPassword('');
      setMode('signin');
    } catch (err: any) {
      setAuthError(err.message || '繝代せ繝ｯ繝ｼ繝峨ｒ譖ｴ譁ｰ縺ｧ縺阪∪縺帙ｓ縺ｧ縺励◆縲・);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><p style={{ color: 'var(--text-secondary)' }}>隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p></div>;
  }

  if (!user || mode === 'update-password') {
    const title = mode === 'signup' ? '繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・' : mode === 'forgot-password' ? '繝代せ繝ｯ繝ｼ繝峨ｒ蜀崎ｨｭ螳・ : mode === 'update-password' ? '譁ｰ縺励＞繝代せ繝ｯ繝ｼ繝峨ｒ險ｭ螳・ : '繧ｵ繧､繝ｳ繧､繝ｳ';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '20px' }}>
        <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '40px' }}>
          <h2 style={{ fontSize: '1.8em', marginBottom: '8px', textAlign: 'center' }}><span className="gradient-text">{title}</span></h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', textAlign: 'center', marginBottom: '24px' }}>AI News Curator 繧帝幕蟋九☆繧・/p>

          {authError && <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)', color: '#fca5a5', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85em' }}>{authError}</div>}
          {message && <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-success)', color: '#a7f3d0', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85em' }}>{message}</div>}

          {mode === 'forgot-password' ? (
            <form onSubmit={handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ<input type="email" className="form-input" required value={email} onChange={e => setEmail(e.target.value)} style={{ marginTop: '6px' }} /></label>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>{submitting ? '騾∽ｿ｡荳ｭ...' : '蜀崎ｨｭ螳壹Γ繝ｼ繝ｫ繧帝∽ｿ｡'}</button>
            </form>
          ) : mode === 'update-password' ? (
            <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>譁ｰ縺励＞繝代せ繝ｯ繝ｼ繝・input type="password" className="form-input" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} style={{ marginTop: '6px' }} /></label>
              <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>譁ｰ縺励＞繝代せ繝ｯ繝ｼ繝会ｼ育｢ｺ隱搾ｼ・input type="password" className="form-input" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ marginTop: '6px' }} /></label>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>{submitting ? '譖ｴ譁ｰ荳ｭ...' : '繝代せ繝ｯ繝ｼ繝峨ｒ譖ｴ譁ｰ'}</button>
            </form>
          ) : (
            <>
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ<input type="email" className="form-input" required value={email} onChange={e => setEmail(e.target.value)} style={{ marginTop: '6px' }} /></label>
                <label style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>繝代せ繝ｯ繝ｼ繝・input type="password" className="form-input" required value={password} onChange={e => setPassword(e.target.value)} style={{ marginTop: '6px' }} /></label>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>{submitting ? '蜃ｦ逅・ｸｭ...' : mode === 'signup' ? '繧｢繧ｫ繧ｦ繝ｳ繝井ｽ懈・' : '繝ｭ繧ｰ繧､繝ｳ'}</button>
              </form>
              {mode === 'signup' && <button type="button" onClick={handleResendConfirmation} disabled={submitting} style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85em' }}>遒ｺ隱阪Γ繝ｼ繝ｫ繧貞・騾・/button>}
            </>
          )}

          {mode !== 'update-password' && <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85em', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {mode === 'signin' ? <>繧｢繧ｫ繧ｦ繝ｳ繝医ｒ縺頑戟縺｡縺ｧ縺ｯ縺ｪ縺・〒縺吶°・・<button onClick={() => changeMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>譁ｰ隕冗匳骭ｲ</button><br /><button onClick={() => changeMode('forgot-password')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>繝代せ繝ｯ繝ｼ繝峨ｒ蠢倥ｌ縺溷ｴ蜷・/button></> : <button onClick={() => changeMode('signin')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>繝ｭ繧ｰ繧､繝ｳ縺ｸ謌ｻ繧・/button>}
          </p>}
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, loading }}><div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}><button onClick={handleSignOut} className="btn-secondary" style={{ fontSize: '0.8em', padding: '8px 12px', borderRadius: '20px' }}>繝ｭ繧ｰ繧｢繧ｦ繝・({user.email})</button></div>{children}</AuthContext.Provider>;
}
export { AuthContext };

