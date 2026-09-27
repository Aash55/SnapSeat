import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { displayName, initials } from '../lib/format';

export const Logo = ({ small = false }) => (
  <div className={`${small ? 'w-[30px] h-[30px] rounded-lg' : 'w-9 h-9 rounded-[10px]'} bg-gold flex items-center justify-center shrink-0`}>
    <svg width={small ? 17 : 20} height={small ? 17 : 20} viewBox="0 0 24 24" fill="none" stroke="#1A1206" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 11V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" /><path d="M4 11h16v5H4z" /><path d="M6 16v4M18 16v4" />
    </svg>
  </div>
);

export function CustomerHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 md:h-[72px] shrink-0 box-border px-4 md:px-16 flex items-center justify-between border-b border-[#1F1C27] bg-dark-bg">
      <Link to="/events" className="flex items-center gap-3 text-inherit hover:text-inherit">
        <Logo />
        <span className="font-display text-xl md:text-2xl font-semibold tracking-tight text-white">SnapSeat</span>
      </Link>
      <div className="flex items-center gap-3 md:gap-4">
        <div aria-hidden="true" className="w-9 h-9 rounded-full bg-[#221E2C] border border-[#332E40] flex items-center justify-center font-label text-[13px] text-gold">
          {initials(user?.email)}
        </div>
        <div className="hidden md:flex flex-col gap-0.5">
          <span className="text-sm font-semibold leading-tight">{displayName(user?.email)}</span>
          <span className="text-xs text-gray-text leading-tight">{user?.email}</span>
        </div>
        <div className="hidden md:block w-px h-7 bg-dark-border" />
        <button type="button" onClick={handleLogout} aria-label="Logout"
          className="btn-ghost min-h-11 min-w-11 px-3 md:px-4 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h11" /></svg>
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
