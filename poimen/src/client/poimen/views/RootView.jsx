import { useMinWidth } from '@lfc/shared';
import ViewShell, { DrilldownArrow, DrilldownIcon, Icons } from './ViewShell.jsx';

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
    <ViewShell title="Dashboard" hasBack={false}>
      <div
        className="grid-dashboard"
        style={{ gridTemplateColumns: wide ? '1fr 1fr' : '1fr', marginTop: '1rem' }}
      >
        <div>
          <h3 style={sectionTitleStyle}>Areas</h3>
          <p style={sectionDescStyle}>Browse governorships and units.</p>
          <div className="drilldown-list">
            <a href="/area/1" className="drilldown-item glass glass-hover">
              <DrilldownIcon>{Icons.layers}</DrilldownIcon>
              <div className="drilldown-item-body">
                <div className="drilldown-title">Area 1 &middot; Trinity</div>
                <div className="drilldown-subtitle">Fellowships</div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/area/2" className="drilldown-item glass glass-hover">
              <DrilldownIcon>{Icons.layers}</DrilldownIcon>
              <div className="drilldown-item-body">
                <div className="drilldown-title">Area 2 &middot; Grace</div>
                <div className="drilldown-subtitle">Schacentas</div>
              </div>
              <DrilldownArrow />
            </a>
          </div>
        </div>

        <div>
          <h3 style={sectionTitleStyle}>More</h3>
          <p style={sectionDescStyle}>Directories, reports, and settings.</p>
          <div className="drilldown-list">
            <a href="/directory" className="drilldown-item glass glass-hover">
              <DrilldownIcon>{Icons.people}</DrilldownIcon>
              <div className="drilldown-item-body">
                <div className="drilldown-title">Directory</div>
                <div className="drilldown-subtitle">All members</div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/arrivals-admin" className="drilldown-item glass glass-hover">
              <DrilldownIcon>{Icons.flag}</DrilldownIcon>
              <div className="drilldown-item-body">
                <div className="drilldown-title">Arrivals</div>
                <div className="drilldown-subtitle">Verify headcounts</div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/shepherding" className="drilldown-item glass glass-hover">
              <DrilldownIcon>{Icons.chart}</DrilldownIcon>
              <div className="drilldown-item-body">
                <div className="drilldown-title">Shepherding Control</div>
                <div className="drilldown-subtitle">Compliance tracking</div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/leaders" className="drilldown-item glass glass-hover">
              <DrilldownIcon>{Icons.people}</DrilldownIcon>
              <div className="drilldown-item-body">
                <div className="drilldown-title">Leaders Directory</div>
                <div className="drilldown-subtitle">Manage church leaders and roles</div>
              </div>
              <DrilldownArrow />
            </a>
            <a href="/history" className="drilldown-item glass glass-hover">
              <DrilldownIcon>{Icons.clock}</DrilldownIcon>
              <div className="drilldown-item-body">
                <div className="drilldown-title">History Log</div>
                <div className="drilldown-subtitle">All activity</div>
              </div>
              <DrilldownArrow />
            </a>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
