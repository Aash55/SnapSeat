import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { initials } from '../../lib/format';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/organizer/dashboard' },
  { key: 'analytics', label: 'Analytics', to: '/organizer/analytics' },
  { key: 'events', label: 'My Events', to: '/organizer/events' },
  { key: 'add', label: 'Add Event', to: '/organizer/events/new' },
];

const Logo = () => (
  <div className="w-9 h-9 rounded-[10px] bg-gold flex items-center justify-center shrink-0">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1206" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 11V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" /><path d="M4 11h16v5H4z" /><path d="M6 16v4M18 16v4" />
    </svg>
  </div>
);

export const OrganizerNavbar = ({ active }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Every page renders its own navbar, so navigating closes the menu by remounting it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleLogout = () => {
    logout();
    navigate('/organizer/login');
  };

  const name = user?.orgName || 'Organizer';

  return (
    <header className="relative z-30 h-16 md:h-[72px] shrink-0 box-border flex items-center justify-between px-4 md:px-16 border-b border-dark-border bg-dark-bg">
      <Link to="/organizer/dashboard" className="flex items-center gap-3 text-inherit hover:text-inherit min-w-0">
        <Logo />
        <span className="font-display text-xl font-semibold tracking-tight text-white">SnapSeat</span>
        <span className="hidden sm:inline font-label px-2.5 py-1 rounded-full bg-dark-card-hover border border-dark-border-hover text-[11px] tracking-widest text-gold">
          ORGANIZER
        </span>
      </Link>

      <div className="flex items-center gap-3 md:gap-4">
        <nav aria-label="Organizer" className="hidden lg:flex items-center gap-1 mr-2">
          {NAV_ITEMS.map((item) => (
            <Link key={item.key} to={item.to} aria-current={active === item.key ? 'page' : undefined}
              className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${active === item.key ? 'bg-dark-card-hover text-white' : 'text-gray-text hover:text-white'}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="w-9 h-9 rounded-full bg-dark-card-hover border border-dark-border-hover flex items-center justify-center font-label text-sm text-gold" aria-hidden="true">
          {initials(user?.orgName || user?.email)}
        </div>
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold leading-tight">{name}</span>
            <span className="text-xs text-gray-text leading-tight">{user?.email}</span>
          </div>
          <div className="w-px h-7 bg-dark-border" />
          <button type="button" onClick={handleLogout}
            className="min-h-11 px-4 rounded-[10px] border border-dark-border text-sm font-semibold bg-transparent hover:bg-dark-card-hover hover:border-dark-border-hover transition-colors cursor-pointer">
            Logout
          </button>
        </div>

        {/* Below lg the links don't fit: a menu button opens them in a sheet. */}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="org-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="lg:hidden w-11 h-11 rounded-[10px] border border-dark-border flex items-center justify-center text-white hover:bg-dark-card-hover cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 top-16 md:top-[72px] bg-black/60 backdrop-blur-sm cursor-default" />
          <div id="org-menu" className="fade lg:hidden absolute left-0 right-0 top-full bg-dark-card border-b border-dark-border shadow-[0_24px_48px_-16px_rgba(0,0,0,.9)] px-4 md:px-16 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-3 px-3 py-3 mb-1 border-b border-dark-border">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate">{name}</span>
                <span className="text-xs text-gray-text truncate">{user?.email}</span>
              </div>
            </div>
            <nav aria-label="Organizer" className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.key} to={item.to} aria-current={active === item.key ? 'page' : undefined}
                  className={`min-h-12 px-3 rounded-[10px] flex items-center text-[15px] font-semibold ${active === item.key ? 'bg-dark-card-hover text-white' : 'text-gray-light hover:text-white hover:bg-dark-card-hover'}`}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <button type="button" onClick={handleLogout}
              className="mt-2 min-h-12 rounded-[10px] border border-dark-border text-[15px] font-semibold text-white hover:bg-dark-card-hover cursor-pointer">
              Logout
            </button>
          </div>
        </>
      )}
    </header>
  );
};
