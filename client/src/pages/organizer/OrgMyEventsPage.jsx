import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { OrganizerNavbar } from '../../components/organizer/OrganizerNavbar';
import { organizerApi } from '../../services/organizerApi';
import { useToast } from '../../components/toastContext';
import { errorMessage } from '../../services/api';
import { useNow } from '../../hooks/useNow';

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const time12 = (d) => {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

function EventRow({ ev, onAskDelete, now }) {
  const d = new Date(ev.date);
  const isPast = d.getTime() <= now;
  const days = Math.ceil((d.getTime() - now) / 86400000);

  return (
    <>
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_240px_170px_120px_90px_140px_150px] items-center border-b border-dark-border hover:bg-dark-card-hover/60 transition-colors">
        <div className="px-6 py-4 min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-12 h-12 shrink-0 rounded-[10px] bg-[#121017] border ${isPast ? 'border-dark-border' : 'border-dark-border-hover'} flex flex-col items-center justify-center gap-0.5`}>
              <span className={`font-display text-xl font-semibold leading-none ${isPast ? 'text-gray-light' : 'text-white'}`}>{String(d.getDate()).padStart(2, '0')}</span>
              <span className={`font-label text-[10px] tracking-widest ${isPast ? 'text-gray-text' : 'text-gold'}`}>{MON[d.getMonth()]}</span>
            </div>
            <span className="text-[15px] font-bold truncate">{ev.title}</span>
          </div>
        </div>
        <div className="px-3 py-4 text-sm text-gray-light">
          <div className="truncate">{ev.venue}</div>
          <div className="text-[13px] text-gray-text">{ev.city}</div>
        </div>
        <div className="px-3 py-4 font-label text-[13px] text-gray-light">
          {DOW[d.getDay()]} {String(d.getDate()).padStart(2, '0')} {MON[d.getMonth()]} {d.getFullYear()}
          <div className="text-xs text-gray-text">{time12(d)}</div>
        </div>
        <div className="px-3 py-4">
          <span className="px-2.5 py-1 rounded-full bg-dark-card-hover border border-dark-border-hover text-xs font-semibold text-gray-light">{ev.category}</span>
        </div>
        <div className="px-3 py-4 text-right font-label text-sm">{ev.totalSeats.toLocaleString('en-IN')}</div>
        <div className="px-3 pl-7 py-4">
          {!isPast ? (
            <div className="flex flex-col gap-1">
              <span className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-muted border border-gold/35 text-xs font-bold text-gold">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" />Upcoming
              </span>
              <span className="text-xs text-gray-text">{days <= 1 ? 'Tomorrow' : `In ${days} days`}</span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dark-border-hover text-xs font-semibold text-gray-text">
              <span className="w-1.5 h-1.5 rounded-full border border-gray-text box-border" />Past
            </span>
          )}
        </div>
        <div className="px-3 pr-6 py-4">
          <div className="flex justify-end items-center gap-1.5">
            <Link to={`/organizer/events/${ev.id}/edit`} className="h-9 px-3 rounded-[9px] border border-dark-border text-[13px] font-semibold flex items-center gap-1.5 text-gray-light hover:bg-dark-card-hover hover:border-gold hover:text-gold transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M14 6l4 4" /></svg>
              Edit
            </Link>
            <button
              type="button" aria-label={`Delete ${ev.title}`} title="Delete" onClick={() => onAskDelete(ev)}
              className="w-9 h-9 rounded-[9px] flex items-center justify-center text-gray-text hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/35 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile card */}
      <article className={`md:hidden bg-dark-card border border-dark-border rounded-[14px] p-4 flex flex-col gap-3.5 ${isPast ? 'opacity-60' : ''}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className={`font-display text-3xl font-semibold leading-none ${isPast ? 'text-gray-light' : 'text-white'}`}>{String(d.getDate()).padStart(2, '0')}</span>
            <div className="flex flex-col gap-0.5">
              <span className={`font-label text-[11px] tracking-widest ${isPast ? 'text-gray-text' : 'text-gold'}`}>{MON[d.getMonth()]}</span>
              <span className="font-label text-[11px] text-gray-text">{time12(d)}</span>
            </div>
          </div>
          {!isPast ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-muted border border-gold/35 text-xs font-bold text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />{days <= 1 ? 'Tomorrow' : `in ${days}d`}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full border border-dark-border-hover text-xs font-semibold text-gray-text">Past</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold leading-snug">{ev.title}</h2>
          <span className="text-[13px] text-gray-text">{ev.venue} &middot; {ev.city}</span>
        </div>
        <div className="flex gap-2 items-center text-xs">
          <span className="px-2.5 py-1 rounded-full bg-dark-card-hover border border-dark-border-hover font-semibold text-gray-light">{ev.category}</span>
          <span className="font-label text-gray-light">{ev.totalSeats.toLocaleString('en-IN')} seats</span>
        </div>
        <div className="flex gap-2">
          <Link to={`/organizer/events/${ev.id}/edit`} className="flex-grow h-11 rounded-[10px] border border-dark-border text-sm font-semibold flex items-center justify-center gap-2 text-gray-light hover:bg-dark-card-hover hover:border-gold hover:text-gold transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M14 6l4 4" /></svg>
            Edit
          </Link>
          <button
            type="button" aria-label={`Delete ${ev.title}`} onClick={() => onAskDelete(ev)}
            className="w-11 h-11 rounded-[10px] border border-dark-border flex items-center justify-center text-gray-text hover:text-danger hover:border-danger/35 hover:bg-danger/10 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
          </button>
        </div>
      </article>
    </>
  );
}

export default function OrgMyEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEvent, setModalEvent] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    organizerApi.listEvents()
      .then((res) => { if (alive) setEvents(res.data); })
      .catch((err) => { if (alive) toast.error(errorMessage(err, 'Could not load your events.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [toast, reloadKey]);
  const load = () => setReloadKey((k) => k + 1);

  const now = useNow();
  const upcoming = events.filter((e) => new Date(e.date).getTime() > now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = events.filter((e) => new Date(e.date).getTime() <= now).sort((a, b) => new Date(b.date) - new Date(a.date));
  const isEmpty = !loading && events.length === 0;
  const blocked = modalEvent && modalEvent.bookedSeats > 0;

  const handleDelete = async () => {
    if (!modalEvent || deleting) return;
    setDeleting(true);
    try {
      await organizerApi.deleteEvent(modalEvent.id);
      toast.success(`"${modalEvent.title}" deleted`);
      setModalEvent(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete this event.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-dark-bg flex flex-col">
      <OrganizerNavbar active="events" />
      <main className="flex-1 px-4 md:px-16 py-6 md:py-10 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-label text-xs tracking-widest text-gold">ORGANIZER CONSOLE</span>
            <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">My Events</h1>
            <span role="status" className="text-sm text-gray-text">
              {loading ? 'Loading your events…' : isEmpty ? 'No events yet' : `${events.length} events · ${upcoming.length} upcoming`}
            </span>
          </div>
          <Link to="/organizer/events/new" className="h-12 px-5 rounded-xl bg-gold text-dark-bg hover:bg-gold-hover transition-colors text-[15px] font-bold flex items-center justify-center gap-2 w-fit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add New Event
          </Link>
        </div>

        {loading && (
          <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
            {[1, 2, 3, 4, 5].map((k) => (
              <div key={k} className="flex items-center gap-6 px-6 py-[18px] border-b border-dark-border">
                <div className="sk w-12 h-11 rounded-[10px] shrink-0" />
                <div className="flex-grow flex flex-col gap-2">
                  <div className="sk w-1/2 h-4" />
                  <div className="sk w-1/3 h-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="fade bg-dark-card border border-dark-border rounded-2xl py-16 px-6 flex flex-col items-center gap-6 text-center">
            <div className="w-[200px] h-28 opacity-80">
              <svg width="200" height="112" viewBox="0 0 200 112" fill="none">
                <path d="M16 8h168a8 8 0 0 1 8 8v24a16 16 0 0 0 0 32v24a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8V72a16 16 0 0 0 0-32V16a8 8 0 0 1 8-8z" fill="#121017" stroke="#3A3448" strokeWidth="2" />
                <path d="M64 12v88" stroke="#3A3448" strokeWidth="2" strokeDasharray="4 6" />
                <path d="M96 44h72M96 58h48M96 72h60" stroke="#2C2838" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-2.5 max-w-[420px]">
              <h2 className="font-display text-3xl font-medium">You haven&rsquo;t created any events yet</h2>
              <p className="text-[15px] leading-relaxed text-gray-text">Add your first event with its seat categories. It goes live for customers as soon as it&rsquo;s created.</p>
            </div>
            <Link to="/organizer/events/new" className="h-12 px-5 rounded-xl bg-gold text-dark-bg hover:bg-gold-hover transition-colors text-[15px] font-bold flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Create your first event
            </Link>
          </div>
        )}

        {!loading && !isEmpty && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_240px_170px_120px_90px_140px_150px] items-center bg-[#121017] border-b border-dark-border font-label text-[11px] tracking-wider text-gray-text text-left">
                <div className="px-6 py-4">EVENT</div>
                <div className="px-3 py-4">VENUE &middot; CITY</div>
                <div className="px-3 py-4">DATE &amp; TIME</div>
                <div className="px-3 py-4">CATEGORY</div>
                <div className="px-3 py-4 text-right">SEATS</div>
                <div className="px-3 pl-7 py-4">STATUS</div>
                <div className="px-3 pr-6 py-4 text-right">ACTIONS</div>
              </div>
              {upcoming.length > 0 && (
                <div className="px-6 py-3 bg-[#121017] border-b border-dark-border border-t border-dark-border font-label text-[11px] tracking-widest text-gray-text">
                  UPCOMING &middot; {upcoming.length}
                </div>
              )}
              {upcoming.map((ev) => <EventRow key={ev.id} ev={ev} onAskDelete={setModalEvent} now={now} />)}
              {past.length > 0 && (
                <div className="px-6 py-3 bg-[#121017] border-b border-dark-border border-t border-dark-border font-label text-[11px] tracking-widest text-gray-text">
                  PAST &middot; {past.length}
                </div>
              )}
              {past.map((ev) => <EventRow key={ev.id} ev={ev} onAskDelete={setModalEvent} now={now} />)}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-3">
              {upcoming.length > 0 && <span className="font-label text-[11px] tracking-widest text-gray-text pt-2">UPCOMING &middot; {upcoming.length}</span>}
              {upcoming.map((ev) => <EventRow key={ev.id} ev={ev} onAskDelete={setModalEvent} now={now} />)}
              {past.length > 0 && <span className="font-label text-[11px] tracking-widest text-gray-text pt-2">PAST &middot; {past.length}</span>}
              {past.map((ev) => <EventRow key={ev.id} ev={ev} onAskDelete={setModalEvent} now={now} />)}
            </div>
          </>
        )}
      </main>

      {modalEvent && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
          <button type="button" aria-label="Close dialog" onClick={() => !deleting && setModalEvent(null)} className="absolute inset-0 border-0 p-0 bg-black/70 backdrop-blur-sm cursor-default" />
          <div className="pop relative w-full max-w-[460px] bg-dark-card border border-dark-border rounded-2xl p-7 flex flex-col gap-5">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center ${blocked ? 'bg-dark-card-hover text-gray-text' : 'bg-danger/15 text-danger'}`}>
              {blocked ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              <h2 className="font-display text-2xl font-medium leading-tight">{blocked ? 'This event can’t be deleted' : 'Delete this event?'}</h2>
              <div className="px-3.5 py-3 rounded-[10px] bg-[#121017] border border-dark-border flex flex-col gap-1">
                <span className="text-[15px] font-bold">{modalEvent.title}</span>
                <span className="font-label text-xs text-gray-text">{modalEvent.venue}, {modalEvent.city}</span>
              </div>
              <p className="text-sm leading-relaxed text-gray-text">
                {blocked
                  ? `It has ${modalEvent.bookedSeats} booked seats. Events with confirmed bookings can't be deleted, so ticket holders keep a valid record.`
                  : `This removes the event and all ${modalEvent.totalSeats.toLocaleString('en-IN')} of its seats. Customers will no longer see it. This can't be undone.`}
              </p>
            </div>
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => !deleting && setModalEvent(null)} className="h-11 px-4.5 px-[18px] rounded-[10px] border border-dark-border text-sm font-semibold hover:bg-dark-card-hover transition-colors">
                {blocked ? 'Got it' : 'Cancel'}
              </button>
              {!blocked && (
                <button type="button" disabled={deleting} onClick={handleDelete} className="h-11 px-[18px] rounded-[10px] bg-danger text-[#1A0A08] text-sm font-bold flex items-center gap-2 disabled:opacity-70 disabled:cursor-progress hover:bg-[#FB8A80] transition-colors">
                  {deleting && <svg className="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3a9 9 0 1 1-9 9" /></svg>}
                  {deleting ? 'Deleting…' : 'Delete event'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
