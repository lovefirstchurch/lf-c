import { useEffect } from 'react';


export default function Landing() {
  useEffect(() => {
    document.title = 'LFC Church Management System';
  }, []);

  return (
    <div className="landing">
      <div className="container">
        <h1>LFC Church Management System</h1>
        <a href="/synago" className="btn btn-synago">Go to Synago (App 1)</a>
        <a href="/poimen" className="btn btn-poimen">Go to Poimen (App 2)</a>
        <p>Two separate apps sharing one database</p>
      </div>
    </div>
  );
}
