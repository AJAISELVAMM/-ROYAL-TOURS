import React from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import Icon from '../../components/common/Icon.jsx';

const TABS = [
  { to: '/safety/map', label: 'Safety Map', icon: 'map' },
  { to: '/safety/lost', label: "I'm Lost", icon: 'navigation' },
  { to: '/safety/report', label: 'Report Issue', icon: 'alert-triangle' },
  { to: '/safety/emergency', label: 'Emergency', icon: 'siren' }
];

export default function Safety() {
  const location = useLocation();
  if (location.pathname === '/safety') {
    return <Navigate to="/safety/map" replace />;
  }
  return (
    <div className="page-inner">
      <h1 className="page-title">Safety</h1>
      <p className="page-sub">Stay aware, find help, and report issues on the go.</p>
      <div className="sub-tabs">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `sub-tab ${isActive ? 'active' : ''}`}>
            <Icon name={t.icon} size={17} />
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
