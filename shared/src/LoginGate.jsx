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

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then(setUsers)
      .catch((err) => console.error(err));
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
    const val = username.trim();
    const userFound = (users || []).find((u) => u.username === val);
    if (userFound) {
      loginUser(userFound);
    } else {
      alert('Invalid username. Please choose one from the developer credentials list below.');
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
              placeholder="Enter username (e.g. chief_admin)"
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

        <div
          style={{
            margin: '2rem 0 1.5rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            position: 'relative',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#0e151b',
              padding: '0 0.75rem',
              fontSize: '0.75rem',
              color: 'var(--muted-foreground)',
            }}
          >
            DEVELOPER DEMO PROFILES
          </span>
        </div>

        <div
          style={{
            textAlign: 'left',
            maxHeight: 200,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.2)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {users === null ? (
            <div
              style={{
                color: 'var(--muted-foreground)',
                fontSize: '0.8rem',
                textAlign: 'center',
              }}
            >
              Loading credentials...
            </div>
          ) : (
            users.map((u) => (
              <QuickLoginItem
                key={u.id}
                user={u}
                accentColor={accentColor}
                onSelect={() => {
                  setUsername(u.username);
                  loginUser(u);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function QuickLoginItem({ user, accentColor, onSelect }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '0.5rem',
        marginBottom: '0.25rem',
        borderRadius: 4,
        background: hover ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        borderBottom: '1px solid rgba(255,255,255,0.02)',
        transition: 'all 0.2s',
      }}
    >
      <div>
        <strong>{user.name}</strong>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
          {user.role}
        </div>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          color: accentColor,
          fontSize: '0.75rem',
        }}
      >
        {user.username}
      </span>
    </div>
  );
}
