import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/organizer/dashboard' },
  { key: 'analytics', label: 'Analytics', to: '/organizer/analytics' },
  { key: 'events', label: 'My Events', to: '/organizer/events' },
  { key: 'add', label: 'Add Event', to: '/organizer/events/new' },
];

export const OrganizerNavbar = ({ active }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/organizer/login');
  };

  const initials = (user?.orgName || user?.email || 'O').slice(0, 2).toUpperCase();

  return (
    <header className="h-[72px] shrink-0 box-border flex items-center justify-between px-6 md:px-16 border-b border-dark-border">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gold flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1206" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 11V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
            <path d="M4 11h16v5H4z" />
            <path d="M6 16v4M18 16v4" />
          </svg>
        </div>
        <span className="font-display text-xl font-semibold tracking-tight">SnapSeat</span>
        <span className="font-label px-2.5 py-1 rounded-full bg-dark-card-hover border border-dark-border-hover text-[11px] tracking-widest text-gold">
          ORGANIZER
        </span>
      </div>

      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-1 mr-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              aria-current={active === item.key ? 'page' : undefined}
              className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                active === item.key ? 'bg-dark-card-hover text-white' : 'text-gray-text hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="w-9 h-9 rounded-full bg-dark-card-hover border border-dark-border-hover flex items-center justify-center font-label text-sm text-gold">
          {initials}
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold leading-tight">{user?.orgName || 'Organizer'}</span>
            <span className="text-xs text-gray-text leading-tight">{user?.email}</span>
          </div>
          <div className="w-px h-7 bg-dark-border" />
          <button
            onClick={handleLogout}
            className="min-h-11 px-4 rounded-[10px] border border-dark-border text-sm font-semibold bg-transparent hover:bg-dark-card-hover hover:border-dark-border-hover transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};
