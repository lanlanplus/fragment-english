import { useState } from 'react';
import { supabase } from '../utils/supabase.js';

export default function AuthPanel({ session, syncMessage }) {
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6 || status === 'loading') return;

    setStatus('loading');
    setMessage('');

    const credentials = { email: email.trim(), password };
    const { error } =
      mode === 'signUp'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setMessage(error.message);
      setStatus('idle');
      return;
    }

    setMessage(mode === 'signUp' ? '注册成功。若邮箱确认已开启，请先查收确认邮件。' : '登录成功，正在同步。');
    setPassword('');
    setStatus('success');
  };

  const signOut = async () => {
    setStatus('loading');
    await supabase.auth.signOut();
    setStatus('idle');
  };

  if (session?.user) {
    return (
      <section className="auth-card signed-in">
        <div>
          <p className="card-kicker">Supabase</p>
          <strong>{session.user.email}</strong>
          {syncMessage && <p className="auth-message">{syncMessage}</p>}
        </div>
        <button type="button" className="ghost-button" onClick={signOut} disabled={status === 'loading'}>
          退出
        </button>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="登录或注册">
        <button type="button" className={mode === 'signIn' ? 'active' : ''} onClick={() => setMode('signIn')}>
          登录
        </button>
        <button type="button" className={mode === 'signUp' ? 'active' : ''} onClick={() => setMode('signUp')}>
          注册
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input value={email} type="email" autoComplete="email" placeholder="邮箱" onChange={(event) => setEmail(event.target.value)} />
        <input
          value={password}
          type="password"
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          placeholder="密码（至少 6 位）"
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" className="primary-button" disabled={!email.trim() || password.length < 6 || status === 'loading'}>
          {status === 'loading' ? '处理中...' : mode === 'signUp' ? '创建账号' : '登录并同步'}
        </button>
      </form>

      {(message || syncMessage) && <p className="auth-message">{message || syncMessage}</p>}
    </section>
  );
}
