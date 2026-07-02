import { useState, useEffect } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell from './ViewShell.jsx';

export default function LeadersView() {
  const [users, setUsers] = useState(null);
  const [hierarchy, setHierarchy] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add leader form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    role: 'Area 1 Shepherd',
    governorship_id: '',
    unit_id: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, hierarchyRes, meRes] = await Promise.all([
        apiFetch('/api/users'),
        apiFetch('/api/hierarchy'),
        apiFetch('/api/me')
      ]);

      if (!usersRes.ok || !hierarchyRes.ok || !meRes.ok) {
        throw new Error('Failed to load leaders or hierarchy settings');
      }

      const usersData = await usersRes.json();
      const hierarchyData = await hierarchyRes.json();
      const meData = await meRes.json();

      setUsers(usersData);
      setHierarchy(hierarchyData);
      setCurrentUser(meData);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <ViewShell title="Leaders Directory">
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          Loading leaders...
        </div>
      </ViewShell>
    );
  }

  if (error) {
    return (
      <ViewShell title="Leaders Directory">
        <div className="glass" style={{ padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <p style={{ color: '#f87171', fontWeight: 600 }}>Error Loading Directory</p>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={loadData}>Retry</button>
        </div>
      </ViewShell>
    );
  }

  // Flatten governorships and units from hierarchy for display mapping & select inputs
  const govMap = {};
  const unitMap = {};
  const govsList = [];
  const unitsList = [];

  if (hierarchy) {
    hierarchy.forEach(area => {
      area.governorships.forEach(gov => {
        govMap[gov.id] = gov.name;
        govsList.push(gov);
        gov.units.forEach(unit => {
          unitMap[unit.id] = `${unit.name} (${unit.type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta'})`;
          unitsList.push(unit);
        });
      });
    });
  }

  const isChiefAdmin = currentUser?.role === 'Chief Admin';

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      const payload = {
        name: form.name,
        username: form.username.trim().toLowerCase(),
        role: form.role,
        governorship_id: (form.role === 'Governor' || form.role === 'Governorship Admin') && form.governorship_id ? parseInt(form.governorship_id) : undefined,
        unit_id: (form.role === 'Area 1 Shepherd' || form.role === 'Area 2 Schacenta Leader') && form.unit_id ? parseInt(form.unit_id) : undefined
      };

      const res = await apiFetch('/api/leaders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create leader');
      }

      alert('Leader successfully onboarded! Default password is: LoveFirst@123');
      setForm({
        name: '',
        username: '',
        role: 'Area 1 Shepherd',
        governorship_id: '',
        unit_id: ''
      });
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ViewShell title="Leaders Directory">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: 0 }}>
          Manage church shepherding and administrative accounts.
        </p>
        
        {isChiefAdmin && !showAddForm && (
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            + Onboard New Leader
          </button>
        )}
      </div>

      {isChiefAdmin && showAddForm && (
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '1rem', fontWeight: 700 }}>
            Onboard New Leader Account
          </h3>
          <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Pastor Kofi Mensah"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. kofi_mensah"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-control"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value, governorship_id: '', unit_id: '' })}
                >
                  <option value="Chief Admin">Chief Admin</option>
                  <option value="Resident Pastor">Resident Pastor</option>
                  <option value="Resident Mother">Resident Mother</option>
                  <option value="Governor">Governor</option>
                  <option value="Governorship Admin">Governorship Admin</option>
                  <option value="Area 1 Shepherd">Area 1 Shepherd</option>
                  <option value="Area 2 Schacenta Leader">Area 2 Schacenta Leader</option>
                  <option value="Arrivals Admin">Arrivals Admin</option>
                  <option value="Counter">Counter</option>
                </select>
              </div>

              {/* Conditional input based on selected role */}
              {(form.role === 'Governor' || form.role === 'Governorship Admin') && (
                <div className="form-group">
                  <label className="form-label">Governorship Assignment</label>
                  <select
                    className="form-control"
                    value={form.governorship_id}
                    onChange={(e) => setForm({ ...form, governorship_id: e.target.value })}
                    required
                  >
                    <option value="">-- Select Governorship --</option>
                    {govsList.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(form.role === 'Area 1 Shepherd' || form.role === 'Area 2 Schacenta Leader') && (
                <div className="form-group">
                  <label className="form-label">Unit Assignment</label>
                  <select
                    className="form-control"
                    value={form.unit_id}
                    onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                    required
                  >
                    <option value="">-- Select Fellowship / Schacenta --</option>
                    {unitsList.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddForm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Onboard Leader'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leaders Table */}
      <div className="glass table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Leader / Username</th>
              <th>System Role</th>
              <th>Assigned Scope</th>
            </tr>
          </thead>
          <tbody>
            {users && users.length === 0 && (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>
                  No leaders registered.
                </td>
              </tr>
            )}
            {users && users.map((u) => {
              let scopeText = 'Global';
              if (u.governorship_id) {
                scopeText = `Governorship: ${govMap[u.governorship_id] || u.governorship_id}`;
              } else if (u.unit_id) {
                scopeText = `Unit: ${unitMap[u.unit_id] || u.unit_id}`;
              }
              
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>@{u.username}</div>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: u.role === 'Chief Admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: u.role === 'Chief Admin' ? '#c084fc' : 'var(--foreground)',
                      border: `1px solid ${u.role === 'Chief Admin' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.08)'}`
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: scopeText === 'Global' ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                    {scopeText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}
