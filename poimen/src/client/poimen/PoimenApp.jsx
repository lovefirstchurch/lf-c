import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { LoginGate, SignOutButton, Sidebar, MenuToggleButton, setCurrentUserId } from '@lfc/shared';
import RootView from './views/RootView.jsx';
import AreaView from './views/AreaView.jsx';
import GovernorshipView from './views/GovernorshipView.jsx';
import UnitView from './views/UnitView.jsx';
import UnitSaturdayView from './views/UnitSaturdayView.jsx';
import DirectoryView from './views/DirectoryView.jsx';
import ArrivalsAdminView from './views/ArrivalsAdminView.jsx';
import ShepherdingView from './views/ShepherdingView.jsx';
import HistoryView from './views/HistoryView.jsx';


// The vanilla app used "/" as the root view's URL; the React port uses
// /poimen so the landing page route at "/" stays reachable. All drill-down
// paths (/area/1, /unit/3, /directory, ...) are unchanged.
export const ROOT_PATH = '/poimen';

// --- ROUTING / PATH RESOLUTION (ported from public/poimen/app.js) ---
export function resolveUrl(urlPath) {
  if (urlPath === '/' || urlPath === '' || urlPath.startsWith('/poimen')) {
    return { type: 'root' };
  }

  let match;
  if ((match = urlPath.match(/^\/area\/(\d+)$/))) {
    return { type: 'area', id: parseInt(match[1]) };
  }
  if ((match = urlPath.match(/^\/governorship\/(\d+)$/))) {
    return { type: 'governorship', id: parseInt(match[1]) };
  }
  if ((match = urlPath.match(/^\/unit\/(\d+)$/))) {
    return { type: 'unit', id: parseInt(match[1]) };
  }
  if ((match = urlPath.match(/^\/unit\/(\d+)\/saturday\/([\d-]+)$/))) {
    return { type: 'unit_saturday', id: parseInt(match[1]), date: match[2] };
  }
  if (urlPath === '/directory') return { type: 'directory' };
  if (urlPath === '/arrivals-admin') return { type: 'arrivals_admin' };
  if (urlPath === '/shepherding') return { type: 'shepherding' };
  if (urlPath === '/history') return { type: 'history' };

  return null;
}

export default function PoimenApp() {
  useEffect(() => {
    document.title = 'Poimen - Church Administration Portal';
  }, []);

  return (
    <LoginGate appName="Poimen">
      <PoimenConsole />
    </LoginGate>
  );
}

// Sidebar navigation entries (ported from the drawer added to
// public/poimen/index.html). data-path semantics: '/' is the root view,
// which lives at /poimen in this port.
const SIDEBAR_NAV = [
  {
    path: '/',
    label: 'Hierarchy Explorer',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    ),
  },
  {
    path: '/directory',
    label: 'Membership Directory',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  },
  {
    path: '/arrivals-admin',
    label: 'Arrivals Admin Console',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
        <line x1="16" y1="8" x2="20" y2="8"></line>
        <line x1="16" y1="12" x2="20" y2="12"></line>
        <line x1="16" y1="16" x2="20" y2="16"></line>
      </svg>
    ),
  },
  {
    path: '/shepherding',
    label: 'Shepherding Accountability',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
  },
  {
    path: '/history',
    label: 'Universal History Log',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    ),
  },
];

