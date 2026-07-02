import { Routes, Route } from 'react-router-dom';
import PoimenApp from './poimen/PoimenApp.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<PoimenApp />} />
    </Routes>
  );
}
