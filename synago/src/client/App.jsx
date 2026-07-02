import { Routes, Route, Navigate } from 'react-router-dom';
import SynagoApp from './synago/SynagoApp.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/synago/*" element={<SynagoApp />} />
      <Route path="*" element={<Navigate to="/synago" replace />} />
    </Routes>
  );
}
