import { useEffect, useState } from 'react';
import { getState, subscribe } from './store.js';

// Subscribe a component to the shared store so it re-renders whenever state
// changes (e.g. a tourist SOS appearing on the admin dashboard).
export default function useStore() {
  const [state, setState] = useState(getState());
  useEffect(() => {
    setState(getState());
    return subscribe(setState);
  }, []);
  return state;
}
