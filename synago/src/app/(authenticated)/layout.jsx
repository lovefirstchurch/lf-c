'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LoginGate, apiFetch, clearCurrentUserId } from '@lfc/shared';
import {
  Home,
  PlaneLanding,
  Users,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', href: '/', exact: true, icon: Home },
  { label: 'Arrivals', href: '/arrivals', icon: PlaneLanding },
  { label: 'Members', href: '/members', icon: Users },
];

export default function AuthenticatedLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Add synago body class
    document.body.classList.add('synago-body');
    
    // Fetch profile
    apiFetch('/api/me')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not logged in');
      })
      .then((data) => {
        setUser(data);
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      document.body.classList.remove('synago-body');
    };
  }, []);

  const fullName = user?.name || 'Leader';
  const roleLabel = user?.role
    ? user.role.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Unit Leader';

  const handleLogout = () => {
    clearCurrentUserId();
    window.location.reload();
  };

  const isItemActive = (item) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
  };

  const renderSidebarContent = (isMobileView) => (
    <div className="flex flex-col h-full bg-[#161a23]">
      {/* Sidebar Header */}
      <div className="flex justify-between items-center p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#FF7A00]/10 flex items-center justify-center border border-[#FF7A00]/20 overflow-hidden">
            <img src="/shared/images/love-first-logo.png" alt="LFC" className="h-7 w-7 object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white text-sm leading-tight">Love First</span>
            <span className="text-[10px] text-[#FF7A00] font-bold uppercase tracking-widest leading-tight">Synago</span>
          </div>
        </div>
        {isMobileView && (
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-white/40 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation items */}
      <nav className="flex flex-col px-4 py-6 space-y-2 flex-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 mb-2">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobileView && setIsSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/20'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-[#FF7A00]' : 'text-white/50'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer / User Profile info */}
      <div className="flex items-center p-4 bg-[#252a36] border-t border-white/5">
        <div className="flex items-center flex-1 min-w-0 gap-3">
          <div className="h-10 w-10 rounded-full bg-[#1e2330] flex items-center justify-center text-white font-bold text-sm shrink-0">
            {fullName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-bold text-white truncate">{fullName}</p>
            <p className="text-[11px] text-[#FF7A00]/90 font-bold uppercase tracking-wider truncate mt-0.5">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg bg-[#333946] text-white/70 hover:bg-[#404654] hover:text-white transition-colors shrink-0 ml-2"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <LoginGate appName="Synago">
      <div className="min-h-screen bg-[#0d1117] flex flex-col">
        {/* Desktop Sidebar (lg screens) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 lg:z-40 bg-[#161a23] border-r border-white/5 shadow-2xl">
          {renderSidebarContent(false)}
        </aside>

        {/* Mobile Drawer Sidebar */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <div
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <div className="relative flex w-80 max-w-sm flex-col bg-[#161a23] z-50 animate-in slide-in-from-left duration-200">
              {renderSidebarContent(true)}
            </div>
          </div>
        )}

        <div className="lg:pl-72 flex flex-col flex-1 min-h-screen">
          {/* Top Mobile Header */}
          <header className="sticky top-0 z-40 border-b border-[#FF7A00]/15 bg-[#0d1117]/80 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 rounded-xl bg-white/5 border border-white/5 text-white active:scale-95 transition-transform"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Synago</span>
                  <span className="text-[10px] text-[#FF7A00]/80 font-bold uppercase tracking-wider mt-0.5">{roleLabel}</span>
                </div>
              </div>

              <div className="h-8 w-8 rounded-full bg-[#FF7A00]/10 flex items-center justify-center text-[#FF7A00] font-bold text-xs">
                {fullName.charAt(0)}
              </div>
            </div>
          </header>

          {/* Main page content area */}
          <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6 pb-24 lg:pb-6">
            {children}
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-white/10 bg-[#0d1117]/90 backdrop-blur-md lg:hidden pb-safe">
            {NAV_ITEMS.map((item) => {
              const isActive = isItemActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs font-semibold"
                >
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-[#FF7A00] text-black' : 'text-white/50'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={isActive ? 'text-[#FF7A00]' : 'text-white/50'}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </LoginGate>
  );
}
