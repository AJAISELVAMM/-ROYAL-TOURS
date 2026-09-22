// =============================================================================
// TouristSidebar.jsx — Main Navigation Sidebar with grouped submenus.
// Provides sleek, consistent navigation across Dashboard, Smart Travel,
// Discover, Safety, My Journey, and Account with a prominent SOS trigger.
// =============================================================================

import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import Logo from '../common/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { disconnectSocket } from '../../services/socket.js';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  {
    to: '/my-journey',
    label: 'My Journey',
    icon: 'map',
    children: [
      { to: '/my-journey/trip', label: 'My Trip', icon: 'map' },
      { to: '/my-journey/budget', label: 'Budget', icon: 'wallet' },
      { to: '/my-journey/packing', label: 'Packing', icon: 'bag' },
      { to: '/my-journey/group', label: 'Travel Group', icon: 'users' }
    ]
  },
  {
    to: '/smart-travel',
    label: 'Smart Travel',
    icon: 'sparkles',
    children: [
      { to: '/smart-travel/transport', label: 'Transport', icon: 'bus' },
      { to: '/smart-travel/fair-fare', label: 'Fair Fare', icon: 'target' },
      { to: '/smart-travel/translator', label: 'Translator', icon: 'translate' },
      { to: '/smart-travel/weather', label: 'Weather', icon: 'cloud-sun' }
    ]
  },
  {
    to: '/discover',
    label: 'Discover',
    icon: 'compass',
    children: [
      { to: '/discover/places', label: 'Places', icon: 'map-pin' },
      { to: '/discover/hotels', label: 'Hotels', icon: 'bed' },
      { to: '/discover/restaurants', label: 'Restaurants', icon: 'utensils' },
      { to: '/discover/theatres', label: 'Theatres', icon: 'film' },
      { to: '/discover/shopping', label: 'Shopping', icon: 'bag' }
    ]
  },
  {
    to: '/safety',
    label: 'Safety',
    icon: 'shield',
    children: [
      { to: '/safety/map', label: 'Safety Map', icon: 'map' },
      { to: '/safety/lost', label: "I'm Lost", icon: 'navigation' },
      { to: '/safety/report', label: 'Report Issue', icon: 'alert-triangle' },
      { to: '/safety/emergency', label: 'Emergency', icon: 'siren' }
    ]
  },
  { to: '/account', label: 'Account', icon: 'user' }
];

export default function TouristSidebar({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  async function handleLogout() {
    try {
      disconnectSocket();
      await logout();
      if (onNavigate) onNavigate();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo size={34} light />
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => {
          const isParentActive =
            location.pathname === item.to || location.pathname.startsWith(item.to + '/');

          return (
            <div key={item.to} className="sidebar-group">
              <NavLink
                to={item.children ? item.children[0].to : item.to}
                className={({ isActive }) => `sidebar-link ${isActive || isParentActive ? 'active' : ''}`}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
              </NavLink>

              {item.children && isParentActive && (
                <div className="sidebar-subnav">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}
                      onClick={onNavigate}
                    >
                      <Icon name={child.icon} size={14} />
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="sidebar-group" style={{ marginTop: 'auto', paddingTop: '12px' }}>
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
            title="Log out of ROYAL TOURS"
          >
            <Icon name="log-out" size={19} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sos-fab"
          onClick={() => {
            navigate('/dashboard');
            document.dispatchEvent(new Event('tourguard:opensos'));
          }}
        >
          <Icon name="siren" size={20} />
          <span>SOS EMERGENCY</span>
        </button>
      </div>
    </aside>
  );
}
