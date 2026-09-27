import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { OrganizerNavbar } from '../../components/organizer/OrganizerNavbar';
import { useToast } from '../../components/toastContext';
import organizerApi from '../../services/organizerApi';
import { errorMessage } from '../../services/api';
import { toLocalInput } from '../../lib/format';
import { useNow } from '../../hooks/useNow';

const MAX_CATEGORIES = 10;
const MAX_TOTAL_SEATS = 20000;

const CATEGORIES = ['Concert', 'Comedy', 'Sports', 'Theatre'];
let nextCatId = 1;
const newCat = () => ({ id: nextCatId++, name: '', seats: '', price: '' });

const fmt = (n) => n.toLocaleString('en-IN');

export default function OrgAddEventPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [loadingEvent, setLoadingEvent] = useState(isEdit);
  const [existingCategories, setExistingCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Concert');
  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [cats, setCats] = useState([newCat(), newCat()]);
  const [touched, setTouched] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookedSeats, setBookedSeats] = useState(0);
  const now = useNow(30_000);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await organizerApi.getEvent(id);
        const ev = res.data;
        setTitle(ev.title);
        setCategory(ev.category);
        setCity(ev.city);
        setVenue(ev.venue);
        // datetime-local input needs "YYYY-MM-DDTHH:mm", not the ISO string the API returns.
        setDate(toLocalInput(ev.date));
        setDesc(ev.description || '');
        setExistingCategories(ev.categories || []);
        setBookedSeats(ev.bookedSeats || 0);
      } catch {
        toast.error('Could not load that event');
        navigate('/organizer/events');
      } finally {
        setLoadingEvent(false);
      }
    })();
  }, [id, isEdit, navigate, toast]);

  const touch = (key) => setTouched((p) => ({ ...p, [key]: true }));
  const editCat = (catId, field, val) => setCats((p) => p.map((c) => (c.id === catId ? { ...c, [field]: val } : c)));
  const addCat = () => setCats((p) => (p.length >= MAX_CATEGORIES ? p : [...p, newCat()]));
  const removeCat = (catId) => setCats((p) => (p.length <= 1 ? p : p.filter((c) => c.id !== catId)));

  const errors = useMemo(() => {
    const e = {};
    if (!title.trim()) e.title = 'Add an event title.';
    if (!city.trim()) e.city = 'Add the city.';
    if (!venue.trim()) e.venue = 'Add the venue.';
    if (!date) e.date = 'Pick a date and time.';
    else if (new Date(date).getTime() <= now) e.date = 'Date must be in the future.';

    if (!isEdit) {
      const seen = {};
      cats.forEach((c) => {
        const k = c.name.trim().toLowerCase();
        if (!k) e['n' + c.id] = 'Name required.';
        else if (seen[k]) e['n' + c.id] = 'Name already used.';
        if (k) seen[k] = true;
        const n = Number(c.seats);
        if (c.seats === '') e['s' + c.id] = 'Required.';
        else if (!Number.isInteger(n) || n <= 0) e['s' + c.id] = 'Must be above 0.';
        else if (n > 5000) e['s' + c.id] = 'Max 5,000.';
        const p = Number(c.price);
        if (c.price === '') e['p' + c.id] = 'Required.';
        else if (!(p > 0)) e['p' + c.id] = 'Must be above ₹0.';
      });
    }
    if (!isEdit) {
      const total = cats.reduce((a, c) => a + (Number.isInteger(Number(c.seats)) && Number(c.seats) > 0 ? Number(c.seats) : 0), 0);
      if (total > MAX_TOTAL_SEATS) e.total = `An event can have at most ${MAX_TOTAL_SEATS.toLocaleString('en-IN')} seats.`;
    }
    return e;
  }, [title, city, venue, date, cats, isEdit, now]);

  const show = (k) => !!errors[k] && (showAll || touched[k]);
  const valid = Object.keys(errors).length === 0;

  let totalSeats = 0, revenue = 0;
  cats.forEach((c) => {
    const n = Number(c.seats), p = Number(c.price);
    if (Number.isInteger(n) && n > 0) { totalSeats += n; if (p > 0) revenue += n * p; }
  });
  const maxSeats = Math.max(1, ...cats.map((c) => (Number(c.seats) > 0 ? Number(c.seats) : 0)));

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setShowAll(true);
    if (!valid) return;
    setSubmitting(true);
    try {
      if (isEdit) {
        await organizerApi.updateEvent(id, { title: title.trim(), category, city: city.trim(), venue: venue.trim(), date: new Date(date).toISOString(), description: desc.trim() });
        toast.success('Event updated');
      } else {
        await organizerApi.createEvent({
          title: title.trim(),
          category,
          city: city.trim(),
          venue: venue.trim(),
          date: new Date(date).toISOString(),
          description: desc.trim() || undefined,
          seatCategories: cats.map((c) => ({ name: c.name.trim(), price: Number(c.price), count: Number(c.seats) })),
        });
        toast.success('Event created');
      }
      navigate('/organizer/events');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the event'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <OrganizerNavbar active="add" />
        <div className="flex-1 flex justify-center items-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <OrganizerNavbar active={isEdit ? 'events' : 'add'} />

      <div className="flex flex-col gap-2 px-4 md:px-16 pt-6 md:pt-10 pb-6">
        <span className="font-label text-xs tracking-widest text-gray-text">
          <Link to="/organizer/events" className="text-gray-text hover:text-white">MY EVENTS</Link> / <span className="text-gold">{isEdit ? 'EDIT EVENT' : 'NEW EVENT'}</span>
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-medium leading-tight tracking-tight">{isEdit ? 'Edit event' : 'Add event'}</h1>
        <p className="text-sm text-gray-text max-w-2xl">
          {isEdit
            ? 'Event details can be changed any time before it has bookings. Seat categories are fixed once the event is created — its seats already exist.'
            : 'Fill in the details and seat categories. Seats are generated automatically when you create the event.'}
        </p>
        {isEdit && bookedSeats > 0 && (
          <p role="status" className="max-w-2xl mt-2 px-4 py-3 rounded-xl bg-gold-muted border border-gold/35 text-sm text-gray-light">
            This event has {bookedSeats} booked {bookedSeats === 1 ? 'seat' : 'seats'}, so its details are locked to keep tickets accurate.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col md:flex-row gap-8 items-start px-4 md:px-16 pb-12">
        <div className="grow min-w-0 flex flex-col gap-6 w-full">
          <section className="bg-dark-card border border-dark-border rounded-2xl p-4 md:p-7 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-dark-card-hover border border-dark-border-hover flex items-center justify-center font-label text-xs text-gold">1</span>
              <h2 className="text-lg font-bold m-0">Event details</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div className="md:col-span-2 flex flex-col gap-2">
                <label htmlFor="title" className="text-[13px] font-semibold text-gray-light">Event title</label>
                <input id="title" maxLength={120} placeholder="e.g. Symphony Under the Stars"
                  value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => touch('title')}
                  className={`h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none ${show('title') ? 'border-danger' : 'border-dark-border focus:border-gold'}`} />
                {show('title') && <p role="alert" className="fade text-danger text-[13px] m-0">{errors.title}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="cat" className="text-[13px] font-semibold text-gray-light">Category</label>
                <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}
                  className="h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border border-dark-border outline-none cursor-pointer">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="city" className="text-[13px] font-semibold text-gray-light">City</label>
                <input id="city" placeholder="e.g. Pune" value={city} onChange={(e) => setCity(e.target.value)} onBlur={() => touch('city')}
                  className={`h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none ${show('city') ? 'border-danger' : 'border-dark-border focus:border-gold'}`} />
                {show('city') && <p role="alert" className="fade text-danger text-[13px] m-0">{errors.city}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="venue" className="text-[13px] font-semibold text-gray-light">Venue</label>
                <input id="venue" placeholder="e.g. Open Lawn, Heritage Grounds" value={venue} onChange={(e) => setVenue(e.target.value)} onBlur={() => touch('venue')}
                  className={`h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none ${show('venue') ? 'border-danger' : 'border-dark-border focus:border-gold'}`} />
                {show('venue') && <p role="alert" className="fade text-danger text-[13px] m-0">{errors.venue}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="date" className="text-[13px] font-semibold text-gray-light">Date &amp; time</label>
                <input id="date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} onBlur={() => touch('date')}
                  className={`h-[46px] box-border px-3.5 rounded-[10px] text-[15px] bg-[#121017] border outline-none [color-scheme:dark] ${show('date') ? 'border-danger' : 'border-dark-border focus:border-gold'}`} />
                {show('date') && <p role="alert" className="fade text-danger text-[13px] m-0">{errors.date}</p>}
              </div>
              <div className="md:col-span-2 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="desc" className="text-[13px] font-semibold text-gray-light">Description <span className="font-medium text-gray-text">(optional)</span></label>
                  <span className="font-label text-[11px] text-gray-text">{desc.length} / 1000</span>
                </div>
                <textarea id="desc" maxLength={1000} rows={4} placeholder="What should attendees know? Line-up, entry rules, age limits…"
                  value={desc} onChange={(e) => setDesc(e.target.value)}
                  className="box-border px-3.5 py-3 rounded-[10px] text-[15px] leading-normal bg-[#121017] border border-dark-border outline-none resize-y" />
              </div>
            </div>
          </section>

          {isEdit ? (
            <section className="bg-dark-card border border-dark-border rounded-2xl p-4 md:p-7 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-dark-card-hover border border-dark-border-hover flex items-center justify-center font-label text-xs text-gold">2</span>
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-lg font-bold m-0">Seat categories (fixed)</h2>
                  <p className="text-[13px] text-gray-text m-0">Seats already exist for this event, so categories, counts and prices can’t change here.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {existingCategories.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-[#121017] border border-dark-border rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="font-label text-sm text-gray-text">₹{Number(c.price).toFixed(0)} / seat</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="bg-dark-card border border-dark-border rounded-2xl p-4 md:p-7 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 shrink-0 rounded-lg bg-dark-card-hover border border-dark-border-hover flex items-center justify-center font-label text-xs text-gold">2</span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-bold m-0">Seat categories</h2>
                  <p className="text-[13px] leading-snug text-gray-text m-0">First category sits closest to the stage. Max 5,000 seats per category.</p>
                </div>
              </div>
              <div className="hidden md:grid grid-cols-[40px_minmax(0,1fr)_120px_150px_130px_40px] gap-3 px-3 font-label text-[11px] tracking-wider text-gray-text">
                <span>#</span><span>NAME</span><span>SEATS</span><span>PRICE / SEAT</span><span className="text-right">SUBTOTAL</span><span />
              </div>
              <div className="flex flex-col gap-2.5">
                {cats.map((c, i) => {
                  const n = Number(c.seats), p = Number(c.price);
                  const sub = Number.isInteger(n) && n > 0 && p > 0 ? n * p : 0;
                  const label = c.name.trim() || `category ${i + 1}`;
                  return (
                    <div key={c.id} role="group" aria-label={`Seat category ${i + 1}`}
                      className="fade grid grid-cols-2 md:grid-cols-[40px_minmax(0,1fr)_120px_150px_130px_40px] gap-3 items-start p-3 rounded-xl bg-[#121017] border border-dark-border">
                      <span className="hidden md:flex h-11 items-center font-label text-[13px] text-gold">{String(i + 1).padStart(2, '0')}</span>
                      <div className="col-span-2 md:col-span-1 flex flex-col gap-1.5">
                        <input aria-label={`Category ${i + 1} name`} placeholder="e.g. VIP" value={c.name}
                          onChange={(e) => editCat(c.id, 'name', e.target.value)} onBlur={() => touch('n' + c.id)}
                          className={`h-11 box-border px-3 rounded-[9px] text-[15px] bg-dark-bg border outline-none ${show('n' + c.id) ? 'border-danger' : 'border-dark-border focus:border-gold'}`} />
                        {show('n' + c.id) && <p className="text-danger text-xs m-0">{errors['n' + c.id]}</p>}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <input type="number" inputMode="numeric" min={1} max={5000} placeholder="0" aria-label={`Seats in ${label}`} value={c.seats}
                          onChange={(e) => editCat(c.id, 'seats', e.target.value)} onBlur={() => touch('s' + c.id)}
                          className={`h-11 box-border px-3 rounded-[9px] font-label text-sm bg-dark-bg border outline-none ${show('s' + c.id) ? 'border-danger' : 'border-dark-border focus:border-gold'}`} />
                        {show('s' + c.id) && <p className="text-danger text-xs m-0">{errors['s' + c.id]}</p>}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="relative">
                          <span aria-hidden="true" className="absolute left-3 top-3 font-label text-sm text-gray-text">₹</span>
                          <input type="number" inputMode="decimal" min={1} placeholder="0" aria-label={`Price per seat for ${label}`} value={c.price}
                            onChange={(e) => editCat(c.id, 'price', e.target.value)} onBlur={() => touch('p' + c.id)}
                            className={`w-full h-11 box-border pl-7 pr-3 rounded-[9px] font-label text-sm bg-dark-bg border outline-none ${show('p' + c.id) ? 'border-danger' : 'border-dark-border focus:border-gold'}`} />
                        </div>
                        {show('p' + c.id) && <p className="text-danger text-xs m-0">{errors['p' + c.id]}</p>}
                      </div>
                      <span className="hidden md:flex h-11 items-center justify-end font-label text-sm" style={{ color: sub ? '#F4F1EA' : '#6B6478' }}>₹{fmt(sub)}</span>
                      <button type="button" aria-label={`Remove ${label}`} title={cats.length <= 1 ? 'At least one category is required' : `Remove ${label}`}
                        disabled={cats.length <= 1} onClick={() => removeCat(c.id)}
                        className="w-10 h-11 rounded-[9px] flex items-center justify-center text-gray-text hover:text-danger hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              {errors.total && (showAll || totalSeats > 0) && <p role="alert" className="fade text-danger text-[13px] m-0">{errors.total}</p>}
              <button type="button" onClick={addCat} disabled={cats.length >= MAX_CATEGORIES}
                className="h-[52px] rounded-xl border-[1.5px] border-dashed border-dark-border-hover text-gold text-sm font-bold flex items-center justify-center gap-2 hover:bg-gold/5 hover:border-gold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                {cats.length >= MAX_CATEGORIES ? `Up to ${MAX_CATEGORIES} categories` : 'Add another category'}
              </button>
            </section>
          )}
        </div>

        {!isEdit && (
          <aside className="w-full md:w-[360px] shrink-0 bg-dark-card border border-dark-border rounded-2xl p-6 md:p-7 flex flex-col gap-5 md:sticky md:top-6">
            <span className="font-label text-xs tracking-widest text-gold">SUMMARY</span>
            <div role="status" aria-live="polite" className="flex flex-col gap-1">
              <span className="font-display text-5xl font-semibold leading-none">{fmt(totalSeats)}</span>
              <span className="text-sm text-gray-text">total seats across {cats.length} {cats.length === 1 ? 'category' : 'categories'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-display text-2xl font-medium leading-tight">₹{fmt(revenue)}</span>
              <span className="text-[13px] text-gray-text">potential revenue if every seat sells</span>
            </div>
            <div className="flex flex-col gap-3">
              {cats.map((c, i) => {
                const n = Number(c.seats) > 0 ? Number(c.seats) : 0;
                return (
                  <div key={c.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-gray-light">{c.name.trim() || `Category ${i + 1}`}</span>
                      <span className="font-label text-gray-text">{c.seats || 0}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-dark-border-hover overflow-hidden">
                      <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${Math.round((n / maxSeats) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="perf my-1 -mx-6 md:-mx-7" />
            {valid ? (
              <div className="fade flex items-center gap-2.5 text-sm font-semibold">
                <span className="w-6 h-6 rounded-full bg-gold/15 text-gold flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
                Ready to create
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <span className="text-sm font-bold">{Object.keys(errors).length} {Object.keys(errors).length === 1 ? 'thing' : 'things'} left before you can create</span>
              </div>
            )}
            <button type="submit" disabled={!valid || submitting}
              className="h-[52px] rounded-xl text-[15px] font-bold bg-gold text-dark-bg hover:bg-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer">
              {submitting && <svg className="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3a9 9 0 1 1-9 9" /></svg>}
              {submitting ? 'Creating event…' : 'Create Event'}
            </button>
          </aside>
        )}

        {isEdit && (
          <div className="w-full md:w-[280px] shrink-0 flex flex-col gap-3 md:sticky md:top-6">
            <button type="submit" disabled={!valid || submitting || bookedSeats > 0}
              className="h-[52px] rounded-xl text-[15px] font-bold bg-gold text-dark-bg hover:bg-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer">
              {submitting && <svg className="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3a9 9 0 1 1-9 9" /></svg>}
              {submitting ? 'Saving…' : bookedSeats > 0 ? 'Locked (has bookings)' : 'Save changes'}
            </button>
            <Link to="/organizer/events" className="h-[52px] rounded-xl border border-dark-border text-sm font-semibold flex items-center justify-center hover:bg-dark-card-hover">
              Cancel
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
