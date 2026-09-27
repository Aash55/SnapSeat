import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, readSessionExpired, clearSessionExpired } from '../context/authContext';
import { errorMessage } from '../services/api';
import { Logo } from '../components/CustomerHeader';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { user, isOrganizer, login, register } = useAuth();
  const navigate = useNavigate();
  const [sessionExpired] = useState(readSessionExpired);
  useEffect(() => { clearSessionExpired(); }, []);
  const isSignup = mode === 'signup';

  useEffect(() => {
    if (user) navigate(isOrganizer ? '/organizer/dashboard' : '/events', { replace: true });
  }, [user, isOrganizer, navigate]);

  const switchMode = (next) => {
    if (loading) return;
    setMode(next);
    setErrors({});
    setPassword('');
    setConfirm('');
  };

  const clear = (...keys) => setErrors((p) => { const n = { ...p }; keys.forEach((k) => delete n[k]); return n; });

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = 'Enter your email.';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Enter your password.';
    else if (isSignup && password.length < 8) e.password = 'Use at least 8 characters.';
    if (isSignup && confirm !== password) e.confirm = 'Passwords don’t match.';
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (loading) return;
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setErrors({});
    try {
      if (isSignup) await register(email.trim(), password, confirm);
      else await login(email.trim(), password, { expectedRole: 'attendee' });
      navigate('/events');
    } catch (err) {
      if (err.code === 'ROLE_MISMATCH') setErrors({ form: err.message, organizer: true });
      else if (err.response?.data?.code === 'INVALID_CREDENTIALS') setErrors({ cred: true, password: 'Incorrect email or password.' });
      else if (err.response?.data?.code === 'EMAIL_EXISTS') setErrors({ email: 'An account with this email already exists. Log in instead.' });
      else {
        const field = err.response?.data?.field;
        const key = { email: 'email', password: 'password', confirmPassword: 'confirm' }[field] || 'form';
        setErrors({ [key]: errorMessage(err) });
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (bad) => `w-full h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none transition-colors ${bad ? 'border-danger' : 'border-dark-border focus:border-gold'}`;

  return (
    <div className="w-full min-h-screen bg-dark-bg flex flex-col">
      <header className="h-16 md:h-[72px] shrink-0 flex items-center px-4 md:px-16 border-b border-[#1F1C27]">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-2xl font-semibold tracking-tight">SnapSeat</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-[460px] bg-dark-card border border-dark-border rounded-2xl p-6 md:p-10 flex flex-col gap-6 overflow-hidden">
          {sessionExpired && (
            <p role="status" className="m-0 px-3.5 py-3 rounded-[10px] bg-dark-card-hover border border-dark-border-hover text-[13px] text-gray-light">
              Your session expired. Log in again to continue.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <span className="font-label text-xs tracking-widest text-gold">{isSignup ? 'NEW HERE' : 'WELCOME BACK'}</span>
            <h1 className="font-display text-3xl font-medium leading-tight tracking-tight">{isSignup ? 'Create your account' : 'Log in to book seats'}</h1>
            <p className="text-sm leading-snug text-gray-text">Pick your seats, hold them for 5 minutes, and pay before anyone else can take them.</p>
          </div>

          <div role="tablist" aria-label="Log in or sign up" className="relative grid grid-cols-2 p-1 rounded-xl bg-[#121017] border border-dark-border">
            <div aria-hidden="true" className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[9px] bg-dark-card-hover transition-[left] duration-200" style={{ left: isSignup ? '50%' : '4px' }} />
            <button type="button" role="tab" aria-selected={!isSignup} disabled={loading} onClick={() => switchMode('login')}
              className={`relative h-10 rounded-[9px] text-sm font-semibold transition-colors cursor-pointer ${!isSignup ? 'text-white' : 'text-gray-text hover:text-white'}`}>Log in</button>
            <button type="button" role="tab" aria-selected={isSignup} disabled={loading} onClick={() => switchMode('signup')}
              className={`relative h-10 rounded-[9px] text-sm font-semibold transition-colors cursor-pointer ${isSignup ? 'text-white' : 'text-gray-text hover:text-white'}`}>Sign up</button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="c-email" className="text-[13px] font-semibold text-gray-light">Email</label>
              <input id="c-email" type="email" autoComplete="email" placeholder="you@example.com" value={email}
                onChange={(e) => { setEmail(e.target.value); clear('email', 'cred', 'form'); }}
                aria-invalid={!!(errors.email || errors.cred)} className={inputCls(errors.email || errors.cred)} />
              {errors.email && <p className="fade text-danger text-[13px] m-0">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-baseline">
                <label htmlFor="c-pw" className="text-[13px] font-semibold text-gray-light">Password</label>
                {isSignup && <span className="font-label text-[11px] text-gray-text">MIN 8 CHARS</span>}
              </div>
              <div className="relative">
                <input id="c-pw" type={showPw ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} value={password}
                  onChange={(e) => { setPassword(e.target.value); clear('password', 'cred', 'form'); }}
                  aria-invalid={!!(errors.password || errors.cred)} className={`${inputCls(errors.password || errors.cred)} pr-[50px]`} />
                <button type="button" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)}
                  className="absolute top-[5px] right-[5px] w-9 h-9 rounded-lg flex items-center justify-center text-gray-text hover:text-white hover:bg-dark-card-hover cursor-pointer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {showPw ? <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.1M6.6 6.6C4.5 8 3 10 2 12c1 2.5 5 7 10 7a10 10 0 0 0 4.4-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></> : <><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" /></>}
                  </svg>
                </button>
              </div>
              {errors.password && <p role="alert" className="fade text-danger text-[13px] m-0">{errors.password}</p>}
            </div>

            {isSignup && (
              <div className="fade flex flex-col gap-2">
                <label htmlFor="c-pw2" className="text-[13px] font-semibold text-gray-light">Confirm password</label>
                <input id="c-pw2" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); clear('confirm'); }}
                  aria-invalid={!!errors.confirm} className={inputCls(errors.confirm)} />
                {errors.confirm && <p className="fade text-danger text-[13px] m-0">{errors.confirm}</p>}
              </div>
            )}

            {errors.form && (
              <div role="alert" className="fade px-3.5 py-3 rounded-[10px] bg-danger/10 border border-danger/35 text-[13px] leading-snug text-gray-light flex flex-col gap-1.5">
                <span>{errors.form}</span>
                {errors.organizer && <Link to="/organizer/login" className="font-semibold">Go to the organizer portal →</Link>}
              </div>
            )}

            <div className="perf my-2 -mx-6 md:-mx-10" />

            <button type="submit" disabled={loading}
              className={`btn-gold h-[52px] rounded-xl text-[15px] font-bold flex items-center justify-center gap-2.5 ${loading ? 'is-busy' : ''}`}>
              {loading && <svg className="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" /></svg>}
              {loading ? (isSignup ? 'Creating account…' : 'Logging in…') : (isSignup ? 'Create account' : 'Log in')}
            </button>
          </form>
        </div>
        <Link to="/organizer/login" className="text-gray-text hover:text-white text-xs font-label tracking-wider mt-6 text-center">
          ORGANIZING AN EVENT? ORGANIZER PORTAL &rarr;
        </Link>
      </main>
    </div>
  );
}
