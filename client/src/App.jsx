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

// Remount the error boundary on navigation so one broken page never bricks the whole tab.
function RoutedErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

const customer = (el) => <ProtectedRoute>{el}</ProtectedRoute>;
const organizer = (el) => <OrganizerRoute>{el}</OrganizerRoute>;

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <RoutedErrorBoundary>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/events" element={customer(<EventListPage />)} />
              <Route path="/events/:id/seats" element={customer(<SeatMapPage />)} />
              <Route path="/checkout/:holdGroupId" element={customer(<CheckoutPage />)} />
              <Route path="/confirmation/:paymentId" element={customer(<ConfirmationPage />)} />

              <Route path="/organizer/login" element={<OrgAuthPage />} />
              <Route path="/organizer" element={<Navigate to="/organizer/dashboard" replace />} />
              <Route path="/organizer/dashboard" element={organizer(<OrgDashboardPage />)} />
              <Route path="/organizer/analytics" element={organizer(<OrgAnalyticsPage />)} />
              <Route path="/organizer/events" element={organizer(<OrgMyEventsPage />)} />
              <Route path="/organizer/events/new" element={organizer(<OrgAddEventPage />)} />
              <Route path="/organizer/events/:id/edit" element={organizer(<OrgAddEventPage />)} />

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
