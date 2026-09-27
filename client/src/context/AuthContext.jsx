import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from './useAuth';

// Reads the JWT's exp claim so an expired session is dropped on load instead of on the first
// failing request.
function tokenIsLive(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function readStoredUser() {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user && tokenIsLive(token)) return user;
  } catch {
    /* corrupted storage: treat as logged out */
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  return null;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const navigate = useNavigate();

  const save = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // Session expired mid-use: clear it and send the person to the login that matches their role.
  useEffect(() => {
    const onExpired = () => {
      const wasOrganizer = JSON.parse(localStorage.getItem('user') || 'null')?.role === 'organizer';
      // The note travels in sessionStorage, not router state: clearing the user makes the route
      // guard redirect immediately, which would drop any state passed to navigate().
      try { sessionStorage.setItem('snapseat:session-expired', '1'); } catch { /* ignore */ }
      logout();
      navigate(wasOrganizer ? '/organizer/login' : '/login', { replace: true });
    };
    window.addEventListener('snapseat:session-expired', onExpired);
    return () => window.removeEventListener('snapseat:session-expired', onExpired);
  }, [logout, navigate]);

  const value = useMemo(() => {
    /** expectedRole: reject accounts of the other kind without storing their session. */
    const login = async (email, password, { expectedRole } = {}) => {
      const res = await api.post('/auth/login', { email, password });
      if (expectedRole && res.data.user.role !== expectedRole) {
        const err = new Error(expectedRole === 'organizer'
          ? 'This is a customer account. Use the customer login to book tickets.'
          : 'This is an organizer account. Use the organizer portal to log in.');
        err.code = 'ROLE_MISMATCH';
        throw err;
      }
      return save(res.data.token, res.data.user);
    };
    const register = async (email, password, confirmPassword) => {
      const res = await api.post('/auth/register', { email, password, confirmPassword });
      return save(res.data.token, res.data.user);
    };
    const registerOrganizer = async (orgName, email, password, confirmPassword) => {
      const res = await api.post('/auth/organizer/register', { orgName, email, password, confirmPassword });
      return save(res.data.token, res.data.user);
    };
    return {
      user,
      loading: false,
      login,
      register,
      registerOrganizer,
      logout,
      isAuthenticated: !!user,
      isOrganizer: user?.role === 'organizer',
    };
  }, [user, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
