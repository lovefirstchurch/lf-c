// General view structure, ported from createViewShell in public/poimen/app.js.
// The back button has no handler of its own: clicks bubble to the Stack
// container's delegated handler in PoimenApp.
export default function ViewShell({ title, hasBack = true, children }) {
  return (
    <div className="Stack-viewContent">
      <header className="view-header">
        {hasBack && (
          <button className="back" aria-label="Back" type="button">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
        )}
        <h2 className="view-title">{title}</h2>
      </header>
      {children}
    </div>
  );
}

export function DrilldownArrow() {
  return <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>&rarr;</span>;
}
