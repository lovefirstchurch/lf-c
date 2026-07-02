import { useEffect, useRef, useState } from 'react';
import { apiFetch, LoginGate, SignOutButton, Sidebar, MenuToggleButton, clearCurrentUserId } from '@lfc/shared';


const ADMIN_ROLES = ['Chief Admin', 'Resident Pastor', 'Resident Mother', 'Governorship Admin'];

const NOUNIT_TEXT =
  'You hold a leadership role but have not been assigned to run a Fellowship or Schacenta yet. Please sign in as a leader with a unit.';
const ADMIN_TEXT =
  'You are logged in with an administrative profile. Synago is the leader-facing app specifically for Saturdays, where individual unit shepherds upload premobilisation photos and record vehicles.';

// Drawer sections. Each renders one focused screen at a time instead of the
// old single packed page. Arrivals bundles the Premobilisation, Bussing, and
// Verification steps together as one ritual, rather than as separate tabs.
const NAV = [
  {
    key: 'dashboard',
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
    key: 'arrivals',
    label: 'Arrivals',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
        <line x1="4" y1="22" x2="4" y2="15"></line>
      </svg>
    ),
  },
  {
    key: 'roster',
    label: 'My Roster',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  },
];

export default function SynagoApp() {
  useEffect(() => {
    document.title = 'Synago - Saturday Arrivals Portal';
    document.body.classList.add('synago-body');
    return () => document.body.classList.remove('synago-body');
  }, []);

  return (
    <LoginGate appName="Synago">
      <SynagoDashboard />
    </LoginGate>
  );
}

