import { useEffect, useState } from 'react';
import api, { errorMessage } from '../services/api';
import { CustomerHeader } from '../components/CustomerHeader';
import { EventCard } from '../components/EventCard';
import { EventCardSkeleton } from '../components/EventCardSkeleton';
import { ActiveHoldBanner } from '../components/ActiveHoldBanner';

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get('/events')
      .then((res) => { if (alive) { setEvents(res.data); setStatus('ready'); } })
      .catch((err) => { if (alive) { setError(errorMessage(err)); setStatus('error'); } });
    return () => { alive = false; };
  }, [reloadKey]);

  const refresh = () => { setStatus('loading'); setReloadKey((k) => k + 1); };
  const loading = status === 'loading';

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <CustomerHeader />
      <main className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col gap-6 md:gap-8 px-4 md:px-16 pt-8 md:pt-12 pb-16" aria-busy={loading}>
        <ActiveHoldBanner />
        <div className="flex justify-between items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <span className="font-label text-xs tracking-[0.16em] text-gold">NOW BOOKING</span>
            <h1 className="m-0 font-display text-[34px] md:text-5xl font-medium leading-[1.05] tracking-[-0.02em]">Upcoming events</h1>
          </div>
          {loading ? (
            <div role="status" className="flex items-center gap-2 text-sm text-gray-text">
              <span className="livedot w-2 h-2 rounded-full bg-gold" />Fetching showtimes…
            </div>
          ) : status === 'ready' && events.length > 0 ? (
            <span className="text-sm text-gray-text">{events.length} {events.length === 1 ? 'event' : 'events'}</span>
          ) : null}
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((k) => <EventCardSkeleton key={k} />)}
          </div>
        )}

        {status === 'ready' && events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        )}

        {status !== 'loading' && (status === 'error' || events.length === 0) && (
          <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
            <div className="float-y w-[200px] h-28" aria-hidden="true">
              <svg width="200" height="112" viewBox="0 0 200 112" fill="none">
                <path d="M16 8h168a8 8 0 0 1 8 8v24a16 16 0 0 0 0 32v24a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8V72a16 16 0 0 0 0-32V16a8 8 0 0 1 8-8z" fill="#16141D" stroke="#3A3448" strokeWidth="2" />
                <path d="M64 12v88" stroke="#3A3448" strokeWidth="2" strokeDasharray="4 6" />
                <text x="36" y="62" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="13" fill="#F5B544" transform="rotate(-90 36 58)">ADMIT</text>
                <path d="M96 44h72M96 58h48M96 72h60" stroke="#2C2838" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-3 items-center max-w-[440px]">
              <h2 className="m-0 font-display text-[30px] md:text-4xl font-medium leading-[1.15]">
                {status === 'error' ? 'Couldn’t load events' : 'No events available'}
              </h2>
              <p className="m-0 text-base leading-relaxed text-gray-text">
                {status === 'error' ? error : 'The stage is empty for now. New shows appear here as soon as they’re published.'}
              </p>
            </div>
            <button type="button" onClick={refresh} className="btn-ghost min-h-11 px-5 rounded-[10px] text-sm font-semibold flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
              Refresh
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
