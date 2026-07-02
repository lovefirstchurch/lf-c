import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api.js';
import { useMinWidth } from '../../shared/useMinWidth.js';
import ViewShell from './ViewShell.jsx';

const colTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.15rem',
  color: 'var(--primary)',
  marginBottom: '0.75rem',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '0.5rem',
};

// View: ARRIVALS ADMIN CONSOLE
export default function ArrivalsAdminView() {
  const wide = useMinWidth(950);
  const [adminDate, setAdminDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [list, setList] = useState(null);
  const [config, setConfig] = useState(null);
  const [me, setMe] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);

  async function loadApprovals(dateVal) {
    try {
      const res = await apiFetch(`/api/arrivals/submissions?date=${dateVal}`);
      setList(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  async function loadConfig() {
    const cRes = await apiFetch('/api/arrivals/config');
    const configData = await cRes.json();
    setConfig(configData);

    const meRes = await apiFetch('/api/me');
    setMe(await meRes.json());
  }

  useEffect(() => {
    loadApprovals(adminDate);
  }, [adminDate]);

  useEffect(() => {
    loadConfig();
  }, []);

  async function approveHeadcount(unitId, headcount) {
    if (!headcount) return alert('Please enter verified headcount.');

    const res = await apiFetch(`/api/arrivals/approve/${unitId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headcount: parseInt(headcount),
        date: adminDate,
      }),
    });

    if (res.ok) {
      loadApprovals(adminDate);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to approve headcount');
    }
  }

  async function handleConfigSubmit(e) {
    e.preventDefault();
    const res = await apiFetch('/api/arrivals/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cutoff_time: e.target.cutoff_time.value,
        headcount_approval_required: e.target.headcount_approval_required.checked,
      }),
    });

    if (res.ok) {
      alert('Arrivals configuration updated successfully!');
      loadConfig();
    } else {
      alert('Failed to update config.');
    }
  }

  async function handleInvite() {
    const res = await apiFetch('/api/arrivals/invite-counter', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setInviteResult(data.invite_url);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create invite');
    }
  }

  const isConfigAdmin = me && (me.role === 'Chief Admin' || me.role === 'Arrivals Admin');

  return (
    <ViewShell title="Saturday Arrivals Console">
      <div className="grid-dashboard" style={{ gridTemplateColumns: wide ? '2fr 1fr' : '1fr' }}>
        {/* Left Column: Submissions Review Log */}
        <div>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--primary)' }}>
              Arrivals Approvals Panel
            </h3>
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto', padding: '0.4rem' }}
              value={adminDate}
              onChange={(e) => setAdminDate(e.target.value)}
            />
          </div>
          <div>
            {list === null && 'Loading Saturday records...'}
            {list && list.length === 0 && (
              <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '2rem' }}>
                No units registered.
              </div>
            )}
            {list &&
              list.map((item) => (
                <ApprovalCard
                  key={`${item.unit_id}:${item.status}:${item.approved_headcount ?? ''}`}
                  item={item}
                  onApprove={approveHeadcount}
                />
              ))}
          </div>
        </div>

        {/* Right Column: Configuration & invites */}
        <div>
          {/* Config */}
          <h3 style={colTitleStyle}>Arrivals Configurations</h3>
          <div className="glass" style={{ padding: '1rem', marginBottom: '2rem' }}>
            {!config && 'Loading config...'}
            {config && me && (isConfigAdmin ? (
              <form onSubmit={handleConfigSubmit} key={`${config.cutoff_time}:${config.headcount_approval_required}`}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>
                    Premobilisation Cutoff Time
                  </label>
                  <input
                    type="text"
                    name="cutoff_time"
                    className="form-control"
                    defaultValue={config.cutoff_time}
                    placeholder="e.g. 08:30"
                    required
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    name="headcount_approval_required"
                    id="checkReq"
                    defaultChecked={!!config.headcount_approval_required}
                  />
                  <label htmlFor="checkReq" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
                    Require official approvals for headcount
                  </label>
                </div>
                <button type="submit" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                  Save Configuration
                </button>
              </form>
            ) : (
              <>
                <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>Cutoff time:</span>{' '}
                  <strong>{config.cutoff_time}</strong>
                </div>
                <div style={{ fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>Headcount approval:</span>{' '}
                  <strong>{config.headcount_approval_required ? 'Required' : 'Optional'}</strong>
                </div>
              </>
            ))}
          </div>

          {/* Invite */}
          <h3 style={colTitleStyle}>Ad-Hoc Counter Invites</h3>
          <div className="glass" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
              Generate single-use token links to invite Counter agents.
            </p>
            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={handleInvite}>
              + Generate Invite Token
            </button>
            <div style={{ marginTop: '1rem', fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {inviteResult && (
                <>
                  <div style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Counter Invite Link Created:
                  </div>
                  <a
                    href={inviteResult}
                    style={{ color: '#fff', fontWeight: 'bold', textDecoration: 'underline' }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {window.location.origin + inviteResult}
                  </a>
                  <div style={{ marginTop: '0.25rem', color: 'var(--muted-foreground)' }}>
                    Click link or open in a new tab to simulate Counter agent registration.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}

function ApprovalCard({ item, onApprove }) {
  const [headcount, setHeadcount] = useState(() =>
    item.status === 'approved'
      ? String(item.approved_headcount ?? '')
      : String(item.reported_headcount ?? '')
  );

  return (
    <div className="glass" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
      <div className="flex-between">
        <div>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {item.unit_type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta'}
          </span>
          <h4 style={{ fontSize: '1.1rem', marginTop: '0.25rem' }}>{item.unit_name}</h4>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
            {item.governorship_name}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Self-Reported Count:</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
            {item.reported_headcount}
          </div>
        </div>
      </div>

      {item.premob_photo_path ? (
        <div style={{ marginTop: '0.5rem' }}>
          <img
            src={item.premob_photo_path}
            style={{
              width: 60,
              height: 60,
              objectFit: 'cover',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            alt="Premob"
          />
          <span className="badge badge-success" style={{ verticalAlign: 'top', marginLeft: '0.5rem' }}>
            Premob Submitted
          </span>
        </div>
      ) : (
        <span className="badge badge-warning">Missing Premob</span>
      )}

      {item.unit_type === 'schacenta' && item.vehicles.length > 0 && (
        <div
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <strong style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Bussing Vehicles Logged:</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
            {item.vehicles.map((v) => (
              <div
                key={v.id}
                style={{
                  fontSize: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.01)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 4,
                }}
              >
                <span>
                  Type: <strong>{v.vehicle_type}</strong>
                </span>
                <span>
                  Count: <strong>{v.headcount}</strong>
                </span>
                <img
                  src={v.photo_path}
                  style={{ width: 30, height: 20, objectFit: 'cover', borderRadius: 2 }}
                  alt=""
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {item.status === 'approved' ? (
        <>
          <div
            style={{
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(16,185,129,0.1)',
              padding: '0.5rem',
              borderRadius: 4,
            }}
          >
            <span>
              Verified Count:{' '}
              <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{item.approved_headcount}</strong>
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
              By: {item.approved_by_name || 'Counter'}
            </span>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <input
              type="number"
              className="form-control"
              style={{ width: 100, padding: '0.3rem' }}
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => onApprove(item.unit_id, headcount)}>
              Update
            </button>
          </div>
        </>
      ) : item.arrival_id ? (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            className="form-control"
            style={{ width: 120, padding: '0.4rem' }}
            placeholder="Verified count"
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={() => onApprove(item.unit_id, headcount)}>
            Verify &amp; Approve
          </button>
        </div>
      ) : (
        <div
          style={{
            marginTop: '0.75rem',
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
            fontStyle: 'italic',
          }}
        >
          Unit hasn't started arrivals ritual.
        </div>
      )}
    </div>
  );
}
