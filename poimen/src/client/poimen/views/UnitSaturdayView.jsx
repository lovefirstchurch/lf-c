import { useEffect, useState } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell from './ViewShell.jsx';

// View: SATURDAY NAMED CHECKLIST
export default function UnitSaturdayView({ routeData }) {
  const [arrival, setArrival] = useState(undefined); // undefined = loading, null = not found
  const [ticks, setTicks] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const aRes = await apiFetch(`/api/arrivals/submissions?date=${routeData.date}`);
      const submissions = await aRes.json();

      const found = submissions.find((s) => s.unit_id === routeData.id && s.arrival_id);
      if (cancelled) return;

      if (!found) {
        setArrival(null);
        return;
      }
      setArrival(found);

      // Fetch checklist details
      const cRes = await apiFetch(`/api/arrivals/${found.arrival_id}/named-attendance`);
      const tickRows = await cRes.json();
      if (!cancelled) {
        setTicks(tickRows.map((t) => ({ ...t, present: !!t.present })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeData.id, routeData.date]);

  function toggleTick(memberId, checked) {
    setTicks((rows) => rows.map((t) => (t.member_id === memberId ? { ...t, present: checked } : t)));
  }

  async function handleSave() {
    const payloadTicks = ticks.map((t) => ({
      member_id: t.member_id,
      present: t.present,
    }));

    const saveRes = await apiFetch(`/api/arrivals/${arrival.arrival_id}/named-attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticks: payloadTicks }),
    });

    if (saveRes.ok) {
      alert('Named attendance checklist saved successfully!');
    } else {
      const data = await saveRes.json();
      alert(data.error || 'Failed to save attendance checklist.');
    }
  }

  return (
    <ViewShell title="Attendance">
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        {arrival === undefined && (
          <div style={{ color: 'var(--muted-foreground)' }}>Loading checklist...</div>
        )}
        {arrival === null && (
          <div style={{ color: 'var(--destructive)' }}>
            No arrival record for this date yet.
          </div>
        )}
        {arrival && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              ARRIVAL INFO
            </div>
            <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>
              {arrival.unit_name} &bull; {routeData.date}
            </h3>
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
                <span style={{ color: 'var(--muted-foreground)' }}>Official Count:</span>
                <strong style={{ display: 'block', color: 'var(--primary)' }}>
                  {arrival.approved_headcount || 'Pending Approval'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted-foreground)' }}>Roster Status:</span>
                <strong style={{ display: 'block', color: '#ff7a00' }}>
                  Best Effort
                </strong>
              </div>
            </div>
          </>
        )}
      </div>

      {arrival !== null && (
        <div className="glass" style={{ padding: '1.25rem' }}>
          <div>
            {ticks === null && 'Loading members list...'}
            {ticks && ticks.length === 0 && (
              <div style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>
                No members yet.
              </div>
            )}
            {ticks &&
              ticks.map((t) => (
                <div className="attendance-tick-item" key={t.member_id}>
                  <span style={{ fontWeight: 500 }}>{t.name}</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={t.present}
                      onChange={(e) => toggleTick(t.member_id, e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              ))}
          </div>
          {ticks && ticks.length > 0 && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1.5rem' }}
              onClick={handleSave}
            >
              Save
            </button>
          )}
        </div>
      )}
    </ViewShell>
  );
}
