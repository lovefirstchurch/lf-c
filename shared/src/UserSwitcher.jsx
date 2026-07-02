import { useEffect, useRef, useState } from 'react';
import { clearCurrentUserId, setCurrentUserId } from './api.js';

// Floating developer role switcher, ported from window.initUserSwitcher in
// public/shared/components.js.
export default function UserSwitcher({ onUserChanged }) {
  const [users, setUsers] = useState(null); // null = loading, false = error
  const [show, setShow] = useState(false);
  const [currentUserId, setCurrent] = useState(
    () => localStorage.getItem('lfc_user_id') || '1'
  );
  const containerRef = useRef(null);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load users');
        return res.json();
      })
      .then(setUsers)
      .catch((err) => {
        console.error(err);
        setUsers(false);
      });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShow(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  function describe(u) {
    let desc = u.role;
    if (u.role === 'Governor') {
      desc += ` (Trinity Area 1 / Grace Area 2)`;
    } else if (u.role === 'Area 1 Shepherd' || u.role === 'Area 2 Schacenta Leader') {
      desc += ` (Unit #${u.unit_id})`;
    }
    return desc;
  }

  return (
    <div className="user-selector-container" ref={containerRef}>
      <button
        className="user-selector-btn"
        title="Switch User / Role"
        onClick={(e) => {
          e.stopPropagation();
          setShow((s) => !s);
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </button>
      <div className={`user-selector-panel glass${show ? ' show' : ''}`}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            marginBottom: '0.5rem',
            color: 'var(--primary)',
          }}
        >
          Developer Role Switcher
        </h3>
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
            marginBottom: '0.5rem',
          }}
        >
          Select a profile to simulate login context:
        </div>
        <div className="user-selector-list">
          {users === null && 'Loading profiles...'}
          {users === false && 'Error loading profiles'}
          {Array.isArray(users) &&
            users.map((u) => (
              <div
                key={u.id}
                className={`user-selector-item ${
                  u.id.toString() === currentUserId ? 'active' : ''
                }`}
                onClick={() => {
                  setCurrentUserId(u.id);
                  setCurrent(u.id.toString());
                  setShow(false);
                  if (onUserChanged) onUserChanged(u);
                }}
              >
                <div className="user-selector-name">{u.name}</div>
                <div className="user-selector-role">{describe(u)}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export function SignOutButton() {
  return (
    <button
      className="btn btn-secondary btn-sm"
      style={{ marginLeft: '1rem' }}
      onClick={() => {
        clearCurrentUserId();
        window.location.reload();
      }}
    >
      Sign Out
    </button>
  );
}
