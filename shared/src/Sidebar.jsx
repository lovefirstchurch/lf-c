import { clearCurrentUserId } from './api.js';

// Collapsible side drawer, ported from the sidebar markup/controls added to
// public/synago and public/poimen (feat: collapsible side drawer navigation).
// Nav links are app-specific and passed as children.
export default function Sidebar({ appName, gradient, open, onClose, user, children }) {
  return (
    <>
      {/* Sidebar Navigation Drawer Backdrop */}
      <div className={`Sidebar-backdrop${open ? ' open' : ''}`} onClick={onClose} />

      {/* Sidebar Navigation Drawer Panel */}
      <aside className={`Sidebar-panel${open ? ' open' : ''}`}>
        <div className="Sidebar-header">
          <div className="Sidebar-logo">
            <img src="/shared/images/love-first-logo.png" alt="Love First Church" />
            <div
              className="Sidebar-logo-text"
              style={{
                background: gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {appName}
            </div>
          </div>
          <button className="Sidebar-close-btn" onClick={onClose} aria-label="Close Sidebar">
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <nav className="Sidebar-nav">
          <div className="Sidebar-nav-heading">Navigation</div>
          {children}
        </nav>

        <div className="Sidebar-footer">
          <div className="Sidebar-profile">
            <div className="Sidebar-avatar">{user && user.name ? user.name.charAt(0) : 'U'}</div>
            <div className="Sidebar-profile-info">
              <div className="Sidebar-profile-name">{(user && user.name) || 'User Profile'}</div>
              <div className="Sidebar-profile-role">{(user && user.role) || 'Guest'}</div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{
              padding: '0.4rem',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Sign Out"
            onClick={() => {
              clearCurrentUserId();
              window.location.reload();
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}

export function MenuToggleButton({ onClick, style }) {
  return (
    <button
      className="menu-toggle-btn"
      style={{ marginRight: '0.75rem', ...style }}
      aria-label="Toggle Navigation Menu"
      onClick={onClick}
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
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>
  );
}
