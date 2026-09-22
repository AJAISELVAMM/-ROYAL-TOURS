import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar.jsx';
import Icon from '../common/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { subscribe } from '../../store.js';

const TITLES = {
  '/control-center': 'Dashboard',
  '/control-center/users': 'Users',
  '/control-center/travel-data': 'Travel Data',
  '/control-center/ai': 'AI & Recommendations',
  '/control-center/reports': 'Fare & Reports',
  '/control-center/safety': 'Safety Center',
  '/control-center/analytics': 'Analytics',
  '/control-center/account': 'Account'
};

function titleFor(path) {
  if (TITLES[path]) return TITLES[path];
  // Match nested admin paths against their parent section.
  const keys = Object.keys(TITLES).filter((k) => k !== '/control-center');
  for (const key of keys) {
    if (path.startsWith(key + '/')) return TITLES[key];
  }
  return 'Control Center';
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sosCount, setSosCount] = useState(0);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const unsub = subscribe((s) => {
      const n = s.sosRequests.filter((r) => r.status === 'active' || r.status === 'acknowledged').length;
      setSosCount(n);
    });
    return unsub;
  }, []);

  return (
    <div className={`app-shell ${drawerOpen ? 'drawer-open' : ''}`}>
      <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
      <div className={`drawer-overlay ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className="app-main">
        <header className="topbar topbar-admin">
          <div className="topbar-left">
            <button className="icon-btn menu-toggle" onClick={() => setDrawerOpen((v) => !v)} aria-label="Open menu">
              <Icon name="menu" size={22} />
            </button>
            <span className="topbar-title">{titleFor(location.pathname)}</span>
          </div>
          <div className="topbar-right">
            {sosCount > 0 && (
              <span className="sos-live-badge">
                <span className="sos-live-dot" />
                {sosCount} active SOS
              </span>
            )}
            <div className="topbar-user">
              <span className="avatar avatar-admin">A</span>
              <span className="topbar-username">{user?.name || 'Admin'}</span>
            </div>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
