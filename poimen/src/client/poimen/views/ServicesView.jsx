import { useEffect, useState } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell from './ViewShell.jsx';

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
    <ViewShell title="Midweek Services">
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
        <StatTile label="Total Attendance" value={list ? totals.attendance : '—'} />
        <StatTile label="Total Tithers" value={list ? totals.tithers : '—'} />
        <StatTile
          label="Total Offering"
          value={list ? `GHS ${totals.offering.toLocaleString()}` : '—'}
        />
      </div>

      <div className="glass table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Unit</th>
              <th>Attendance</th>
              <th>Tithers</th>
              <th>Offering</th>
              <th>Submitted By</th>
            </tr>
          </thead>
          <tbody>
            {list === null && (
              <tr>
                <td colSpan="6" style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>
                  Loading service reports...
                </td>
              </tr>
            )}
            {list && list.length === 0 && (
              <tr>
                <td colSpan="6" style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>
                  No midweek service reports submitted yet.
                </td>
              </tr>
            )}
            {list &&
              list.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.service_date}</strong>
                  </td>
                  <td>
                    {s.unit_name}{' '}
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                      ({s.unit_type === 'fellowship' ? 'Area 1' : 'Area 2'})
                    </span>
                  </td>
                  <td>{s.attendance_count}</td>
                  <td>{s.tithers_count}</td>
                  <td>
                    {s.offering_currency || 'GHS'} {Number(s.offering_amount).toLocaleString()}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                    {s.submitter_name}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
