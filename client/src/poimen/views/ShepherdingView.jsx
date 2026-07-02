import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api.js';
import ViewShell from './ViewShell.jsx';

// View: SHEPHERDING ACCOUNTABILITY
export default function ShepherdingView() {
  const [list, setList] = useState(null);

  useEffect(() => {
    apiFetch('/api/shepherding/report')
      .then((res) => res.json())
      .then((data) => {
        // Non-admin roles get a 403 {error} payload; like the vanilla app,
        // log it and leave the loading row in place.
        if (Array.isArray(data)) setList(data);
        else console.error(data);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  return (
    <ViewShell title="Shepherding Accountability">
      <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
        Analytics review console showing midweek and Saturday compliance ratios over the past 4
        weeks, with performance checks against targets.
      </p>

      <div className="glass table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Unit / Type</th>
              <th>Midweek Compliance</th>
              <th>Saturday Compliance</th>
              <th>Avg Saturday Attendance</th>
              <th>Meets Targets</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list === null && (
              <tr>
                <td colSpan="6" style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>
                  Loading analytics data...
                </td>
              </tr>
            )}
            {list && list.length === 0 && (
              <tr>
                <td colSpan="6" style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>
                  No units found in your scope.
                </td>
              </tr>
            )}
            {list &&
              list.map((row) => {
                const isHealthy = row.alert === 'Healthy';
                return (
                  <tr key={row.unit_id ?? row.unit_name}>
                    <td>
                      <strong>{row.unit_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        {row.unit_type === 'fellowship' ? 'Area 1 Fellowship' : 'Area 2 Schacenta'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.midweek_compliance}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>past 4 weeks</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.arrivals_compliance}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>past 4 weeks</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{row.avg_saturday_headcount}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                        target: min {row.target_threshold}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${row.meets_targets === 'Yes' ? 'badge-success' : 'badge-danger'}`}>
                        {row.meets_targets}
                      </span>
                    </td>
                    <td>
                      {isHealthy ? (
                        <span className="badge badge-success">Healthy</span>
                      ) : (
                        <span className="badge badge-danger">Requires Review</span>
                      )}
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
