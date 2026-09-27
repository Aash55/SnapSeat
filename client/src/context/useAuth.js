import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Set when a session expires mid-use, so the login screen can say why the person landed there.
const EXPIRED_KEY = 'snapseat:session-expired';
export const readSessionExpired = () => { try { return sessionStorage.getItem(EXPIRED_KEY) === '1'; } catch { return false; } };
export const clearSessionExpired = () => { try { sessionStorage.removeItem(EXPIRED_KEY); } catch { /* ignore */ } };
