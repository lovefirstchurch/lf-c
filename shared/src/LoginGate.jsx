import { useEffect, useState } from 'react';
import { apiFetch, setCurrentUserId } from './api.js';

// Gates the app behind a real username/password login, then behind a
// forced password change if the account is still on its default password
// (must_change_password), mirroring the production system's
// default_password_must_change flow.
export default function LoginGate({ appName, children }) {
  const [userId] = useState(() => localStorage.getItem('lfc_user_id'));
  // checking | loggedOut | mustChangePassword | ready
  const [status, setStatus] = useState(userId ? 'checking' : 'loggedOut');
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!userId) return;
    apiFetch('/api/me')
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.error) {
          setStatus('loggedOut');
          return;
        }
        setMe(data);
        setStatus(data.must_change_password ? 'mustChangePassword' : 'ready');
      })
      .catch(() => setStatus('loggedOut'));
  }, [userId]);

  if (status === 'loggedOut') return <LoginScreen appName={appName} />;
  if (status === 'checking') return null;
  if (status === 'mustChangePassword') {
    return <ChangePasswordScreen appName={appName} me={me} />;
  }
  return children;
}

function AuthCard({ appName, title, subtitle, children }) {
  const logoColor =
    appName === 'Synago'
      ? 'linear-gradient(135deg, #ff7a00, #fd5d96)'
      : 'linear-gradient(135deg, #a855f7, #3acff8)';

  const bgTint =
    appName === 'Synago'
      ? 'radial-gradient(at 0% 0%, rgba(255, 122, 0, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(253, 93, 150, 0.05) 0px, transparent 50%)'
      : 'radial-gradient(at 0% 0%, rgba(var(--primary-rgb), 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.1) 0px, transparent 50%)';
  const cardStyle =
    appName === 'Synago'
      ? {
          background: '#1a1f26',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 'var(--radius-lg)',
        }
      : {
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 'var(--radius-lg)',
        };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '2rem 1rem',
        backgroundColor: 'var(--bg-color)',
        backgroundImage: bgTint,
        backgroundAttachment: 'fixed',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 450,
          padding: '2.5rem',
          textAlign: 'center',
          boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
          ...cardStyle,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            margin: '0 auto 1.5rem',
            overflow: 'hidden',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4)',
          }}
        >
          <img
            src="/shared/images/love-first-logo.png"
            alt="Love First Church"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <h1
          style={{
            fontSize: '1.8rem',
            marginBottom: '0.25rem',
            fontFamily: 'var(--font-display)',
            background: logoColor,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {title || appName}
        </h1>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--muted-foreground)',
            marginBottom: '2rem',
          }}
        >
          {subtitle || 'LFC Church Management System'}
        </p>

        {children}
      </div>
    </div>
  );
}

function LoginScreen({ appName }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const logoColor =
    appName === 'Synago'
      ? 'linear-gradient(135deg, #ff7a00, #fd5d96)'
      : 'linear-gradient(135deg, #a855f7, #3acff8)';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setCurrentUserId(data.id);
        window.location.reload();
        return;
      }
      setError((data && data.error) || 'Invalid username or password.');
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard appName={appName}>
      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="form-control"
            placeholder="Enter username"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-control"
            placeholder="Enter password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </div>
        {error && (
          <div style={{ color: 'var(--destructive)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: logoColor,
            borderRadius: 'var(--radius-md)',
          }}
        >
          {submitting ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </AuthCard>
  );
}

function ChangePasswordScreen({ appName, me }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const logoColor =
    appName === 'Synago'
      ? 'linear-gradient(135deg, #ff7a00, #fd5d96)'
      : 'linear-gradient(135deg, #a855f7, #3acff8)';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        window.location.reload();
        return;
      }
      setError((data && data.error) || 'Failed to update password.');
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      appName={appName}
      title="Set a New Password"
      subtitle={me ? `Welcome, ${me.name}. You're using a default password — set your own to continue.` : undefined}
    >
      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input
            type="password"
            className="form-control"
            placeholder="At least 6 characters"
            required
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <input
            type="password"
            className="form-control"
            placeholder="Re-enter password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </div>
        {error && (
          <div style={{ color: 'var(--destructive)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: logoColor,
            borderRadius: 'var(--radius-md)',
          }}
        >
          {submitting ? 'Saving...' : 'Save Password'}
        </button>
      </form>
    </AuthCard>
  );
}
