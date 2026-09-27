import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { OrganizerNavbar } from '../../components/organizer/OrganizerNavbar';
import { organizerApi } from '../../services/organizerApi';
import { useToast } from '../../components/Toast';

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const time12 = (d) => {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

const ago = (iso) => {
  const t = new Date(iso).getTime();
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

function KpiCard({ label, value, foot, live, icon }) {
  return (
    <div className={`bg-dark-card border rounded-2xl p-5 md:p-6 flex flex-col gap-3 min-w-0 ${live ? 'border-gold/35' : 'border-dark-border'}`}>
      <div className="flex justify-between items-center gap-2">
        <span className="font-label text-[11px] tracking-wider text-gray-text">{label}</span>
        {live ? (
          <span className="flex items-center gap-1.5 font-label text-[10px] tracking-wider text-gold">
            <span className="livedot w-1.5 h-1.5 rounded-full bg-gold" />LIVE
          </span>
        ) : (
          <span className="w-7 h-7 rounded-lg bg-dark-card-hover flex items-center justify-center text-gray-text">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
          </span>
        )}
      </div>
      <span className="font-display text-3xl md:text-[44px] font-semibold tracking-tight leading-none whitespace-nowrap">{value}</span>
      <div className="text-[13px] text-gray-text min-h-[18px]">{foot}</div>
    </div>
  );
}

export default function OrgDashboardPage() {
  const [dash, setDash] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const toast = useToast();

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const [dashRes, eventsRes] = await Promise.all([organizerApi.getDashboard(), organizerApi.listEvents()]);
      setDash(dashRes.data);
      setLoadError(false);
      const now = Date.now();
      const up = eventsRes.data
        .filter((e) => new Date(e.date).getTime() > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
      setUpcoming(up);
      setSyncedAt(Date.now());
    } catch {
      // A background (silent) refresh failing just keeps showing the last good data —
      // no need to alarm the person over a single missed poll. But the FIRST load failing
      // means we have nothing to show at all, so that has to surface as a real error
      // state instead of silently rendering `dash.something` and crashing the page.
      setLoadError(true);
      if (!silent) toast.error('Could not load dashboard.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(false);
    const iv = setInterval(() => load(true), 20000);
    return () => clearInterval(iv);
  }, [load]);

  const [secsAgo, setSecsAgo] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setSecsAgo(Math.round((Date.now() - syncedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [syncedAt]);

  // Safe defaults so the JSX below never has to null-check `dash` directly — if the very
  // first load fails, `dash` stays null forever otherwise, and every `dash.xxx` access
  // in the render would throw and blank the whole app (no error boundary would save us
  // from that being confusing — better to just never let it happen).
  const d = dash || { totalEvents: 0, totalBookings: 0, totalRevenue: 0, activeHolds: 0, activeHoldEvents: 0, recentBookings: [] };
  const showFailedBanner = !loading && !dash && loadError;

  const kpis = [
    {
      label: 'TOTAL EVENTS', value: String(d.totalEvents),
      foot: `${upcoming.length} upcoming · ${d.totalEvents - upcoming.length} past`,
      icon: 'M4 7h16v12H4zM4 11h16M9 3v4M15 3v4',
    },
    {
      label: 'TOTAL BOOKINGS', value: fmt(d.totalBookings),
      foot: d.totalBookings ? 'confirmed seats booked' : 'No bookings yet',
      icon: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z',
    },
    {
      label: 'TOTAL REVENUE', value: `₹${fmt(d.totalRevenue)}`,
      foot: 'from confirmed bookings',
      icon: 'M7 5h10M7 9h10M7 5c5 0 6 8 0 8l7 6',
    },
  ];

  return (
    <div className="w-full min-h-screen bg-dark-bg flex flex-col">
      <OrganizerNavbar active="dashboard" />
      <main className="flex-1 px-4 md:px-16 py-6 md:py-10 flex flex-col gap-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
          <div className="flex flex-col gap-2">
            <span className="font-label text-xs tracking-widest text-gold">ORGANIZER CONSOLE</span>
            <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">Dashboard</h1>
            <span className="text-sm text-gray-text">How your events are doing right now.</span>
          </div>
          <span role="status" className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#121017] border border-dark-border font-label text-xs text-gray-text">
            <span className="livedot w-2 h-2 rounded-full bg-gold" />
            {loading ? 'Loading…' : `Synced ${secsAgo < 2 ? 'just now' : `${secsAgo}s ago`}`}
          </span>
        </div>

        {showFailedBanner && (
          <div className="bg-dark-card border border-danger/35 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 shrink-0 rounded-full bg-danger/15 text-danger flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold">Couldn&rsquo;t load dashboard data</span>
                <span className="text-xs text-gray-text">Check that the server is running, then retry.</span>
              </div>
            </div>
            <button type="button" onClick={() => load(false)} className="h-10 px-4 rounded-[10px] border border-dark-border text-sm font-semibold hover:bg-dark-card-hover hover:border-dark-border-hover transition-colors shrink-0">
              Retry
            </button>
          </div>
        )}

        <section aria-label="Key numbers" className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {loading ? (
            [1, 2, 3, 4].map((k) => (
              <div key={k} className="bg-dark-card border border-dark-border rounded-2xl p-5 md:p-6 flex flex-col gap-3">
                <div className="sk w-3/4 h-3" />
                <div className="sk w-1/2 h-9" />
                <div className="sk w-2/3 h-3" />
              </div>
            ))
          ) : (
            <>
              {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
              <KpiCard
                label="ACTIVE HOLDS" value={String(d.activeHolds)} live
                foot={d.activeHolds ? `seats held now across ${d.activeHoldEvents} events` : 'No seats on hold right now'}
              />
            </>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-6 items-start">
          <section aria-labelledby="up-h" className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-5 border-b border-dark-border">
              <div className="flex flex-col gap-0.5">
                <h2 id="up-h" className="text-[17px] font-bold m-0">Upcoming events</h2>
                <span className="text-[13px] text-gray-text">{loading ? 'Loading…' : upcoming.length ? `Next ${upcoming.length}, soonest first` : 'Nothing scheduled'}</span>
              </div>
              <Link to="/organizer/events" className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-text hover:text-gold transition-colors">
                All events
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
            {loading && [1, 2, 3, 4].map((k) => (
              <div key={k} className="flex items-center gap-4 px-6 py-4 border-b border-dark-border">
                <div className="sk w-12 h-12 rounded-[10px]" />
                <div className="flex-grow flex flex-col gap-2"><div className="sk w-2/3 h-4" /><div className="sk w-1/2 h-3" /></div>
              </div>
            ))}
            {!loading && upcoming.length === 0 && (
              <div className="py-12 px-6 flex flex-col items-center gap-3 text-center">
                <span className="w-11 h-11 rounded-xl bg-dark-card-hover text-gray-text flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
                </span>
                <span className="text-[15px] font-bold">No upcoming events</span>
                <span className="text-[13px] leading-relaxed text-gray-text max-w-[280px]">Events you create will show up here with their dates.</span>
                <Link to="/organizer/events/new" className="mt-1 text-sm font-bold flex items-center gap-1.5">+ Add your first event</Link>
              </div>
            )}
            {!loading && upcoming.map((e) => {
              const d = new Date(e.date);
              const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
              return (
                <Link key={e.id} to="/organizer/events" className="flex items-center gap-4 px-6 py-3.5 border-b border-dark-border hover:bg-dark-card-hover/60 transition-colors group">
                  <div className="w-12 h-12 shrink-0 rounded-[10px] bg-[#121017] border border-dark-border-hover flex flex-col items-center justify-center gap-0.5">
                    <span className="font-display text-xl font-semibold leading-none">{String(d.getDate()).padStart(2, '0')}</span>
                    <span className="font-label text-[10px] tracking-widest text-gold">{MON[d.getMonth()]}</span>
                  </div>
                  <div className="flex-grow min-w-0 flex flex-col gap-1">
                    <span className="text-[15px] font-bold truncate">{e.title}</span>
                    <span className="text-[13px] text-gray-text truncate">{e.venue} &middot; <span className="font-label text-xs">{DOW[d.getDay()]} {time12(d)}</span></span>
                  </div>
                  <span className="shrink-0 text-xs text-gray-text">{days <= 1 ? 'Tomorrow' : `in ${days}d`}</span>
                  <svg className="shrink-0 text-gray-text group-hover:text-gold group-hover:translate-x-0.5 transition-transform" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </Link>
              );
            })}
          </section>

          <section aria-labelledby="bk-h" className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-dark-border">
              <h2 id="bk-h" className="text-[17px] font-bold m-0">Recent bookings</h2>
              <span className="text-[13px] text-gray-text">
                {loading ? 'Loading…' : d.recentBookings.length ? `Latest ${d.recentBookings.length}, newest first` : 'Nothing yet'}
              </span>
            </div>
            {loading && [1, 2, 3, 4, 5, 6].map((k) => (
              <div key={k} className="flex items-center gap-4 px-6 py-[18px] border-b border-dark-border">
                <div className="sk w-8 h-8 rounded-full" />
                <div className="flex-grow flex flex-col gap-2"><div className="sk w-1/2 h-3.5" /><div className="sk w-1/4 h-3" /></div>
                <div className="sk w-16 h-4" />
              </div>
            ))}
            {!loading && d.recentBookings.length === 0 && (
              <div className="py-12 px-6 flex flex-col items-center gap-3 text-center">
                <span className="w-11 h-11 rounded-xl bg-dark-card-hover text-gray-text flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /></svg>
                </span>
                <span className="text-[15px] font-bold">No bookings yet</span>
                <span className="text-[13px] leading-relaxed text-gray-text max-w-[300px]">When customers book seats for your events, the latest ones appear here.</span>
              </div>
            )}
            {!loading && d.recentBookings.map((b) => (
              <div key={b.bookingId} className="flex items-center gap-3.5 px-6 py-3.5 border-b border-dark-border hover:bg-dark-card-hover/60 transition-colors">
                <span className="w-8 h-8 shrink-0 rounded-full bg-gold-muted text-gold flex items-center justify-center">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
                <div className="flex-grow min-w-0 flex flex-col gap-0.5">
                  <span className="text-sm font-bold truncate">{b.eventTitle}</span>
                  <span className="text-[13px] text-gray-text">
                    <span className="font-label text-gray-light">{b.seats} {b.seats === 1 ? 'seat' : 'seats'}</span> &middot; {ago(b.createdAt)}
                  </span>
                </div>
                <span className="shrink-0 font-label text-sm">&#8377;{fmt(b.amount)}</span>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
