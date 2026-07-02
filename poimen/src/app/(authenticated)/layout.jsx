'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LoginGate, Sidebar, MenuToggleButton, SignOutButton, apiFetch } from '@lfc/shared';
import '../../client/poimen/poimen.css';

// Sidebar navigation entries — mirrors the production lfc app pattern
const SIDEBAR_NAV = [
  {
    path: '/',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
    ),
  },
  {
    path: '/directory',
    label: 'Directory',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  },
  {
    path: '/services',
    label: 'Services',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1z"></path>
        <line x1="9" y1="12" x2="15" y2="12"></line>
        <line x1="9" y1="16" x2="15" y2="16"></line>
      </svg>
    ),
  },
  {
    path: '/arrivals-admin',
    label: 'Arrivals',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
        <line x1="4" y1="22" x2="4" y2="15"></line>
      </svg>
    ),
  },
  {
    path: '/shepherding',
    label: 'Shepherding Control',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
  },
  {
    path: '/leaders',
    label: 'Leaders Directory',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  },
  {
    path: '/history',
    label: 'History Log',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    ),
  },
];

export default function AuthenticatedLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarUser, setSidebarUser] = useState(null);
  const [headerUserLabel, setHeaderUserLabel] = useState('Loading...');

  useEffect(() => {
    const currentUserId = localStorage.getItem('lfc_user_id') || '1';
    apiFetch('/api/users')
      .then((res) => res.json())
      .then((users) => {
        if (!Array.isArray(users)) return;
        const user = users.find((u) => u.id.toString() === currentUserId);
        if (user) {
          setHeaderUserLabel(`${user.name} (${user.role})`);
          setSidebarUser(user);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  function isActiveNav(path) {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname === path || pathname.startsWith(path + '/');
  }

  return (
    <LoginGate appName="Poimen">
      <Sidebar
        appName="Poimen"
        gradient="linear-gradient(to right, #a855f7, #3acff8)"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={sidebarUser}
      >
        {SIDEBAR_NAV.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`Sidebar-nav-link${isActiveNav(item.path) ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </Sidebar>

      {/* Fixed Top Header */}
      <div className="poimen-header">
        <div className="poimen-logo">
          <MenuToggleButton onClick={() => setSidebarOpen(true)} />
          <div className="poimen-logo-icon">
            <img src="/shared/images/love-first-logo.png" alt="Love First Church" />
          </div>
          <div className="poimen-logo-text">Poimen</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', display: 'none' }}>
            {headerUserLabel}
          </span>
          <SignOutButton />
        </div>
      </div>

      {/* Page content — standard scrollable area below the header */}
      <main className="poimen-main">
        {children}
      </main>
    </LoginGate>
  );
}
