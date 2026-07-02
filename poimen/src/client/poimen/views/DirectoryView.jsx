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
    <ViewShell title="Directory">
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
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-control" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All Areas</option>
            <option value="1">Area 1</option>
            <option value="2">Area 2</option>
          </select>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
          onClick={() => runFilter(search, area)}
        >
          Filter
        </button>
      </div>

      <div className="list-tile-group">
        {list === null && (
          <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '2rem' }}>
            Loading...
          </div>
        )}
        {list && list.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '2rem' }}>
            No members found.
          </div>
        )}
        {list &&
          list.map((m) => (
            <a href={`/member/${m.id}`} className="list-tile" key={m.id}>
              <div className="list-tile-avatar">{m.name.charAt(0)}</div>
              <div className="list-tile-body">
                <div className="list-tile-title">{m.name}</div>
                <div className="list-tile-subtitle">
                  {m.phone}
                  {m.email ? ` · ${m.email}` : ''}
                </div>
              </div>
              <span className="list-tile-chip">{m.unit_name}</span>
            </a>
          ))}
      </div>
    </ViewShell>
  );
}