function PoimenConsole() {
  const navigate = useNavigate();
  const location = useLocation();
  const [headerUserLabel, setHeaderUserLabel] = useState('Loading...');
  // Bumping this key remounts the stack from the root view, mirroring the
  // vanilla app's rebuildStack() after a user switch or sidebar navigation.
  const [stackKey, setStackKey] = useState(0);
  // Path the freshly rebuilt stack should immediately drill into (the
  // vanilla navigateFromSidebar did rebuildStack() + drillDown(path)).
  const [pendingDrill, setPendingDrill] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarUser, setSidebarUser] = useState(null);

  // Fetch initial profile detail for the header label and sidebar
  useEffect(() => {
    const currentUserId = localStorage.getItem('lfc_user_id') || '1';
    fetch('/api/users')
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

  function navigateFromSidebar(path) {
    setSidebarOpen(false);
    navigate(ROOT_PATH, { replace: true, state: { depth: 0 } });
    setPendingDrill(path === '/' ? null : path);
    setStackKey((k) => k + 1);
  }

  function isActiveNav(path) {
    if (path === '/') {
      return location.pathname === '/' || resolveUrl(location.pathname)?.type === 'root';
    }
    return location.pathname === path;
  }

  return (
    <>
      <Sidebar
        appName="Poimen"
        gradient="linear-gradient(to right, #a855f7, #3acff8)"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={sidebarUser}
      >
        {SIDEBAR_NAV.map((item) => (
          <a
            key={item.path}
            href={item.path === '/' ? ROOT_PATH : item.path}
            className={`Sidebar-nav-link${isActiveNav(item.path) ? ' active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigateFromSidebar(item.path);
            }}
          >
            {item.icon}
            {item.label}
          </a>
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
          <a href="/synago" className="btn btn-secondary btn-sm">
            Switch to Synago (App 1)
          </a>
          <SignOutButton />
        </div>
      </div>

      <PoimenStack key={stackKey} initialDrill={pendingDrill} />


      <InviteWatcher />
    </>
  );
}

// --- STACK ROUTER NAVIGATION ENGINE (ported from public/poimen/app.js) ---
// Horizontal CSS scroll-snap stack: each drill-down appends a view and the
// browser history depth tracks which view is active.
function PoimenStack({ initialDrill }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  const keyCounter = useRef(1);
  const [stack, setStack] = useState(() => [
    { depth: 0, urlPath: window.location.pathname, key: 0 },
  ]);
  const [currentDepth, setCurrentDepth] = useState(0);

  const stackStateRef = useRef(stack);
  stackStateRef.current = stack;
  const currentDepthRef = useRef(0);

  // Remembers the urlPath at each history depth so views trimmed after a
  // back-swipe can be rebuilt when navigating forward again (the vanilla
  // app kept these as entriesByDepth entries with view = null).
  const urlByDepth = useRef(new Map([[0, window.location.pathname]]));
  const stackEl = useRef(null);
  const pendingBehaviorRef = useRef(null);
  const compensatePrependRef = useRef(false);
  const returnFocusRef = useRef(new WeakMap());
  const didInitRef = useRef(false);
  // While a programmatic scroll is in flight, snap/intersection events can
  // still arrive for the view we are leaving (notably the freshly-observed
  // root right after a rebuild+drill); acting on them would trim the new
  // view and pop history. Track the scroll target so stale events are
  // ignored (time-bounded, so an interrupted animation can't wedge us).
  const scrollTargetRef = useRef(null);

  function setDepth(d) {
    currentDepthRef.current = d;
    setCurrentDepth(d);
  }

  function updateFromHistoryState(state, behaviorOverride) {
    const newDepth = state?.depth ?? 0;
    const urlPath = window.location.pathname;

    if (urlByDepth.current.get(newDepth) !== urlPath) {
      urlByDepth.current.set(newDepth, urlPath);
    }

    setStack((s) => {
      // Drop a stale view at this depth if the URL changed underneath it
      let next = s.filter((v) => !(v.depth === newDepth && v.urlPath !== urlPath));
      // Rebuild any views missing between root and the destination depth
      for (let d = 0; d <= newDepth; d++) {
        if (next.some((v) => v.depth === d)) continue;
        const u = urlByDepth.current.get(d);
        if (u == null || !resolveUrl(u)) continue;
        next = [...next, { depth: d, urlPath: u, key: keyCounter.current++ }];
      }
      return next;
    });

    setDepth(newDepth);
    if (behaviorOverride) pendingBehaviorRef.current = behaviorOverride;
  }

  function drillDown(urlPath) {
    if (!resolveUrl(urlPath)) return;
    const newDepth = currentDepthRef.current + 1;

    for (const d of [...urlByDepth.current.keys()]) {
      if (d >= newDepth) urlByDepth.current.delete(d);
    }
    urlByDepth.current.set(newDepth, urlPath);

    setStack((s) => [
      ...s.filter((v) => v.depth < newDepth),
      { depth: newDepth, urlPath, key: keyCounter.current++ },
    ]);
    setDepth(newDepth);
    pendingBehaviorRef.current = 'auto'; // CSS scroll-behavior handles smoothing
    navigate(urlPath, { state: { depth: newDepth } });
  }

  function goBack() {
    const depth0Url = urlByDepth.current.get(0);
    const atDeepLinkRoot =
      currentDepthRef.current === 0 && resolveUrl(depth0Url ?? '/')?.type !== 'root';
    if (atDeepLinkRoot) {
      synthesizeRootEntry();
    } else {
      navigate(-1);
    }
  }

  // Deep-linked views have no root behind them in history; pressing back
  // pushes a synthesized root entry ahead instead (ported behavior).
  function synthesizeRootEntry() {
    const newDepth = currentDepthRef.current + 1;
    urlByDepth.current.set(newDepth, ROOT_PATH);

    const hasRoot = stackStateRef.current.some((v) => resolveUrl(v.urlPath)?.type === 'root');
    if (!hasRoot) {
      setStack((s) => [{ depth: newDepth, urlPath: ROOT_PATH, key: keyCounter.current++ }, ...s]);
      compensatePrependRef.current = true;
    } else {
      setStack((s) =>
        s.map((v) => (resolveUrl(v.urlPath)?.type === 'root' ? { ...v, depth: newDepth } : v))
      );
    }
    setDepth(newDepth);
    navigate(ROOT_PATH, { state: { depth: newDepth } });
  }

  // Init: mirror the vanilla app's history.replaceState({ depth: 0 }, '')
  useEffect(() => {
    navigate(location.pathname + location.search + location.hash, {
      replace: true,
      state: { depth: 0 },
    });
    didInitRef.current = true;
    // Sidebar navigation rebuilds the stack at the root and immediately
    // drills into the chosen section (vanilla navigateFromSidebar).
    if (initialDrill) drillDown(initialDrill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browser back/forward
  useEffect(() => {
    if (!didInitRef.current) return;
    if (navigationType !== 'POP') return;
    updateFromHistoryState(location.state ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Scroll the stack viewport to the active view after renders
  useLayoutEffect(() => {
    const el = stackEl.current;
    if (!el) return;

    if (compensatePrependRef.current) {
      // A view was prepended; keep the viewport visually in place
      el.scrollLeft += el.clientWidth;
      compensatePrependRef.current = false;
    }

    const toIdx = stack.findIndex((v) => v.depth === currentDepth);
    if (toIdx < 0) return;
    const fromIdx = Math.round(el.scrollLeft / el.clientWidth);
    if (fromIdx === toIdx) {
      pendingBehaviorRef.current = null;
      return;
    }

    const forward = toIdx > fromIdx;
    const multiStep = Math.abs(toIdx - fromIdx) > 1;
    const behavior = pendingBehaviorRef.current ?? (forward || multiStep ? 'instant' : 'auto');
    pendingBehaviorRef.current = null;
    scrollTargetRef.current = { idx: toIdx, at: performance.now() };
    el.scrollTo({ left: toIdx * el.clientWidth, behavior });
  }, [stack, currentDepth]);

  // When the snapped view settles (back-swipe or programmatic), trim any
  // views after it and re-sync history depth, as the vanilla app did.
  const onActiveViewChangedRef = useRef(() => {});
  onActiveViewChangedRef.current = (viewEl) => {
    const el = stackEl.current;
    if (!el || !viewEl) return;
    const idx = [...el.children].indexOf(viewEl);
    const st = stackStateRef.current;
    if (idx < 0 || idx >= st.length) return;

    const target = scrollTargetRef.current;
    if (target != null) {
      if (idx !== target.idx && performance.now() - target.at < 1500) {
        return; // stale event from the view we are scrolling away from
      }
      scrollTargetRef.current = null;
    }

    const entry = st[idx];

    if (st.length > idx + 1) {
      setStack((s) => s.slice(0, idx + 1));
    }

    if (entry.depth !== currentDepthRef.current) {
      navigate(entry.depth - currentDepthRef.current);
    }

    const stored = returnFocusRef.current.get(viewEl);
    if (stored) {
      stored.focus({ preventScroll: true });
      returnFocusRef.current.delete(viewEl);
    } else if (resolveUrl(entry.urlPath)?.type !== 'root') {
      viewEl.querySelector('.back')?.focus({ preventScroll: true });
    }
  };

  useEffect(() => {
    const el = stackEl.current;
    if (!el) return;
    const handler = (viewEl) => onActiveViewChangedRef.current(viewEl);

    if ('onscrollsnapchange' in HTMLElement.prototype) {
      const listener = (event) => handler(event.snapTargetInline);
      el.addEventListener('scrollsnapchange', listener);
      return () => el.removeEventListener('scrollsnapchange', listener);
    }

    // IntersectionObserver fallback
    const viewObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio === 1) handler(entry.target);
        }
      },
      { root: el, threshold: 1 }
    );
    const mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.classList?.contains('Stack-view')) viewObserver.observe(node);
        }
        for (const node of m.removedNodes) {
          if (node.classList?.contains('Stack-view')) viewObserver.unobserve(node);
        }
      }
    });
    mutationObserver.observe(el, { childList: true });
    for (const view of el.children) viewObserver.observe(view);

    return () => {
      viewObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // Delegated click handling: back buttons and drill-down links
  function handleStackClick(e) {
    if (e.target.closest('.back')) {
      goBack();
      return;
    }

    const link = e.target.closest('a');
    if (!link || !stackEl.current || !stackEl.current.contains(link)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

    const urlPath = new URL(link.href).pathname;
    const parentView = link.closest('.Stack-view');

    if (!resolveUrl(urlPath) || !parentView) return;

    e.preventDefault();
    returnFocusRef.current.set(parentView, link);
    drillDown(urlPath);
  }

  return (
    <div className="Stack" ref={stackEl} onClick={handleStackClick}>
      {stack.map((v) => (
        <StackView key={v.key} urlPath={v.urlPath} inert={v.depth !== currentDepth} />
      ))}
    </div>
  );
}

function StackView({ urlPath, inert }) {
  const routeData = resolveUrl(urlPath) ?? { type: 'root' };

  let content;
  switch (routeData.type) {
    case 'area':
      content = <AreaView routeData={routeData} />;
      break;
    case 'governorship':
      content = <GovernorshipView routeData={routeData} />;
      break;
    case 'unit':
      content = <UnitView routeData={routeData} />;
      break;
    case 'unit_saturday':
      content = <UnitSaturdayView routeData={routeData} />;
      break;
    case 'directory':
      content = <DirectoryView />;
      break;
    case 'arrivals_admin':
      content = <ArrivalsAdminView />;
      break;
    case 'shepherding':
      content = <ShepherdingView />;
      break;
    case 'history':
      content = <HistoryView />;
      break;
    default:
      content = <RootView />;
  }

  return (
    <div className="Stack-view" inert={inert || undefined}>
      {content}
    </div>
  );
}

// --- AD-HOC COUNTER ACCEPT INVITE (ported from public/poimen/app.js) ---
// Watches the location hash for #invite/cnt-... tokens.
function InviteWatcher() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    function checkHashInvite() {
      const match = window.location.hash.match(/^#invite\/(cnt-[\d-]+)$/);
      if (match) setToken(match[1]);
    }
    window.addEventListener('hashchange', checkHashInvite);
    checkHashInvite();
    return () => window.removeEventListener('hashchange', checkHashInvite);
  }, []);

  if (!token) return null;
  return <InviteModal token={token} />;
}

function InviteModal({ token }) {
  async function handleSubmit(e) {
    e.preventDefault();
    const name = e.target.name.value;
    const username = e.target.username.value;

    const res = await fetch('/api/arrivals/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, username }),
    });

    const data = await res.json();
    if (res.ok) {
      alert(`Successfully registered! Welcome, ${name}.`);
      setCurrentUserId(data.user.id);
      window.location.hash = ''; // Clear hash
      window.location.reload(); // Reload context
    } else {
      alert(data.error || 'Failed to complete registration.');
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="glass" style={{ width: 400, padding: '2rem', margin: '1rem' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--primary)',
            marginBottom: '0.5rem',
          }}
        >
          Counter Registration
        </h3>
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
            marginBottom: '1.5rem',
          }}
        >
          You have been invited to act as a Saturday Counter agent. Please register your profile
          details below.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              name="name"
              className="form-control"
              placeholder="e.g. Albert Sowah"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              name="username"
              className="form-control"
              placeholder="e.g. albert_counter"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Complete Registration
          </button>
        </form>
      </div>
    </div>
  );
}
