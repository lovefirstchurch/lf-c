'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { BrowserRouter } from 'react-router-dom';

// Dynamically import the App to disable SSR, ensuring window/localStorage work.
const App = dynamic(() => import('../client/App'), {
  ssr: false,
});

export default function ClientApp() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
