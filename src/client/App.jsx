import { Routes, Route } from 'react-router-dom';
import Landing from './landing/Landing.jsx';
import SynagoApp from './synago/SynagoApp.jsx';
import PoimenApp from './poimen/PoimenApp.jsx';

// Poimen's drill-down navigation uses root-level paths (/area/1, /unit/3,
// /directory, ...) inherited from the original vanilla app, so everything
// that isn't the landing page or Synago falls through to Poimen.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/synago/*" element={<SynagoApp />} />
      <Route path="*" element={<PoimenApp />} />
    </Routes>
  );
}
