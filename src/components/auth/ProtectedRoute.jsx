import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

// Tourist-only guard: requires auth and the tourist role.
export function RequireTourist({ children }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (role === 'admin') {
    // Admins should never see the tourist experience.
    return <Navigate to="/control-center" replace />;
  }
  return children;
}

// Admin-only guard: requires auth and the admin role. Unauthenticated users
// are sent to the normal public login (no hint that admin exists).
export function RequireAdmin({ children }) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (role !== 'admin') {
    // A tourist who somehow reaches an admin route is denied -> dashboard.
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Redirect authenticated users away from public auth pages.
export function RedirectIfAuthed({ children }) {
  const { isAuthenticated, role } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={role === 'admin' ? '/control-center' : '/dashboard'} replace />;
  }
  return children;
}
