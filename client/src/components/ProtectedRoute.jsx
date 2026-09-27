import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';

// Customer pages: attendees only. An organizer who lands here goes to their console.
export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isOrganizer } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isOrganizer) return <Navigate to="/organizer/dashboard" replace />;
  return children;
};

// Organizer pages: organizers only. Anyone else gets the organizer login.
export const OrganizerRoute = ({ children }) => {
  const { isAuthenticated, isOrganizer } = useAuth();
  if (!isAuthenticated || !isOrganizer) return <Navigate to="/organizer/login" replace />;
  return children;
};
