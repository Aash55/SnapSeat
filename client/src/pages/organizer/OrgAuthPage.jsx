import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, readSessionExpired, clearSessionExpired } from '../../context/useAuth';
import { errorMessage } from '../../services/api';

export default function OrgAuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { user, isOrganizer, login, registerOrganizer } = useAuth();
  const navigate = useNavigate();
  const [sessionExpired] = useState(readSessionExpired);
  useEffect(() => { clearSessionExpired(); }, []);

  useEffect(() => {
    if (user && isOrganizer) navigate('/organizer/dashboard', { replace: true });
  }, [user, isOrganizer, navigate]);

  const isSignup = mode === 'signup';

  const setMode_ = (next) => {
    if (loading) return;
    setMode(next);
    setErrors({});
    setPassword('');
    setConfirm('');
  };

  const validate = () => {
    const e = {};
    if (isSignup && !org.trim()) e.org = 'Enter your organization name.';
    if (!email.trim()) e.email = 'Enter your work email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Enter your password.';
    else if (isSignup && password.length < 8) e.password = 'Use at least 8 characters.';
    if (isSignup && !confirm) e.confirm = 'Confirm your password.';
    else if (isSignup && confirm !== password) e.confirm = 'Passwords don’t match.';
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (loading) return;
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      if (isSignup) {
        await registerOrganizer(org.trim(), email.trim(), password, confirm);
      } else {
        await login(email.trim(), password, { expectedRole: 'organizer' });
      }
      navigate('/organizer/dashboard');
    } catch (err) {
      const code = err.code === 'ROLE_MISMATCH' ? 'ROLE_MISMATCH' : err.response?.data?.code;
      const msg = code === 'ROLE_MISMATCH' ? err.message : errorMessage(err);
      const field = err.response?.data?.field;
      if (isSignup) {
        const map = { orgName: 'org', email: 'email', password: 'password', confirmPassword: 'confirm' };
        setErrors({ [map[field] || (code === 'EMAIL_EXISTS' ? 'email' : 'form')]: msg });
      } else if (code === 'INVALID_CREDENTIALS') {
        setErrors({ cred: true, password: 'Incorrect email or password.' });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-dark-bg flex flex-col box-border">
      <header className="h-16 md:h-[72px] shrink-0 flex items-center px-4 md:px-16 border-b border-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-gold flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1206" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 11V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
              <path d="M4 11h16v5H4z" />
              <path d="M6 16v4M18 16v4" />
            </svg>
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">SnapSeat</span>
          <span className="font-label px-2.5 py-1 rounded-full bg-dark-card-hover border border-dark-border-hover text-[11px] tracking-widest text-gold">
            ORGANIZER
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-16 py-8">
        <div className="w-full max-w-[460px] bg-dark-card border border-dark-border rounded-2xl p-6 md:p-10 flex flex-col gap-6 overflow-hidden">
          {sessionExpired && (
            <p role="status" className="m-0 px-3.5 py-3 rounded-[10px] bg-dark-card-hover border border-dark-border-hover text-[13px] text-gray-light">
              Your session expired. Log in again to continue.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <span className="font-label text-xs tracking-widest text-gold">
              {isSignup ? 'NEW ORGANIZER' : 'ORGANIZER CONSOLE'}
            </span>
            <h1 className="font-display text-3xl font-medium leading-tight tracking-tight">
              {isSignup ? 'Start selling seats' : 'Welcome back'}
            </h1>
            <p className="text-sm leading-snug text-gray-text">
              {isSignup
                ? 'Create your workspace to publish events and track bookings.'
                : 'Log in to manage your events, seat maps and bookings.'}
            </p>
          </div>

          <div role="tablist" aria-label="Log in or sign up" className="relative grid grid-cols-2 p-1 rounded-xl bg-[#121017] border border-dark-border">
            <div
              aria-hidden="true"
              className="pill absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[9px] bg-dark-card-hover transition-[left] duration-200"
              style={{ left: isSignup ? '50%' : '4px' }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              disabled={loading}
              onClick={() => setMode_('login')}
              className={`relative h-10 rounded-[9px] text-sm font-semibold transition-colors ${!isSignup ? 'text-white' : 'text-gray-text hover:text-white'}`}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              disabled={loading}
              onClick={() => setMode_('signup')}
              className={`relative h-10 rounded-[9px] text-sm font-semibold transition-colors ${isSignup ? 'text-white' : 'text-gray-text hover:text-white'}`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {isSignup && (
              <div className="fade flex flex-col gap-2">
                <label htmlFor="org" className="text-[13px] font-semibold text-gray-light">Organization name</label>
                <input
                  id="org" type="text" autoComplete="organization" placeholder="e.g. Riverside Arena"
                  value={org} onChange={(e) => setOrg(e.target.value)}
                  className={`h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none transition-colors ${errors.org ? 'border-danger' : 'border-dark-border focus:border-gold'}`}
                />
                {errors.org && <p className="fade text-danger text-[13px] m-0">{errors.org}</p>}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-[13px] font-semibold text-gray-light">Work email</label>
              <input
                id="email" type="email" autoComplete="email" placeholder="you@company.com"
                value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => { const n = { ...p }; delete n.email; delete n.cred; return n; }); }}
                className={`h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none transition-colors ${errors.email || errors.cred ? 'border-danger' : 'border-dark-border focus:border-gold'}`}
              />
              {errors.email && <p className="fade text-danger text-[13px] m-0">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-baseline">
                <label htmlFor="pw" className="text-[13px] font-semibold text-gray-light">Password</label>
                {isSignup && <span className="font-label text-[11px] text-gray-text">MIN 8 CHARS</span>}
              </div>
              <div className="relative">
                <input
                  id="pw" type={showPw ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => { setPassword(e.target.value); setErrors((p) => { const n = { ...p }; delete n.password; delete n.cred; return n; }); }}
                  className={`w-full h-[46px] box-border pr-[50px] pl-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none transition-colors ${errors.password || errors.cred ? 'border-danger' : 'border-dark-border focus:border-gold'}`}
                />
                <button
                  type="button" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)}
                  className="absolute top-[5px] right-[5px] w-9 h-9 rounded-lg flex items-center justify-center text-gray-text hover:text-white hover:bg-dark-card-hover cursor-pointer"
                >
                  {showPw ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.1M6.6 6.6C4.5 8 3 10 2 12c1 2.5 5 7 10 7a10 10 0 0 0 4.4-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              {errors.password && <p role="alert" className="fade text-danger text-[13px] m-0">{errors.password}</p>}
            </div>

            {isSignup && (
              <div className="fade flex flex-col gap-2">
                <label htmlFor="pw2" className="text-[13px] font-semibold text-gray-light">Confirm password</label>
                <input
                  id="pw2" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                  value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((p) => { const n = { ...p }; delete n.confirm; return n; }); }}
                  className={`h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none transition-colors ${errors.confirm ? 'border-danger' : 'border-dark-border focus:border-gold'}`}
                />
                {errors.confirm && <p className="fade text-danger text-[13px] m-0">{errors.confirm}</p>}
              </div>
            )}

            {errors.form && (
              <p role="alert" className="fade m-0 px-3.5 py-3 rounded-[10px] bg-danger/10 border border-danger/35 text-[13px] leading-snug text-gray-light">{errors.form}</p>
            )}

            <div className="perf my-2 -mx-6 md:-mx-10" />

            <button
              type="submit" disabled={loading}
              className="h-[52px] rounded-xl text-[15px] font-bold bg-gold text-dark-bg hover:bg-gold-hover transition-colors disabled:opacity-60 disabled:cursor-progress flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {loading && <svg className="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3a9 9 0 1 1-9 9" /></svg>}
              {loading ? (isSignup ? 'Creating account…' : 'Logging in…') : (isSignup ? 'Create account' : 'Log in')}
              {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
            </button>
          </form>
        </div>

        <Link to="/login" className="text-gray-text hover:text-white text-xs font-label tracking-wider mt-6">
          LOOKING TO BOOK TICKETS? CUSTOMER LOGIN &rarr;
        </Link>
      </main>

      <footer className="h-14 shrink-0 flex items-center justify-center font-label text-[11px] tracking-widest text-gray-text">
        SNAPSEAT FOR ORGANIZERS
      </footer>
    </div>
  );
}
