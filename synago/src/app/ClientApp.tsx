'use client';

import dynamic from 'next/dynamic';
import { BrowserRouter } from 'react-router-dom';

const App = dynamic(() => import('../client/App'), {
  ssr: false,
});

export default function ClientApp() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
