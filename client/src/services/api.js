import axios from 'axios';

// In development Vite proxies /api to the local server. In production set VITE_API_URL to the
// deployed API, e.g. https://snapseat-api.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on a normal API call means the session is gone. Tell the app (AuthContext decides where
// to send the person). A 401 from the login/register calls themselves is just "wrong password"
// and must reach the form untouched, so those are skipped.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('snapseat:session-expired'));
    }
    return Promise.reject(error);
  }
);

/** The server's message for a failed request, or a sensible fallback. */
export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (!err?.response) return 'Can’t reach the server. Check your connection and try again.';
  return err.response.data?.error || fallback;
};
export const errorCode = (err) => err?.response?.data?.code;

export default api;
