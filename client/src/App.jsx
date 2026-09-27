import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute, OrganizerRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import EventListPage from './pages/EventListPage';
import SeatMapPage from './pages/SeatMapPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import OrgAuthPage from './pages/organizer/OrgAuthPage';
import OrgAddEventPage from './pages/organizer/OrgAddEventPage';
import OrgMyEventsPage from './pages/organizer/OrgMyEventsPage';
import OrgDashboardPage from './pages/organizer/OrgDashboardPage';
import OrgAnalyticsPage from './pages/organizer/OrgAnalyticsPage';

// Resets the ErrorBoundary whenever the route changes, so a crash on one page doesn't
// permanently brick every other page in the same tab — the person can navigate away
// (or click a link that led them back here) and get a fresh mount instead of being
// stuck until a hard refresh.
function RoutedErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <RoutedErrorBoundary>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected - Customer */}
            <Route path="/events" element={
              <ProtectedRoute><EventListPage /></ProtectedRoute>
            } />
            <Route path="/events/:id/seats" element={
              <ProtectedRoute><SeatMapPage /></ProtectedRoute>
            } />
            <Route path="/checkout/:holdGroupId" element={
              <ProtectedRoute><CheckoutPage /></ProtectedRoute>
            } />
            <Route path="/confirmation/:paymentId" element={
              <ProtectedRoute><ConfirmationPage /></ProtectedRoute>
            } />

            {/* Public - Organizer */}
            <Route path="/organizer/login" element={<OrgAuthPage />} />

            {/* Protected - Organizer */}
            <Route path="/organizer/dashboard" element={
              <OrganizerRoute><OrgDashboardPage /></OrganizerRoute>
            } />
            <Route path="/organizer/analytics" element={
              <OrganizerRoute><OrgAnalyticsPage /></OrganizerRoute>
            } />
            <Route path="/organizer/events" element={
              <OrganizerRoute><OrgMyEventsPage /></OrganizerRoute>
            } />
            <Route path="/organizer/events/new" element={
              <OrganizerRoute><OrgAddEventPage /></OrganizerRoute>
            } />
            <Route path="/organizer/events/:id/edit" element={
              <OrganizerRoute><OrgAddEventPage /></OrganizerRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/events" replace />} />
            <Route path="*" element={<Navigate to="/events" replace />} />
          </Routes>
        </RoutedErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
