import { useMinWidth } from '../../shared/useMinWidth.js';
import ViewShell, { DrilldownArrow } from './ViewShell.jsx';

const sectionTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.15rem',
  color: 'var(--primary)',
  marginBottom: '0.5rem',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '0.5rem',
};
const sectionDescStyle = {
  fontSize: '0.8rem',
  color: 'var(--muted-foreground)',
  marginBottom: '1rem',
};

// View: ROOT (Home View)
export default function RootView() {
  const wide = useMinWidth(900);

  return (
    <ViewShell title="Administration Console" hasBack={false}>
      <div
        className="grid-dashboard"
        style={{ gridTemplateColumns: wide ? '1fr 1fr' : '1fr', marginTop: '1rem' }}
      >
        <div>
          <h3 style={sectionTitleStyle}>Congregational Hierarchy</h3>
          <p style={sectionDescStyle}>
            Select an Area to explore governorships, fellowships, and schacentas.
          </p>
          <div className="drilldown-list">
            <a href="/area/1" className="drilldown-item glass glass-hover">
              <div>
                <div className="drilldown-title">Area 1 (Trinity Fellowship Area)</div>
                <div className="drilldown-subtitle">Fellowships led by Shepherds</div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/area/2" className="drilldown-item glass glass-hover">
              <div>
                <div className="drilldown-title">Area 2 (Grace Schacenta Area)</div>
                <div className="drilldown-subtitle">Schacentas led by Schacenta Leaders</div>
              </div>
              <DrilldownArrow />
            </a>
          </div>
        </div>

        <div>
          <h3 style={sectionTitleStyle}>Global Operations</h3>
          <p style={sectionDescStyle}>
            Access church-wide directories, reports, audits, and configurations.
          </p>
          <div className="drilldown-list">
            <a href="/directory" className="drilldown-item glass glass-hover">
              <div>
                <div className="drilldown-title">Membership Directory</div>
                <div className="drilldown-subtitle">Filterable list of all members</div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/arrivals-admin" className="drilldown-item glass glass-hover">
              <div>
                <div className="drilldown-title">Saturday Arrivals Console</div>
                <div className="drilldown-subtitle">
                  Verify headcounts, manage cutoff times &amp; counters
                </div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/shepherding" className="drilldown-item glass glass-hover">
              <div>
                <div className="drilldown-title">Shepherding Accountability</div>
                <div className="drilldown-subtitle">
                  Midweek &amp; Saturday performance compliance logs
                </div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/history" className="drilldown-item glass glass-hover">
              <div>
                <div className="drilldown-title">Universal History System</div>
                <div className="drilldown-subtitle">
                  Immutable transaction &amp; audit logs for all events
                </div>
              </div>
              <DrilldownArrow />
            </a>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
