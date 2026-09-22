import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TouristSidebar from './TouristSidebar.jsx';
import TouristHeader from './TouristHeader.jsx';
import SOSModal from '../tourist/SOSModal.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/my-journey': 'My Journey',
  '/smart-travel': 'Smart Travel',
  '/discover': 'Discover',
  '/safety': 'Safety',
  '/account': 'Account'
};

function titleFor(path) {
  if (TITLES[path]) return TITLES[path];
  for (const key of Object.keys(TITLES)) {
    if (path.startsWith(key + '/')) return TITLES[key];
  }
  return 'ROYAL TOURS';
}

export default function TouristLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const openSOS = () => setSosOpen(true);
    document.addEventListener('tourguard:opensos', openSOS);
    return () => document.removeEventListener('tourguard:opensos', openSOS);
  }, []);

  return (
    <div className={`app-shell ${drawerOpen ? 'drawer-open' : ''}`}>
      <TouristSidebar onNavigate={() => setDrawerOpen(false)} />
      <div className={`drawer-overlay ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className="app-main">
        <TouristHeader onMenu={() => setDrawerOpen((v) => !v)} title={titleFor(location.pathname)} />
        <main className="page">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <SOSModal open={sosOpen} onClose={() => setSosOpen(false)} />
    </div>
  );
}
