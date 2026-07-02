import { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api.js';
import ViewShell, { DrilldownArrow } from './ViewShell.jsx';

// View: AREA (Governorships List)
export default function AreaView({ routeData }) {
  const areaName =
    routeData.id === 1 ? 'Area 1 (Trinity Fellowship)' : 'Area 2 (Grace Schacenta)';
  const [govs, setGovs] = useState(null);

  useEffect(() => {
    apiFetch(`/api/areas/${routeData.id}/governorships`)
      .then((res) => res.json())
      .then(setGovs);
  }, [routeData.id]);

  return (
    <ViewShell title={`${areaName} Governorships`}>
      <div className="drilldown-list">
        {govs === null && <div style={{ color: 'var(--muted-foreground)' }}>Loading governorships...</div>}
        {govs && govs.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)' }}>No governorships registered in this Area.</div>
        )}
        {govs &&
          govs.map((g) => (
            <a key={g.id} href={`/governorship/${g.id}`} className="drilldown-item glass glass-hover">
              <div>
                <div className="drilldown-title">{g.name}</div>
                <div className="drilldown-subtitle">Trinity Area Governorship</div>
              </div>
              <DrilldownArrow />
            </a>
          ))}
      </div>
    </ViewShell>
  );
}
