import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authService from '../services/authService.js';
import { setUnauthorizedHandler } from '../services/api.js';
import LogoutOverlayAnimation from '../components/animation/LogoutOverlayAnimation.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => {
    const session = authService.loadSession();
    return session
      ? { isAuthenticated: true, user: session.user, role: session.role }
      : { isAuthenticated: false, user: null, role: null };
  });

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutResolverRef = useRef(null);

  const login = useCallback(async (email, password) => {
    const result = await authService.login(email, password);
    if (result.success) {
      setAuth({ isAuthenticated: true, user: result.user, role: result.role });
    }
    return result;
  }, []);

  const handleLogoutAnimationComplete = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // ignore — clear locally regardless
    }
    setAuth({ isAuthenticated: false, user: null, role: null });
    setIsLoggingOut(false);
    if (logoutResolverRef.current) {
      logoutResolverRef.current();
      logoutResolverRef.current = null;
    }
    navigate('/login', { replace: true });
  }, [navigate]);

  const logout = useCallback(async (immediate = false) => {
    if (immediate === true) {
      try {
        await authService.logout();
      } catch {
        // ignore
      }
      setAuth({ isAuthenticated: false, user: null, role: null });
      navigate('/login', { replace: true });
      return;
    }

    if (isLoggingOut) return;

    return new Promise((resolve) => {
      logoutResolverRef.current = resolve;
      setIsLoggingOut(true);
    });
  }, [isLoggingOut, navigate]);

  useEffect(() => {
    // If a refresh fails (expired/invalid), force the user back to login immediately without animation.
    setUnauthorizedHandler(() => {
      authService.clearSession();
      setAuth({ isAuthenticated: false, user: null, role: null });
    });
  }, []);

  const setAuthenticatedSession = useCallback((session) => {
    if (session && session.user) {
      const role = session.role || (session.user.role === 'ADMIN' ? 'admin' : 'tourist');
      setAuth({ isAuthenticated: true, user: session.user, role });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isLoggingOut, setAuthenticatedSession }}>
      {children}
      {isLoggingOut && (
        <LogoutOverlayAnimation onComplete={handleLogoutAnimationComplete} />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
