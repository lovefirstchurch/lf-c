import { useEffect, useState } from 'react';
import { apiFetch, useMinWidth } from '@lfc/shared';
import ViewShell, { DrilldownIcon, Icons } from './ViewShell.jsx';

const colTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.15rem',
  color: 'var(--primary)',
};

// View: UNIT DETAIL (Midweek forms, member lists, and Saturday history)
export default function UnitView({ routeData }) {
  const wide = useMinWidth(900);
  const [data, setData] = useState(null);
  const [reload, setReload] = useState(0);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddMidweek, setShowAddMidweek] = useState(false);
  const [quickLeader, setQuickLeader] = useState('');
  const [showNewLeader, setShowNewLeader] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [hRes, mRes, meRes] = await Promise.all([
        apiFetch('/api/hierarchy'),
        apiFetch(`/api/units/${routeData.id}/members`),
        apiFetch('/api/me'),
      ]);
      const hierarchy = await hRes.json();
      const members = await mRes.json();
      const me = await meRes.json();

      // Find unit and its governorship in hierarchy
      let unit = null;
      let gov = null;
      for (const area of hierarchy) {
        for (const g of area.governorships) {
          const u = g.units.find((item) => item.id === routeData.id);
          if (u) {
            unit = u;
            gov = g;
            break;
          }
        }
      }

      // Determine if current user can edit unit details (Chief Admin or scope admin)
      const isScopeAdmin =
        me.role === 'Chief Admin' ||
        ((me.role === 'Governor' || me.role === 'Governorship Admin') &&
          gov &&
          me.governorship_id === gov.id);
      const isLeader = me.unit_id === routeData.id;

      // Candidate leaders for the quick leader-assignment edit
      let candidateLeaders = [];
      if (unit && isScopeAdmin) {
        const usersRes = await apiFetch('/api/users');
        const allUsers = await usersRes.json();
        const targetRole = unit.type === 'fellowship' ? 'Area 1 Shepherd' : 'Area 2 Schacenta Leader';
        // Candidates with the correct role that are not leading another unit, or the current leader
        candidateLeaders = allUsers.filter(
          (u) => (u.role === targetRole && !u.unit_id) || u.id === unit.leader_id
        );
      }

      // Midweek reports for this unit
      const mwRes = await apiFetch(`/api/midweek/submissions`);
      const mwSubmissions = await mwRes.json();
      const unitSubmissions = mwSubmissions.filter((s) => s.unit_id === routeData.id);

      // Saturday arrivals records for this unit
      const arrivalsRes = await apiFetch(`/api/arrivals/submissions`);
      const arrivals = await arrivalsRes.json();
      const unitArrivals = arrivals.filter((a) => a.unit_id === routeData.id && a.arrival_id);

      if (!cancelled) {
        setData({
          unit,
          gov,
          members,
          me,
          isScopeAdmin,
          isChiefAdmin: me.role === 'Chief Admin',
          isLeader,
          candidateLeaders,
          unitSubmissions,
          unitArrivals,
        });
        setQuickLeader(unit && unit.leader_id ? String(unit.leader_id) : '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeData.id, reload]);

  function refresh() {
    setShowAddMember(false);
    setShowAddMidweek(false);
    setReload((r) => r + 1);
  }

  async function handleQuickLeaderSave() {
    const res = await apiFetch(`/api/units/${routeData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leader_id: quickLeader ? parseInt(quickLeader) : null,
      }),
    });

    if (res.ok) {
      refresh();
    } else {
      const resData = await res.json();
      alert(resData.error || 'Failed to update leader');
    }
  }

  async function handleNewLeaderSave(e) {
    e.preventDefault();
    const res = await apiFetch('/api/leaders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: e.target.name.value,
        username: e.target.username.value,
        role: data.unit.type === 'fellowship' ? 'Area 1 Shepherd' : 'Area 2 Schacenta Leader',
        unit_id: routeData.id,
      }),
    });

    if (res.ok) {
      setShowNewLeader(false);
      refresh();
    } else {
      const resData = await res.json();
      alert(resData.error || 'Failed to create leader');
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    const res = await apiFetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: e.target.name.value,
        phone: e.target.phone.value,
        email: e.target.email.value,
        unit_id: routeData.id,
      }),
    });

    if (res.ok) {
      refresh();
    } else {
      const resData = await res.json();
      alert(resData.error || 'Failed to add member');
    }
  }

  async function reassignMember(memberId) {
    const unitsRes = await apiFetch('/api/hierarchy');
    const hierarchy = await unitsRes.json();

    let promptLines = '';
    hierarchy.forEach((area) => {
      area.governorships.forEach((g) => {
        g.units.forEach((u) => {
          if (u.id !== routeData.id) {
            promptLines += `ID ${u.id}: ${u.name} (${u.type})\n`;
          }
        });
      });
    });

    const targetUnitId = prompt('Enter Unit ID to move this member to:\n' + promptLines);
    if (!targetUnitId) return;

    const res = await apiFetch(`/api/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: parseInt(targetUnitId) }),
    });

    if (res.ok) {
      refresh();
    } else {
      const resData = await res.json();
      alert(resData.error || 'Failed to move member');
    }
  }

  async function handleAddMidweek(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const res = await apiFetch('/api/midweek/submit', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      refresh();
    } else {
      const resData = await res.json();
      alert(resData.error || 'Failed to submit midweek report');
    }
  }

  const unit = data?.unit;
  const canAddMember = data && (data.isLeader || data.isScopeAdmin);

  return (
    <ViewShell title="Unit Details">
      {/* Details block */}
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '2.5rem' }}>
        {!data && <div style={{ color: 'var(--muted-foreground)' }}>Loading unit details...</div>}
        {unit && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              {(unit.type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta').toUpperCase()}
            </div>
            <h3 style={{ fontSize: '1.3rem', color: '#fff' }}>{unit.name}</h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginTop: '1rem',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--muted-foreground)' }}>Assigned Leader:</span>
                <strong style={{ display: 'block', color: 'var(--primary)' }}>
                  {unit.leader_name || 'Unassigned'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted-foreground)' }}>Parent Governorship:</span>
                <strong style={{ display: 'block', color: 'var(--primary)' }}>
                  {data.gov ? data.gov.name : 'None'}
                </strong>
              </div>
            </div>

            {data.isScopeAdmin && (
              <div
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  paddingTop: '1rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--muted-foreground)',
                    marginBottom: '0.5rem',
                  }}
                >
                  CHANGE LEADER
                </div>
                {!showNewLeader ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      className="form-control"
                      style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      value={quickLeader}
                      onChange={(e) => setQuickLeader(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {data.candidateLeaders.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      onClick={handleQuickLeaderSave}
                    >
                      Save
                    </button>
                    {data.isChiefAdmin && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        onClick={() => setShowNewLeader(true)}
                      >
                        + New Leader
                      </button>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleNewLeaderSave}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        name="name"
                        className="form-control"
                        style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        placeholder="Full Name"
                        required
                      />
                      <input
                        type="text"
                        name="username"
                        className="form-control"
                        style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        placeholder="Username"
                        required
                      />
                      <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        onClick={() => setShowNewLeader(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Left-Right Grid for Roster & Workflow Submissions */}
      <div className="grid-dashboard" style={{ gridTemplateColumns: wide ? '1.2fr 1fr' : '1fr' }}>
        {/* Left Column: Member Roster */}
        <div>
          <div
            className="flex-between"
            style={{
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <h3 style={colTitleStyle}>Members</h3>
            {canAddMember && !showAddMember && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddMember(true)}>
                + Add Member
              </button>
            )}
          </div>

          {/* Inline Add Member Form */}
          {canAddMember && showAddMember && (
            <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>
                New Member
              </h4>
              <form onSubmit={handleAddMember}>
                <div className="form-group">
                  <input type="text" name="name" className="form-control" placeholder="Full Name" required />
                </div>
                <div className="form-group">
                  <input type="tel" name="phone" className="form-control" placeholder="Phone Number" required />
                </div>
                <div className="form-group">
                  <input type="email" name="email" className="form-control" placeholder="Email Address (Optional)" />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddMember(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save Member
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="list-tile-group">
            {!data && <div style={{ color: 'var(--muted-foreground)' }}>Loading...</div>}
            {data && data.members.length === 0 && (
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', textAlign: 'center' }}>
                No members yet.
              </div>
            )}
            {data &&
              data.members.map((m) => (
                <div key={m.id} className="list-tile">
                  <div className="list-tile-avatar">{m.name.charAt(0)}</div>
                  <div className="list-tile-body">
                    <div className="list-tile-title">{m.name}</div>
                    <div className="list-tile-subtitle">{m.phone}</div>
                  </div>
                  {data.isScopeAdmin && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => reassignMember(m.id)}
                    >
                      Move
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Right Column: Midweek & Saturday Workflows */}
        <div>
          {/* Midweek Section */}
          <div
            className="flex-between"
            style={{
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <h3 style={colTitleStyle}>Services</h3>
            {/* Only the unit leader can submit new midweek reports */}
            {data?.isLeader && !showAddMidweek && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddMidweek(true)}>
                + Report Service
              </button>
            )}
          </div>

          {/* Inline Add Midweek Form */}
          {data?.isLeader && showAddMidweek && (
            <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>
                New Service Report
              </h4>
              <form onSubmit={handleAddMidweek}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Service Date</label>
                  <input type="date" name="service_date" className="form-control" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Attendance</label>
                    <input type="number" name="attendance_count" className="form-control" min="0" placeholder="Count" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Tithers Count</label>
                    <input type="number" name="tithers_count" className="form-control" min="0" placeholder="Tithers" required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Offering Amount</label>
                    <input type="number" step="0.01" name="offering_amount" className="form-control" min="0" placeholder="Offering" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Currency</label>
                    <select name="offering_currency" className="form-control" defaultValue="GHS">
                      <option value="GHS">GHS</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Picture Evidence (Required)</label>
                  <input type="file" name="picture" accept="image/*" className="form-control" required />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Notes</label>
                  <textarea name="notes" className="form-control" rows="2" placeholder="Sermon text, testimonies, etc."></textarea>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddMidweek(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Submit Report
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="glass" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
            {!data && 'Loading midweek submissions...'}
            {data && data.unitSubmissions.length === 0 && (
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', textAlign: 'center' }}>
                No midweek services reported.
              </div>
            )}
            {data &&
              data.unitSubmissions.map((s) => (
                <div
                  key={s.id}
                  className="glass"
                  style={{ padding: '0.75rem', marginBottom: '0.5rem', fontSize: '0.8rem' }}
                >
                  <div className="flex-between" style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                    <span>Date: {s.service_date}</span>
                    <span style={{ color: 'var(--primary)' }}>Att: {s.attendance_count}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: 'var(--muted-foreground)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span>
                      Offering: {s.offering_amount} {s.offering_currency}
                    </span>
                    <span>Tithers: {s.tithers_count}</span>
                  </div>
                  <div style={{ marginTop: '0.25rem', fontStyle: 'italic', color: '#888' }}>
                    "{s.notes || ''}"
                  </div>
                  <img
                    src={s.picture_path}
                    style={{
                      width: 50,
                      height: 50,
                      objectFit: 'cover',
                      borderRadius: 4,
                      marginTop: '0.5rem',
                    }}
                    alt="Evidence Picture"
                  />
                </div>
              ))}
          </div>

          {/* Saturday Section */}
          <h3
            style={{
              ...colTitleStyle,
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            Attendance
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
            Pick a date to mark who attended.
          </p>
          <div className="glass" style={{ padding: '1.25rem' }}>
            {!data && 'Loading...'}
            {data && data.unitArrivals.length === 0 && (
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', textAlign: 'center' }}>
                No arrivals yet.
              </div>
            )}
            {data &&
              data.unitArrivals.map((a) => {
                // Postgres returns timestamps space-separated ("2026-07-02 01:17:33+00"),
                // the old sqlite data was ISO with a "T" -- handle both
                const dateVal = a.premob_submitted_at
                  ? a.premob_submitted_at.split('T')[0].split(' ')[0]
                  : 'Arrival Date';
                return (
                  <a
                    key={a.arrival_id}
                    href={`/unit/${routeData.id}/saturday/${dateVal}`}
                    className="drilldown-item glass glass-hover"
                    style={{ marginBottom: '0.5rem' }}
                  >
                    <DrilldownIcon>{Icons.calendar}</DrilldownIcon>
                    <div className="drilldown-item-body">
                      <div className="drilldown-title">{dateVal}</div>
                      <div className="drilldown-subtitle">
                        Headcount: {a.approved_headcount || 'Pending'}
                      </div>
                    </div>
                    <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem' }}>
                      TICK
                    </span>
                  </a>
                );
              })}
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
