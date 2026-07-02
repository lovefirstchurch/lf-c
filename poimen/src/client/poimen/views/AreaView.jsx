import { useEffect, useState } from 'react';
import { apiFetch } from '@lfc/shared';
import ViewShell, { DrilldownArrow, DrilldownIcon, Icons } from './ViewShell.jsx';

// View: AREA (Governorships List)
export default function AreaView({ routeData }) {
  const areaName = routeData.id === 1 ? 'Area 1' : 'Area 2';
  const [govs, setGovs] = useState(null);

  useEffect(() => {
    apiFetch(`/api/areas/${routeData.id}/governorships`)
      .then((res) => res.json())
      .then(setGovs);
  }, [routeData.id]);

  return (
    <ViewShell title={`${areaName} Governorships`}>
      <div className="drilldown-list">
        {govs === null && <div style={{ color: 'var(--muted-foreground)' }}>Loading...</div>}
        {govs && govs.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)' }}>No governorships yet.</div>
        )}
        {govs &&
          govs.map((g) => (
            <a key={g.id} href={`/governorship/${g.id}`} className="drilldown-item glass glass-hover">
              <DrilldownIcon>{Icons.building}</DrilldownIcon>
              <div className="drilldown-item-body">
                <div className="drilldown-title">{g.name}</div>
                <div className="drilldown-subtitle">Governorship</div>
              </div>
              <DrilldownArrow />
            </a>
          ))}
      </div>
    </ViewShell>
  );
}
