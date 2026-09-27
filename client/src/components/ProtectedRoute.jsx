import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Spinner = () => (
  <div className="min-h-screen bg-dark-bg flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
  </div>
);

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
};

// Same as ProtectedRoute, but also requires the organizer role — an attendee hitting an
// /organizer/* URL gets bounced to the organizer login instead of seeing someone else's console.
export const OrganizerRoute = ({ children }) => {
  const { isAuthenticated, isOrganizer, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!isAuthenticated || !isOrganizer) return <Navigate to="/organizer/login" replace />;

  return children;
};
