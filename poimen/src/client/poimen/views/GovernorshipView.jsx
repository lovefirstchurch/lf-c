import { useEffect, useState } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell, { DrilldownArrow } from './ViewShell.jsx';

// View: GOVERNORSHIP (Units List)
export default function GovernorshipView({ routeData }) {
  const [data, setData] = useState(null);
  const [reload, setReload] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitLeader, setNewUnitLeader] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [hRes, uRes, meRes] = await Promise.all([
        apiFetch(`/api/hierarchy`), // to find governor name
        apiFetch(`/api/governorships/${routeData.id}/units`),
        apiFetch('/api/me'),
      ]);
      const hierarchy = await hRes.json();
      const units = await uRes.json();
      const me = await meRes.json();

      // Find governorship details
      let govDetails = null;
      for (const area of hierarchy) {
        const g = area.governorships.find((gov) => gov.id === routeData.id);
        if (g) {
          govDetails = g;
          break;
        }
      }

      // Check if user is Governor / Gov Admin / Chief Admin of this scope
      const canManage =
        me.role === 'Chief Admin' ||
        ((me.role === 'Governor' || me.role === 'Governorship Admin') &&
          me.governorship_id === routeData.id);

      let candidateLeaders = [];
      if (canManage) {
        const usersRes = await apiFetch('/api/users');
        const allUsers = await usersRes.json();
        const leaderRole =
          govDetails && govDetails.area_id === 1 ? 'Area 1 Shepherd' : 'Area 2 Schacenta Leader';
        candidateLeaders = allUsers.filter((u) => u.role === leaderRole && !u.unit_id);
      }

      if (!cancelled) setData({ govDetails, units, canManage, candidateLeaders });
    })();
    return () => {
      cancelled = true;
    };
  }, [routeData.id, reload]);

  async function handleCreateUnit(e) {
    e.preventDefault();
    const type = data.govDetails.area_id === 1 ? 'fellowship' : 'schacenta';

    const res = await apiFetch('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newUnitName,
        type,
        governorship_id: routeData.id,
        leader_id: newUnitLeader ? parseInt(newUnitLeader) : null,
      }),
    });

    if (res.ok) {
      // Reload the view's data (the vanilla app rebuilt this stack view)
      setShowAddForm(false);
      setNewUnitName('');
      setNewUnitLeader('');
      setReload((r) => r + 1);
    } else {
      const resData = await res.json();
      alert(resData.error || 'Failed to create unit');
    }
  }

  const govDetails = data?.govDetails;

  return (
    <ViewShell title="Governorship Units">
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        {!data && <div style={{ color: 'var(--muted-foreground)' }}>Loading details...</div>}
        {govDetails && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>GOVERNORSHIP</div>
            <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>{govDetails.name}</h3>
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
                <span style={{ color: 'var(--muted-foreground)' }}>Governor:</span>
                <strong style={{ display: 'block', color: 'var(--primary)' }}>
                  {govDetails.governor_name || 'Unassigned'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted-foreground)' }}>Governorship Admin:</span>
                <strong style={{ display: 'block', color: 'var(--primary)' }}>
                  {govDetails.admin_name || 'None'}
                </strong>
              </div>
            </div>
          </>
        )}
      </div>

      {data?.canManage && !showAddForm && (
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: '1.5rem' }}
          onClick={() => setShowAddForm(true)}
        >
          + Create New Unit
        </button>
      )}

      {data?.canManage && showAddForm && (
        <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--primary)' }}>
            Add New Unit
          </h4>
          <form onSubmit={handleCreateUnit}>
            <div className="form-group">
              <label className="form-label">Unit Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Grace Fellowship"
                required
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Leader Assignment</label>
              <select
                className="form-control"
                value={newUnitLeader}
                onChange={(e) => setNewUnitLeader(e.target.value)}
              >
                <option value="">-- No Leader (Assign Later) --</option>
                {data.candidateLeaders.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Create Unit
              </button>
            </div>
          </form>
        </div>
      )}

      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.1rem',
          color: 'var(--primary)',
          marginBottom: '0.5rem',
        }}
      >
        Assigned Fellowships / Schacentas
      </h3>

      <div className="drilldown-list">
        {!data && <div style={{ color: 'var(--muted-foreground)' }}>Loading units...</div>}
        {data && data.units.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '2rem' }}>
            No units created yet.
          </div>
        )}
        {data &&
          data.units.map((u) => (
            <a key={u.id} href={`/unit/${u.id}`} className="drilldown-item glass glass-hover">
              <div>
                <div className="drilldown-title">{u.name}</div>
                <div className="drilldown-subtitle">
                  Leader: <strong>{u.leader_name || 'Unassigned'}</strong>
                </div>
              </div>
              <DrilldownArrow />
            </a>
          ))}
      </div>
    </ViewShell>
  );
}
