import React from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import Icon from '../../components/common/Icon.jsx';

const TABS = [
  { to: '/my-journey/trip', label: 'My Trip', icon: 'map' },
  { to: '/my-journey/budget', label: 'Budget', icon: 'wallet' },
  { to: '/my-journey/packing', label: 'Packing List', icon: 'bag' },
  { to: '/my-journey/group', label: 'Travel Group', icon: 'users' }
];

export default function MyJourney() {
  const location = useLocation();
  if (location.pathname === '/my-journey') {
    return <Navigate to="/my-journey/trip" replace />;
  }
  return (
    <div className="page-inner">
      <h1 className="page-title">My Journey</h1>
      <p className="page-sub">Your trip, budget, packing and travel companions.</p>
      <div className="sub-tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `sub-tab ${isActive ? 'active' : ''}`}
          >
            <Icon name={t.icon} size={17} />
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
