import React from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import Icon from '../../components/common/Icon.jsx';

const TABS = [
  { to: '/smart-travel/transport', label: 'Transport', icon: 'bus' },
  { to: '/smart-travel/fair-fare', label: 'Fair Fare', icon: 'target' },
  { to: '/smart-travel/translator', label: 'Translator', icon: 'translate' },
  { to: '/smart-travel/weather', label: 'Weather', icon: 'cloud-sun' }
];

export default function SmartTravel() {
  const location = useLocation();
  if (location.pathname === '/smart-travel') {
    return <Navigate to="/smart-travel/transport" replace />;
  }
  return (
    <div className="page-inner">
      <h1 className="page-title">Smart Travel</h1>
      <p className="page-sub">Transport, fair fares, translation and weather — all in one place.</p>
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
