import { useEffect, useState } from 'react';
import { setCurrentUserId } from './api.js';

// Ported from window.checkLoginOrRedirect in public/shared/components.js:
// if no user is stored, the app UI is replaced by the login screen.
export default function LoginGate({ appName, children }) {
  const [userId] = useState(() => localStorage.getItem('lfc_user_id'));

  if (!userId) {
    return <LoginScreen appName={appName} />;
  }
  return children;
}

function LoginScreen({ appName }) {
  const [users, setUsers] = useState(null);
  const [username, setUsername] = useState('');
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    fetch('/api/users')
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data)) {
          // The API returns { error } on failure (e.g. the database is
          // unreachable). Surface it instead of leaving `users` non-array,
          // which used to crash the sign-in handler.
          throw new Error((data && data.error) || `Server error (${res.status})`);
        }
        return data;
      })
      .then((data) => setUsers(data))
      .catch((err) => {
        console.error(err);
        setUsers([]);
        setLoadError(err.message || 'Could not reach the server.');
      });
  }, []);

  const logoColor =
    appName === 'Synago'
      ? 'linear-gradient(135deg, #ff7a00, #fd5d96)'
      : 'linear-gradient(135deg, #a855f7, #3acff8)';
  const accentColor = appName === 'Synago' ? '#ff7a00' : '#a855f7';

  // Synago's real app is a flat near-black UI with no blur/glass effect;
  // Poimen keeps the shared glassmorphism look.
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

  function loginUser(user) {
    setCurrentUserId(user.id);
    window.location.reload();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (loadError) {
      alert(`Cannot sign in — ${loadError}`);
      return;
    }
    const val = username.trim();
    const list = Array.isArray(users) ? users : [];
    const userFound = list.find((u) => u.username === val);
    if (userFound) {
      loginUser(userFound);
    } else {
      alert('Invalid username. Please try again.');
    }
  }

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
          {appName}
        </h1>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--muted-foreground)',
            marginBottom: '2rem',
          }}
        >
          LFC Church Management System
        </p>

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              placeholder="Enter username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ borderRadius: 'var(--radius-md)' }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              background: logoColor,
              borderRadius: 'var(--radius-md)',
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
