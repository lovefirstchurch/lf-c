import { useEffect, useState } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell, { DrilldownIcon, Icons } from './ViewShell.jsx';

// View: MIDWEEK SERVICE REPORTS
// Read-only roll-up of the midweek service submissions the current user is
// scoped to see (Chief Admin/Pastors see all; Governors their governorship;
// leaders their own unit), served by GET /api/midweek/submissions.
export default function ServicesView() {
  const [list, setList] = useState(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/midweek/submissions');
        const data = await res.json();
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = (list || []).reduce(
    (acc, s) => {
      acc.attendance += s.attendance_count || 0;
      acc.offering += Number(s.offering_amount) || 0;
      acc.tithers += s.tithers_count || 0;
      return acc;
    },
    { attendance: 0, offering: 0, tithers: 0 }
  );

  return (
    <ViewShell title="Services">
      {/* Summary tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <StatTile label="Reports" value={list ? list.length : '—'} />
        <StatTile label="Attendance" value={list ? totals.attendance : '—'} />
        <StatTile label="Tithers" value={list ? totals.tithers : '—'} />
        <StatTile label="Offering" value={list ? `GHS ${totals.offering.toLocaleString()}` : '—'} />
      </div>

      <div className="list-tile-group">
        {list === null && <div style={{ color: 'var(--muted-foreground)' }}>Loading...</div>}
        {list && list.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '2rem' }}>
            No reports yet.
          </div>
        )}
        {list &&
          list.map((s) => (
            <div className="list-tile" key={s.id}>
              <DrilldownIcon>{Icons.calendar}</DrilldownIcon>
              <div className="list-tile-body">
                <div className="list-tile-title">
                  {s.unit_name} &middot; {s.service_date}
                </div>
                <div className="list-tile-subtitle">
                  {s.attendance_count} present &middot; {s.tithers_count} tithers &middot;{' '}
                  {s.offering_currency || 'GHS'} {Number(s.offering_amount).toLocaleString()}
                </div>
              </div>
              <span className="list-tile-chip">{s.submitter_name}</span>
            </div>
          ))}
      </div>
    </ViewShell>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="glass" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.35rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{value}</div>
    </div>
  );
}
