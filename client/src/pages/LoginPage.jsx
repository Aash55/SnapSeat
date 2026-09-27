import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (user) {
      navigate('/events');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (activeTab === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'login') {
        await login(email, password);
        toast.success('Logged in successfully');
      } else {
        await register(email, password, confirmPassword);
        toast.success('Registered successfully');
      }
      navigate('/events');
    } catch (err) {
      const msg = err.response?.data?.error || 'Authentication failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 bg-gold-muted rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="font-display text-white text-3xl font-bold">SnapSeat</h1>
        <p className="text-gray-text mt-2 text-sm">Secure your spot instantly</p>
      </div>

      <div className="bg-dark-card w-full max-w-md rounded-2xl border border-dark-border p-6 sm:p-8">
        <div className="flex rounded-lg bg-[#0B0B0F] p-1 mb-6">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'login' ? 'bg-dark-card text-white shadow-sm' : 'text-gray-text hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'register' ? 'bg-dark-card text-white shadow-sm' : 'text-gray-text hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-text text-sm mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#141419] border border-[#2A2A35] focus:border-gold outline-none rounded-lg px-4 py-2.5 text-white placeholder-gray-text transition-colors"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-gray-text text-sm mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#141419] border border-[#2A2A35] focus:border-gold outline-none rounded-lg px-4 py-2.5 text-white placeholder-gray-text transition-colors"
              placeholder="Enter your password"
            />
          </div>

          {activeTab === 'register' && (
            <div>
              <label className="block text-gray-text text-sm mb-1.5">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#141419] border border-[#2A2A35] focus:border-gold outline-none rounded-lg px-4 py-2.5 text-white placeholder-gray-text transition-colors"
                placeholder="Confirm your password"
              />
            </div>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gold hover:bg-gold-hover text-dark-bg font-semibold rounded-lg py-3 mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {activeTab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
      <Link to="/organizer/login" className="text-gray-text hover:text-white text-xs font-label tracking-wider mt-6">
        ORGANIZING AN EVENT? ORGANIZER PORTAL &rarr;
      </Link>
    </div>
  );
}
