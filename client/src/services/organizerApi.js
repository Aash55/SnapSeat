import api from './api';

// Thin wrapper around the /api/organizer/* routes so the organizer pages don't hand-build
// URLs and query strings themselves.
export const organizerApi = {
  listEvents: () => api.get('/organizer/events'),
  getEvent: (id) => api.get(`/organizer/events/${id}`),
  createEvent: (payload) => api.post('/organizer/events', payload),
  updateEvent: (id, payload) => api.put(`/organizer/events/${id}`, payload),
  deleteEvent: (id) => api.delete(`/organizer/events/${id}`),
  getDashboard: () => api.get('/organizer/dashboard'),
  getAnalytics: (eventId = 'all') => api.get('/organizer/analytics', { params: { eventId } }),
};

export default organizerApi;