function SynagoDashboard() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaderName, setLeaderName] = useState('Loading profile...');
  const [unitMeta, setUnitMeta] = useState('Checking assignments...');
  const [mode, setMode] = useState('idle'); // idle | admin | nounit | leader
  const [currentUnit, setCurrentUnit] = useState(null);
  const [rosterTitle, setRosterTitle] = useState('Fellowship Roster');
  const [members, setMembers] = useState(null);
  const [arrivalsData, setArrivalsData] = useState(null);

  const [vehicleType, setVehicleType] = useState('Bus');
  const [vehicleHeadcount, setVehicleHeadcount] = useState('');
  const premobFileRef = useRef(null);
  const vehicleFileRef = useRef(null);

  // Collapsible side drawer navigation
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarUser, setSidebarUser] = useState(null);
  const [activeNav, setActiveNav] = useState('dashboard');

  // Fetch initial profile detail for the header and sidebar, then load the
  // dashboard for the logged-in user.
  useEffect(() => {
    const currentUserId = localStorage.getItem('lfc_user_id') || '1';
    fetch('/api/users')
      .then((res) => res.json())
      .then((users) => {
        if (!Array.isArray(users)) return;
        const user = users.find((u) => u.id.toString() === currentUserId);
        if (user) {
          setLeaderName(user.name);
          setSidebarUser(user);
          loadDashboard(user, date);
        }
      })
      .catch((err) => console.error(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navTo(target) {
    setSidebarOpen(false);
    setActiveNav(target);
  }

  // Load Leader Dashboard
  async function loadDashboard(user, dateVal) {
    if (ADMIN_ROLES.includes(user.role)) {
      setMode('admin');
      setUnitMeta(`Admin Privilege (${user.role})`);
      return;
    }

    setMode('leader');

    try {
      const meRes = await apiFetch('/api/me');
      const meData = await meRes.json();

      if (!meData.unit_id) {
        setUnitMeta('No unit assigned to your leader account.');
        setMode('nounit');
        return;
      }

      loadRoster(meData.unit_id);
      loadArrivalsStatus(dateVal);
    } catch (err) {
      console.error(err);
    }
  }

  // Load Unit Member Roster
  async function loadRoster(unitId) {
    try {
      const res = await apiFetch(`/api/units/${unitId}/members`);
      const memberRows = await res.json();

      const hierarchyRes = await apiFetch('/api/hierarchy');
      const hierarchy = await hierarchyRes.json();

      let unitFound = null;
      for (const area of hierarchy) {
        for (const gov of area.governorships) {
          const unit = gov.units.find((u) => u.id === unitId);
          if (unit) {
            unitFound = unit;
            break;
          }
        }
      }

      if (unitFound) {
        setCurrentUnit(unitFound);
        const typeLabel = unitFound.type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta';
        setRosterTitle(`${unitFound.name} (${typeLabel})`);
        setUnitMeta(
          `Overseeing: ${unitFound.name} (${typeLabel}) under ${
            unitFound.governorship_id ? 'Governorship #' + unitFound.governorship_id : 'No Governorship'
          }`
        );
      }

      setMembers(memberRows);
    } catch (err) {
      console.error('Roster load failed', err);
    }
  }

  // Load Saturday Arrivals details for selected date
  async function loadArrivalsStatus(dateVal) {
    try {
      const res = await apiFetch(`/api/synago/arrivals/status?date=${dateVal}`);
      const data = await res.json();
      setArrivalsData(data);
    } catch (err) {
      console.error('Arrivals load failed', err);
    }
  }

  function handleDateChange(e) {
    const newDate = e.target.value;
    setDate(newDate);
    const userId = localStorage.getItem('lfc_user_id') || '1';
    fetch(`/api/users`)
      .then((res) => res.json())
      .then((users) => {
        if (!Array.isArray(users)) return;
        const user = users.find((u) => u.id.toString() === userId);
        if (user) loadDashboard(user, newDate);
      })
      .catch((err) => console.error(err));
  }

  // Premobilisation Form Submission
  async function handlePremobSubmit(e) {
    e.preventDefault();

    const fileInput = premobFileRef.current;
    if (!fileInput.files || fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('picture', fileInput.files[0]);
    formData.append('date', date);

    try {
      const res = await apiFetch('/api/synago/arrivals/premob', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        loadArrivalsStatus(date);
        fileInput.value = '';
      } else {
        alert(data.error || 'Failed to upload premobilisation photo');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Vehicle Form Submission (Area 2 only)
  async function handleVehicleSubmit(e) {
    e.preventDefault();

    const fileInput = vehicleFileRef.current;
    if (!fileInput.files || fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('picture', fileInput.files[0]);
    formData.append('vehicle_type', vehicleType);
    formData.append('headcount', vehicleHeadcount);
    formData.append('date', date);

    try {
      const res = await apiFetch('/api/synago/arrivals/vehicle', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        loadArrivalsStatus(date);
        setVehicleHeadcount('');
        fileInput.value = '';
      } else {
        alert(data.error || 'Failed to add vehicle row');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteVehicle(vehicleId) {
    if (!confirm('Are you sure you want to delete this vehicle log?')) return;

    try {
      const res = await apiFetch(`/api/synago/arrivals/vehicle/${vehicleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadArrivalsStatus(date);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete vehicle');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- Derived arrivals/ritual state (mirrors loadArrivalsStatus DOM updates) ---
  const data = arrivalsData;
  const premobSubmitted = !!(data && data.status !== 'not_started' && data.arrival && data.arrival.premob_photo_path);
  const cutoffTime = data ? data.config.cutoff_time : '08:30';

  let premobBadge = { text: 'Not Submitted', className: 'badge badge-warning' };
  let premobTime = '-';
  if (premobSubmitted) {
    premobTime = new Date(data.arrival.premob_submitted_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const [ch, cm] = cutoffTime.split(':').map(Number);
    const submitDate = new Date(data.arrival.premob_submitted_at);
    const isLate =
      submitDate.getHours() > ch || (submitDate.getHours() === ch && submitDate.getMinutes() > cm);
    premobBadge = isLate
      ? { text: 'Submitted Late', className: 'badge badge-danger' }
      : { text: 'Submitted On-Time', className: 'badge badge-success' };
  }

  let ritualBadge = { text: 'Pending Submission', className: 'badge' };
  let verification = { text: 'Pending Approval', color: '#ff7a00', count: '-' };
  if (data) {
    if (!premobSubmitted) {
      ritualBadge = { text: 'Pending Premobilisation', className: 'badge badge-warning' };
      verification = { text: 'Awaiting Premob', color: '#ef4444', count: '-' };
    } else if (data.arrival.status === 'approved') {
      ritualBadge = { text: 'Ritual Completed', className: 'badge badge-success' };
      verification = {
        text: 'Verified & Approved',
        color: '#10b981',
        count: data.arrival.approved_headcount,
      };
    } else {
      ritualBadge = { text: 'Pending Verification', className: 'badge badge-warning' };
      verification = { text: 'Awaiting Review', color: '#f59e0b', count: 'Pending' };
    }
  }

  const isSchacenta = currentUnit && currentUnit.type === 'schacenta';
  const vehicles = premobSubmitted ? data.vehicles || [] : [];
  const totalHeadcount = vehicles.reduce((sum, v) => sum + v.headcount, 0);

  const activeLabel = (NAV.find((n) => n.key === activeNav) || NAV[0]).label;

  return (
    <>
      <Sidebar
        appName="Synago"
        gradient="linear-gradient(to right, #ff7a00, #fd5d96)"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={sidebarUser}
      >
        {NAV.map((item) => (
          <a
            key={item.key}
            href="#"
            className={`Sidebar-nav-link${activeNav === item.key ? ' active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navTo(item.key);
            }}
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </Sidebar>

      <div className="synago-container">
        {/* Top Bar */}
        <div className="flex-between" style={{ marginBottom: '2rem' }}>
          <div className="header-logo" style={{ display: 'flex', alignItems: 'center' }}>
            <MenuToggleButton onClick={() => setSidebarOpen(true)} />
            <div className="logo-icon">
              <img src="/shared/images/love-first-logo.png" alt="Love First Church" />
            </div>
            <div className="logo-text">
              <h1>Synago</h1>
              <p>LFC Arrivals Tracker</p>
            </div>
          </div>
          <div>
            <SignOutButton />
          </div>
        </div>

        {/* User Profile Header */}
        <div
          className="glass"
          style={{
            padding: '1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>LOGGED IN AS</div>
            <h2 style={{ fontSize: '1.25rem' }}>{leaderName}</h2>
            <div style={{ fontSize: '0.85rem', color: '#ff7a00', marginTop: '0.25rem' }}>{unitMeta}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>DATE CONTEXT</div>
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.2)' }}
              value={date}
              onChange={handleDateChange}
            />
          </div>
        </div>

        {/* Admin / no-unit notice */}
        {(mode === 'admin' || mode === 'nounit') && (
          <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <h2 style={{ color: '#ff7a00', marginBottom: '1rem' }}>Administrator Account</h2>
            <p style={{ color: 'var(--muted-foreground)', maxWidth: 600, margin: '0 auto 2rem' }}>
              {mode === 'nounit' ? NOUNIT_TEXT : ADMIN_TEXT}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  clearCurrentUserId();
                  window.location.reload();
                }}
              >
                Sign In as a Unit Leader
              </button>
            </div>
          </div>
        )}

        {/* Leader workspace — one focused section at a time */}
        {mode === 'leader' && (
          <div className="synago-section">
            <div className="synago-section-head">
              <h2 className="synago-section-title">{activeLabel}</h2>
              {activeNav !== 'roster' && (
                <span
                  className={ritualBadge.className}
                  style={{ background: 'rgba(255, 122, 0, 0.15)', color: '#ff7a00' }}
                >
                  {ritualBadge.text}
                </span>
              )}
            </div>

            {/* DASHBOARD */}
            {activeNav === 'dashboard' && (
              <>
                <div className="synago-stat-grid">
                  <StatCard label="Premobilisation" value={premobBadge.text} accent="#ff7a00" />
                  <StatCard label="Ritual Status" value={ritualBadge.text} accent="#ff7a00" />
                  <StatCard label="Official Headcount" value={verification.count} accent={verification.color} />
                  <StatCard
                    label="Roster Size"
                    value={members ? members.length : '-'}
                    accent="#ff7a00"
                  />
                  {isSchacenta && (
                    <>
                      <StatCard label="Vehicles Logged" value={vehicles.length} accent="#ff7a00" />
                      <StatCard label="Self-Reported Count" value={totalHeadcount} accent="#ff7a00" />
                    </>
                  )}
                </div>

                <div className="glass dashboard-panel">
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Saturday Arrivals Ritual</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>
                    Complete premobilisation before the cutoff (<strong>{cutoffTime}</strong>)
                    {isSchacenta ? ', log your bussing vehicles' : ''}, and a Counter will record the official
                    headcount.
                  </p>
                  <button className="btn btn-synago btn-sm" onClick={() => navTo('arrivals')}>
                    Go to Arrivals Ritual
                  </button>
                </div>
              </>
            )}

            {/* ARRIVALS: Premobilisation, Bussing, and Verification as one ritual */}
            {activeNav === 'arrivals' && (
              <>
                {/* Step 1: Premobilisation */}
                <div className="glass dashboard-panel ritual-step active">
                  <div className="ritual-step-num">1</div>
                  <div className="ritual-step-title">
                    Premobilisation Photo
                    <span className={premobBadge.className} style={{ marginLeft: 'auto' }}>
                      {premobBadge.text}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>
                    Upload one photo of your unit gathering before the cutoff time (<strong>{cutoffTime}</strong>).
                  </p>

                  {!premobSubmitted ? (
                    <form onSubmit={handlePremobSubmit}>
                      <div className="form-group">
                        <input
                          type="file"
                          name="picture"
                          ref={premobFileRef}
                          accept="image/*"
                          className="form-control"
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-synago" style={{ width: '100%' }}>
                        Upload Premobilisation Photo
                      </button>
                    </form>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-foreground)' }}>Submitted At:</span>
                        <span style={{ fontWeight: 600 }}>{premobTime}</span>
                      </div>
                      <img src={data.arrival.premob_photo_path} className="photo-preview" alt="Premobilisation" />
                    </div>
                  )}
                </div>

                {/* Step 2: On-the-way (Bussing) — Area 2 only */}
                <div className={`glass dashboard-panel ritual-step${isSchacenta ? ' active' : ''}`}>
                  <div className="ritual-step-num">2</div>
                  <div className="ritual-step-title">
                    On-the-way Bussing
                    {isSchacenta && arrivalsData && (
                      <span className="badge badge-info" style={{ marginLeft: 'auto' }}>
                        {vehicles.length} Vehicles
                      </span>
                    )}
                  </div>

                  {!isSchacenta ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                      On-the-way vehicle photo logs and transport records are only required for <strong>Area 2
                      Schacentas</strong>. Area 1 Fellowships proceed directly to counter verification.
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>
                        Add one photo and headcount per transport vehicle carrying members to church.
                      </p>

                      <div style={{ marginBottom: '1.5rem' }}>
                        {vehicles.length === 0 ? (
                          <div
                            style={{
                              color: 'var(--muted-foreground)',
                              fontSize: '0.85rem',
                              textAlign: 'center',
                              padding: '1rem 0',
                            }}
                          >
                            No vehicles logged for this arrival.
                          </div>
                        ) : (
                          <>
                            {vehicles.map((v) => (
                              <div className="vehicle-row" key={v.id}>
                                <div className="vehicle-info">
                                  <img src={v.photo_path} className="vehicle-thumb" alt="Vehicle" />
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{v.vehicle_type}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                      Headcount: <strong>{v.headcount}</strong>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                  onClick={() => deleteVehicle(v.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                padding: '0.75rem 0',
                                borderTop: '1px solid var(--border)',
                                marginTop: '0.5rem',
                              }}
                            >
                              <span>Total Self-Reported Count:</span>
                              <span style={{ color: '#ff7a00' }}>{totalHeadcount}</span>
                            </div>
                          </>
                        )}
                      </div>

                      <div
                        className="glass"
                        style={{
                          padding: '1rem',
                          border: '1px dashed rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.1)',
                        }}
                      >
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#ff7a00' }}>
                          Add Vehicle Transport
                        </h4>
                        <form onSubmit={handleVehicleSubmit}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '0.75rem',
                              marginBottom: '0.75rem',
                            }}
                          >
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem' }}>
                                Vehicle Type
                              </label>
                              <select
                                name="vehicle_type"
                                className="form-control"
                                required
                                value={vehicleType}
                                onChange={(e) => setVehicleType(e.target.value)}
                              >
                                <option value="Bus">Bus</option>
                                <option value="Sprinter">Sprinter</option>
                                <option value="Taxi">Taxi</option>
                                <option value="Private">Private</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem' }}>
                                Headcount
                              </label>
                              <input
                                type="number"
                                name="headcount"
                                className="form-control"
                                placeholder="Number of occupants"
                                min="1"
                                required
                                value={vehicleHeadcount}
                                onChange={(e) => setVehicleHeadcount(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>
                              Vehicle Photo
                            </label>
                            <input
                              type="file"
                              name="picture"
                              ref={vehicleFileRef}
                              accept="image/*"
                              className="form-control"
                              required
                            />
                          </div>
                          <button type="submit" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                            Add Vehicle Row
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>

                {/* Step 3: Counter Verification */}
                <div className="glass dashboard-panel ritual-step">
                  <div className="ritual-step-num">3</div>
                  <div className="ritual-step-title">Counter Verification &amp; Official Count</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
                    An Arrivals Admin or Counter will review your submission and record the verified headcount.
                    <strong> This is the official Saturday attendance figure.</strong>
                  </p>

                  <div
                    className="flex-between"
                    style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)' }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>APPROVAL STATUS</div>
                      <div style={{ fontWeight: 700, color: verification.color, marginTop: '0.25rem' }}>
                        {verification.text}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>OFFICIAL HEADCOUNT</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ff7a00' }}>{verification.count}</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ROSTER */}
            {activeNav === 'roster' && (
              <div className="glass dashboard-panel">
                <h3
                  style={{
                    fontSize: '1.1rem',
                    marginBottom: '1.25rem',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.75rem',
                  }}
                >
                  {rosterTitle}
                </h3>
                <div>
                  {members && members.length === 0 && (
                    <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '2rem' }}>
                      No active members registered in this unit roster. Add them in Poimen.
                    </div>
                  )}
                  {members &&
                    members.map((m) => (
                      <div className="member-list-item" key={m.id}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{m.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                            {m.email || 'No Email'}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>{m.phone}</div>
                      </div>
                    ))}
                  {members === null && (
                    <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '2rem' }}>
                      Loading roster...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="glass" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.4rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}
