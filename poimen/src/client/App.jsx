import { Routes, Route } from 'react-router-dom';
import Landing from './landing/Landing.jsx';
import PoimenApp from './poimen/PoimenApp.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<PoimenApp />} />
    </Routes>
  );
}
