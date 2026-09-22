import React from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import Logo from '../common/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV = [
  { to: '/control-center', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/control-center/users', label: 'Users', icon: 'users' },
  { to: '/control-center/travel-data', label: 'Travel Data', icon: 'globe' },
  { to: '/control-center/ai', label: 'AI & Recommendations', icon: 'sparkles' },
  { to: '/control-center/reports', label: 'Fare & Reports', icon: 'wallet' },
  { to: '/control-center/safety', label: 'Safety Center', icon: 'shield' },
  { to: '/control-center/analytics', label: 'Analytics', icon: 'bar-chart' },
  { to: '/control-center/account', label: 'Account', icon: 'settings' }
];

export default function AdminSidebar({ onNavigate }) {
  const { logout } = useAuth();
  return (
    <aside className="sidebar sidebar-admin">
      <div className="sidebar-brand">
        <Logo size={34} />
      </div>
      <div className="sidebar-tag">Control Center</div>
      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onNavigate}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className="sidebar-logout"
          onClick={logout}
        >
          <Icon name="logout" size={19} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
