import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <nav className="bg-dark-bg border-b border-dark-border px-6 py-4 flex items-center justify-between">
      <Link to="/events" className="flex items-center gap-2 no-underline">
        <div className="w-9 h-9 bg-gold-muted rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <span className="font-display text-white font-bold text-xl">SnapSeat</span>
      </Link>

      <div className="flex items-center gap-4">
        <Link to="/organizer/login" className="hidden sm:inline text-gray-text hover:text-white text-xs font-label tracking-wider">
          ORGANIZER PORTAL
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gold rounded-full flex items-center justify-center text-dark-bg font-semibold text-sm">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-white text-sm font-medium leading-tight">{user?.email?.split('@')[0] || 'User'}</p>
            <p className="text-gray-text text-xs leading-tight">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-text hover:text-white border border-dark-border hover:border-dark-border-hover rounded-lg transition-all cursor-pointer bg-transparent"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </nav>
  );
};
