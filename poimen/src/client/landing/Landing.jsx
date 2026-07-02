import { useEffect } from 'react';

export default function Landing() {
  useEffect(() => {
    document.title = 'LFC Church Management System';
  }, []);

  const synagoUrl = process.env.NEXT_PUBLIC_SYNAGO_URL || 'http://localhost:3001';
  const poimenUrl = process.env.NEXT_PUBLIC_POIMEN_URL || 'http://localhost:3000';

  return (
    <div className="landing">
      <div className="container">
        <h1>LFC Church Management System</h1>
        <a href={synagoUrl} className="btn btn-synago">Go to Synago (App 1)</a>
        <a href={`${poimenUrl}/poimen`} className="btn btn-poimen">Go to Poimen (App 2)</a>
        <p>Two separate apps sharing one database</p>
      </div>
    </div>
  );
}
