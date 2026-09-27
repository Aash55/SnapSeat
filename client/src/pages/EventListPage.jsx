import { useState, useEffect } from 'react';
import api from '../services/api';
import { Navbar } from '../components/Navbar';
import { EventCard } from '../components/EventCard';
import { EventCardSkeleton } from '../components/EventCardSkeleton';

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await api.get('/events');
        setEvents(response.data.data || response.data || []);
      } catch (error) {
        console.error('Failed to fetch events', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <Navbar />
      
      <main className="flex-1 px-6 py-10 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <p className="text-gold uppercase tracking-widest text-xs font-semibold mb-2">Now Booking</p>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <h1 className="font-display text-white text-3xl md:text-4xl font-bold">Upcoming events</h1>
            
            {isLoading ? (
              <div className="flex items-center gap-2 text-gold">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gold"></span>
                </span>
                <span className="text-sm">Fetching showtimes...</span>
              </div>
            ) : (
              <p className="text-gray-text text-sm">{events.length} events</p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed border-dark-border rounded-xl">
            <p className="text-gray-text">No events available right now.</p>
          </div>
        )}
      </main>
    </div>
  );
}
