import { useEffect, useState } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell from './ViewShell.jsx';

// View: IMMUTABLE AUDIT LOG HISTORY
export default function HistoryView() {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    apiFetch('/api/audit-logs')
      .then((res) => res.json())
      .then((data) => {
        // Non-admin roles get a 403 {error} payload; like the vanilla app,
        // log it and leave the loading row in place.
        if (Array.isArray(data)) setLogs(data);
        else console.error(data);
      })
      .catch((err) => console.error(err));
  }, []);

  return (
    <ViewShell title="Universal History System">
      <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
        Every edit, access re-assignment, and approval logs an audit entry. This log provides the
        absolute tracking source of truth.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {logs === null && <div style={{ color: 'var(--muted-foreground)' }}>Loading logs...</div>}
        {logs && logs.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>No audit logs written.</div>
        )}
        {logs &&
          logs.map((l) => (
            <div key={l.id} className="glass" style={{ padding: '1rem', fontSize: '0.8rem' }}>
              <div
                className="flex-between"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  paddingBottom: '0.25rem',
                  marginBottom: '0.25rem',
                }}
              >
                <span>
                  <strong>{l.user_name}</strong> ({l.user_role})
                </span>
                <span style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(l.timestamp).toLocaleString()}
                </span>
              </div>
              <div>
                Action: <strong style={{ color: 'var(--primary)' }}>{l.action}</strong> &bull; Entity:{' '}
                <strong>
                  {l.entity_type} (#{l.entity_id})
                </strong>
              </div>
              {(l.before_state || l.after_state) && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '0.5rem',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    maxHeight: 100,
                    overflowY: 'auto',
                  }}
                >
                  {l.before_state && (
                    <div>
                      <span style={{ color: '#ef4444' }}>- Before:</span> {l.before_state}
                    </div>
                  )}
                  {l.after_state && (
                    <div>
                      <span style={{ color: '#10b981' }}>+ After:</span> {l.after_state}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>
    </ViewShell>
  );
}
