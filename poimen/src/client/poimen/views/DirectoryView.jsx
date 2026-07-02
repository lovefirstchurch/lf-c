import { useEffect, useState } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell from './ViewShell.jsx';

// View: MEMBERSHIP DIRECTORY
export default function DirectoryView() {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [list, setList] = useState(null); // null = not loaded yet

  async function runFilter(searchVal, areaVal) {
    let url = '/api/directory?';
    if (searchVal) url += `search=${encodeURIComponent(searchVal)}&`;
    if (areaVal) url += `area_id=${areaVal}&`;

    try {
      const res = await apiFetch(url);
      setList(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  // Initial run (the vanilla app triggered this via setTimeout)
  useEffect(() => {
    runFilter('', '');
  }, []);

  return (
    <ViewShell title="Membership Directory">
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <input
            type="text"
            className="form-control"
            placeholder="Search name/phone/email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-control" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">-- All Areas --</option>
            <option value="1">Area 1</option>
            <option value="2">Area 2</option>
          </select>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
          onClick={() => runFilter(search, area)}
        >
          Filter Directory
        </button>
      </div>

      <div className="glass table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Unit</th>
              <th>Governorship</th>
            </tr>
          </thead>
          <tbody>
            {list === null && (
              <tr>
                <td colSpan="4" style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>
                  Click filter to load directory.
                </td>
              </tr>
            )}
            {list && list.length === 0 && (
              <tr>
                <td colSpan="4" style={{ color: 'var(--muted-foreground)', textAlign: 'center' }}>
                  No members found matching criteria.
                </td>
              </tr>
            )}
            {list &&
              list.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                  </td>
                  <td>
                    <div>{m.phone}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{m.email || ''}</div>
                  </td>
                  <td>
                    {m.unit_name} ({m.unit_type === 'fellowship' ? 'Area 1' : 'Area 2'})
                  </td>
                  <td>{m.governorship_name}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}
