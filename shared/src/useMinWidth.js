import { useEffect, useState } from 'react';

// Replaces the vanilla apps' window.matchMedia(...).addListener() pattern
// used for responsive grid-template-columns switches.
export function useMinWidth(px) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(`(min-width: ${px}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [px]);

  return matches;
}
