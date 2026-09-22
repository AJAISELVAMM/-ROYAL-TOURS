import { useState, useEffect } from 'react';

// Run an async loader on mount (and when deps change); expose loading + error
// plus the last-resolved data value (when the loader returns one).
export default function useLoad(loader, deps = []) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.resolve()
      .then(loader)
      .then((result) => {
        if (active) setData(result ?? null);
      })
      .catch((e) => {
        if (active) setError(e?.message || 'Something went wrong.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { loading, error, data };
}
