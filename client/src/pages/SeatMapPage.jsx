import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorCode, errorMessage } from '../services/api';
import { CustomerHeader } from '../components/CustomerHeader';
import { ActiveHoldBanner } from '../components/ActiveHoldBanner';
import { useToast } from '../components/toastContext';
import { useNow } from '../hooks/useNow';
import { categoryColor } from '../lib/categoryColors';
import { inr, longDate, mmss } from '../lib/format';

const POLL_MS = 5000;
const SEATS_PER_ROW = 16;

const Icon = {
  check: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  lock: (s = 13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  x: (s = 12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
};

/** Categories become tiers; each tier's seats are laid out 16 per row in 4 | 8 | 4 blocks (two aisles). */
function buildTiers(categories, seats) {
  const byCat = new Map(categories.map((c) => [c.id, []]));
  seats.forEach((s) => byCat.get(s.categoryId)?.push({
    ...s,
    letter: (s.seatNumber.match(/^[A-Za-z]+/) || [''])[0],
    num: Number(s.seatNumber.replace(/^[A-Za-z]+/, '')) || 0,
  }));
  return categories.map((c) => {
    const list = (byCat.get(c.id) || []).sort((a, b) => a.num - b.num);
    const rows = [];
    for (let i = 0; i < list.length; i += SEATS_PER_ROW) {
      const chunk = list.slice(i, i + SEATS_PER_ROW);
      rows.push({ key: `${c.id}-${i}`, letter: chunk[0]?.letter, blocks: [chunk.slice(0, 4), chunk.slice(4, 12), chunk.slice(12, 16)].filter((b) => b.length) });
    }
    return { category: c, rows };
  });
}

export default function SeatMapPage() {
  const { id } = useParams();
  const eventId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(1000);

  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | notfound
  const [selected, setSelected] = useState([]);
  const [holding, setHolding] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [flash, setFlash] = useState([]);
  const [popId, setPopId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [syncedAt, setSyncedAt] = useState(() => Date.now());
  const [clockOffset, setClockOffset] = useState(0);

  // Mirrors of state read inside the polling callback (written only from handlers/callbacks).
  const selectedRef = useRef([]);
  const hadHoldRef = useRef(false);
  const releasedRef = useRef(false);

  const updateSelection = useCallback((next) => {
    selectedRef.current = next;
    setSelected(next);
  }, []);

  const flashSeats = useCallback((ids) => {
    setFlash(ids);
    setTimeout(() => setFlash([]), 1400);
  }, []);

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    const load = () => api.get(`/events/${eventId}/seats`)
      .then((res) => {
        if (!alive) return;
        const d = res.data;
        setData(d);
        setStatus('ready');
        setSyncedAt(Date.now());
        setClockOffset(new Date(d.serverTime).getTime() - Date.now());

        // Someone took a seat we had picked: drop it and say so (design: conflict toast).
        const byId = new Map(d.seats.map((s) => [s.id, s]));
        const lost = selectedRef.current.filter((sid) => byId.get(sid)?.status !== 'free');
        if (lost.length) {
          updateSelection(selectedRef.current.filter((sid) => !lost.includes(sid)));
          flashSeats(lost);
          const names = lost.map((sid) => byId.get(sid)?.seatNumber).filter(Boolean).join(', ');
          toast.warning(`${names} ${lost.length === 1 ? 'was' : 'were'} held by someone else a moment ago. Please reselect.`, {
            title: lost.length === 1 ? 'One of your seats was just taken' : 'Some of your seats were just taken',
          });
        }

        const hasHoldHere = d.myHold?.eventId === eventId;
        if (hadHoldRef.current && !hasHoldHere && !releasedRef.current) {
          toast.warning('The seats went back on sale. Pick again to hold them.', { title: 'Your hold expired' });
        }
        hadHoldRef.current = hasHoldHere;
        releasedRef.current = false;
      })
      .catch((err) => {
        if (!alive) return;
        if (err.response?.status === 404 || err.response?.status === 400) setStatus('notfound');
        else setStatus((s) => (s === 'ready' ? s : 'error')); // keep showing the last good map on a missed poll
      });
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [eventId, reloadKey, toast, updateSelection, flashSeats]);

  const tiers = useMemo(() => (data ? buildTiers(data.categories, data.seats) : []), [data]);
  const seatById = useMemo(() => new Map((data?.seats || []).map((s) => [s.id, s])), [data]);
  const catById = useMemo(() => new Map((data?.categories || []).map((c) => [c.id, c])), [data]);

  const maxSeats = data?.maxSeats || 4;
  const myHold = data?.myHold || null;
  const heldHere = myHold && myHold.eventId === eventId ? myHold : null;
  const heldElsewhere = myHold && myHold.eventId !== eventId ? myHold : null;
  const isPast = !!data?.event?.isPast;
  const holdLeft = heldHere ? Math.max(0, Math.floor((new Date(heldHere.expiresAt).getTime() - (now + clockOffset)) / 1000)) : 0;

  const pickedIds = heldHere ? heldHere.seatIds : selected;
  const picked = pickedIds.map((sid) => seatById.get(sid)).filter(Boolean);
  const total = picked.reduce((sum, s) => sum + (catById.get(s.categoryId)?.price || 0), 0);
  const count = picked.length;
  const maxed = count >= maxSeats;
  const locked = !!heldHere || !!heldElsewhere || isPast;

  const toggle = (seat) => {
    if (locked || holding) return;
    if (selected.includes(seat.id)) {
      updateSelection(selected.filter((x) => x !== seat.id));
    } else {
      if (selected.length >= maxSeats) return;
      updateSelection([...selected, seat.id]);
    }
    setPopId(seat.id);
    setTimeout(() => setPopId(null), 360);
  };

  const hold = async () => {
    if (!selected.length || holding) return;
    setHolding(true);
    try {
      await api.post('/holds', { eventId, seatIds: selected });
      updateSelection([]);
      hadHoldRef.current = true;
      toast.success(`They are yours for ${Math.round((data?.holdTtlSeconds || 300) / 60)} minutes. Pay before the timer ends to confirm.`, { title: 'Seats held for you' });
      reload();
    } catch (err) {
      const code = errorCode(err);
      const body = err.response?.data || {};
      if (code === 'SEAT_UNAVAILABLE') {
        const lost = body.unavailableSeatIds || [];
        updateSelection(selected.filter((x) => !lost.includes(x)));
        flashSeats(lost);
        toast.warning(`${(body.unavailableSeats || []).join(', ')} ${lost.length === 1 ? 'was' : 'were'} held by someone else a moment ago. Please reselect.`, {
          title: lost.length === 1 ? 'One of your seats was just taken' : 'Some of your seats were just taken',
        });
        reload();
      } else if (code === 'ACTIVE_HOLD_EXISTS') {
        toast.warning('Finish checkout for those seats, or release them first.', { title: 'You already have seats on hold' });
        reload();
      } else {
        toast.error(errorMessage(err, 'Could not hold these seats'));
      }
    } finally {
      setHolding(false);
    }
  };

  const release = async () => {
    if (!heldHere || releasing) return;
    setReleasing(true);
    try {
      await api.delete(`/holds/${heldHere.holdGroupId}`);
      releasedRef.current = true;
      hadHoldRef.current = false;
      toast.info('Seats released. Pick again whenever you’re ready.');
      reload();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not release the seats'));
    } finally {
      setReleasing(false);
    }
  };

  const secsAgo = Math.max(0, Math.round((now - syncedAt) / 1000));
  let hint = `Tap seats to pick up to ${maxSeats}.`;
  if (count === 0) hint = 'Pick at least 1 seat to hold.';
  if (maxed && !heldHere) hint = 'Limit reached. Tap a picked seat to swap it.';
  if (heldHere) hint = 'Held for you. Nobody else can take these.';
  if (heldElsewhere) hint = 'You have seats held for another event.';
  if (isPast) hint = 'This event has ended.';

  if (status === 'notfound') {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <CustomerHeader />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="m-0 font-display text-3xl font-medium">Event not found</h1>
          <p className="m-0 text-gray-text">It may have been removed by the organizer.</p>
          <Link to="/events" className="btn-gold min-h-11 px-5 rounded-[10px] text-sm font-bold flex items-center">Browse events</Link>
        </main>
      </div>
    );
  }

  const renderSeat = (seat) => {
    const isBooked = seat.status === 'booked';
    const isMine = !!heldHere && heldHere.seatIds.includes(seat.id);
    const isHeld = !isBooked && !isMine && seat.status === 'held';
    const isSel = !heldHere && selected.includes(seat.id);
    const isFree = !isBooked && !isHeld && !isSel && !isMine;
    const blocked = isFree && (maxed || locked);
    const cat = catById.get(seat.categoryId);
    let cls = isBooked ? 's-booked' : isHeld ? 's-held' : isMine ? 's-mine' : isSel ? 's-sel' : blocked ? 's-free s-maxed' : 's-free';
    if (popId === seat.id) cls += ' seat-pop';
    if (flash.includes(seat.id)) cls += ' seat-flash';
    const state = isBooked ? 'booked' : isHeld ? 'held by someone else' : isMine ? 'held for you' : isSel ? 'selected' : blocked ? (maxed ? `free, ${maxSeats} seat limit reached` : 'free') : 'free';
    return (
      <button key={seat.id} type="button" className={`seat ${cls} w-[30px] h-[30px] md:w-[34px] md:h-[34px] text-[10px] md:text-[11px]`}
        aria-label={`Seat ${seat.seatNumber}, ${cat?.name || ''} ${inr(cat?.price)}, ${state}`}
        aria-pressed={isSel || isMine}
        disabled={isBooked || isHeld || blocked || isMine}
        onClick={() => toggle(seat)}>
        {(isSel || isMine) ? Icon.check(15) : isHeld ? Icon.lock(12) : isBooked ? Icon.x(11) : seat.num}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <CustomerHeader />

      <div className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-3 px-4 md:px-16 py-4 md:py-5 border-b border-[#1F1C27]">
        <div className="flex flex-col gap-1.5 md:gap-2 min-w-0">
          <Link to="/events" className="self-start flex items-center gap-1.5 text-[13px] md:text-sm font-semibold min-h-7">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            Back to Events
          </Link>
          {data ? (
            <>
              <h1 className="m-0 font-display text-2xl md:text-[32px] font-medium leading-[1.1] tracking-[-0.01em]">{data.event.title}</h1>
              <span className="text-[13px] md:text-sm text-gray-text">{data.event.venue}{data.event.city ? `, ${data.event.city}` : ''}<span className="hidden md:inline"> · </span><span className="block md:inline font-label text-xs md:text-sm text-[#F4F1EA] mt-1 md:mt-0">{longDate(data.event.date)}</span></span>
            </>
          ) : (
            <><div className="sk w-72 h-8" /><div className="sk w-56 h-4" /></>
          )}
        </div>
        <div role="status" className="self-start md:self-auto flex items-center gap-2 px-3 py-2 rounded-full bg-[#121017] border border-[#1F1C27] text-xs text-gray-text">
          <span className={`w-2 h-2 rounded-full ${status === 'error' ? 'bg-danger' : 'bg-gold livedot'}`} />
          <span className="font-label">{status === 'error' ? 'OFFLINE · retrying' : `LIVE · synced ${secsAgo < 2 ? 'just now' : `${secsAgo}s ago`}`}</span>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center gap-6 md:gap-7 pt-6 md:pt-8 pb-64 md:pb-40">
        {heldElsewhere && (
          <div className="w-full max-w-[880px] px-4"><ActiveHoldBanner excludeEventId={eventId} onReleased={reload} /></div>
        )}
        {isPast && (
          <p role="status" className="mx-4 px-4 py-3 rounded-xl bg-dark-card border border-dark-border text-sm text-gray-light">This event has ended, so seats are no longer on sale.</p>
        )}
        {status === 'error' && !data && (
          <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
            <p className="m-0 text-gray-light">Couldn’t load the seat map. Check your connection.</p>
            <button type="button" onClick={reload} className="btn-ghost min-h-11 px-5 rounded-[10px] text-sm font-semibold">Try again</button>
          </div>
        )}

        {data && (
          <>
            <div className="flex flex-col items-center gap-2 w-full max-w-[680px] px-4" aria-hidden="true">
              <svg className="w-full h-auto max-w-[680px]" viewBox="0 0 680 36" fill="none">
                <path d="M8 32 Q340 -4 672 32" stroke="#F5B544" strokeWidth="3" strokeLinecap="round" />
                <path d="M8 32 Q340 -4 672 32" stroke="#F5B544" strokeOpacity=".18" strokeWidth="12" strokeLinecap="round" />
              </svg>
              <span className="font-label text-[11px] md:text-xs tracking-[0.3em] text-[#8F89A0]">STAGE THIS WAY</span>
            </div>

            <div className="relative w-full">
              <div className="hscroll px-4">
                <div role="grid" aria-label="Seat map" className="flex flex-col gap-2 md:gap-2.5 w-max mx-auto">
                  {tiers.map(({ category, rows }) => (
                    <div key={category.id} role="rowgroup" className="flex flex-col gap-2 md:gap-2.5">
                      <div className="flex items-center gap-3 pt-2">
                        <div className="flex-grow h-px bg-dark-border min-w-6" />
                        <span className="flex items-center gap-2 font-label text-[11px] md:text-xs tracking-[0.14em] text-gray-text whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: categoryColor(category.index) }} />
                          {category.name.toUpperCase()} · {inr(category.price)}
                          <span className="text-[#6B6478]">· {category.availableSeats} LEFT</span>
                        </span>
                        <div className="flex-grow h-px bg-dark-border min-w-6" />
                      </div>
                      {rows.map((row) => (
                        <div key={row.key} role="row" className="flex items-center justify-center gap-2.5 md:gap-4">
                          <span className="w-4 text-center font-label text-[11px] md:text-xs text-[#8F89A0]">{row.letter}</span>
                          <div className="flex gap-4 md:gap-7">
                            {row.blocks.map((block, bi) => (
                              <div key={bi} className="flex gap-1.5 md:gap-2">{block.map(renderSeat)}</div>
                            ))}
                          </div>
                          <span className="w-4 text-center font-label text-[11px] md:text-xs text-[#8F89A0]">{row.letter}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:hidden pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-dark-bg" />
            </div>
            <span className="md:hidden self-start px-4 text-xs text-[#8F89A0] flex items-center gap-1.5">Swipe the map sideways to see the full row →</span>

            <div className="mx-4 grid grid-cols-2 md:flex gap-3 md:gap-8 px-4 md:px-6 py-3.5 rounded-xl bg-[#121017] border border-[#1F1C27]">
              {[
                ['s-free', null, 'Free', '7'],
                ['s-sel', Icon.check(13), 'Selected (yours)'],
                ['s-held', Icon.lock(11), 'Held by someone else'],
                ['s-booked', Icon.x(10), 'Booked'],
              ].map(([cls, icon, label, num]) => (
                <div key={label} className="flex items-center gap-2.5 text-xs md:text-[13px] text-gray-text">
                  <span aria-hidden="true" className={`seat ${cls} w-6 h-6 text-[10px] pointer-events-none`}>{icon || num}</span>{label}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Sticky footer: selection summary + the one primary action. */}
      <footer className="fixed bottom-0 inset-x-0 z-20 bg-[#121017] border-t border-dark-border shadow-[0_-16px_32px_-16px_rgba(0,0,0,.8)] px-4 md:px-16 pt-3.5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] md:py-0">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center gap-3 md:gap-10 md:h-[104px]">
          <div className="flex items-center justify-between md:justify-start gap-4 md:w-[300px] md:shrink-0">
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5" aria-hidden="true">
                {Array.from({ length: maxSeats }, (_, i) => (
                  <span key={i} className={`pip ${i < count ? 'pip-on' : 'pip-off'} w-7 md:w-10 h-[5px] md:h-1.5 rounded-[3px]`} />
                ))}
              </div>
              <div className="flex flex-col gap-0.5">
                <span role="status" aria-live="polite" className="text-sm md:text-base font-bold">
                  <span className="font-label">{count} / {maxSeats}</span> seats {heldHere ? 'held' : 'selected'}
                  <span className="md:hidden font-normal text-gray-text">{picked.length ? ` · ${picked.map((s) => s.seatNumber).join(', ')}` : ''}</span>
                </span>
                <span className={`text-xs md:text-[13px] ${maxed && !heldHere ? 'text-gold' : 'text-[#8F89A0]'}`}>{hint}</span>
              </div>
            </div>
            <span className="md:hidden font-display text-[22px] font-semibold">{inr(total)}</span>
          </div>

          <div className="hidden md:flex flex-grow gap-2 flex-wrap min-w-0">
            {picked.map((s) => (
              <span key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#221E2C] border border-[#332E40] font-label text-[13px]">
                <span className="w-2 h-2 rounded-[2px]" style={{ background: categoryColor(catById.get(s.categoryId)?.index) }} />{s.seatNumber}
              </span>
            ))}
          </div>

          <div className="hidden md:flex flex-col items-end gap-0.5">
            <span className="text-xs text-[#8F89A0]">Total</span>
            <span className="font-display text-[28px] font-semibold">{inr(total)}</span>
          </div>

          {heldHere ? (
            <div className="flex gap-3">
              <button type="button" onClick={release} disabled={releasing} className="btn-ghost min-h-[52px] md:min-h-14 px-5 rounded-xl text-sm font-semibold">
                {releasing ? 'Releasing…' : 'Release'}
              </button>
              <button type="button" onClick={() => navigate(`/checkout/${heldHere.holdGroupId}`)}
                className="btn-gold flex-grow md:flex-grow-0 min-h-[52px] md:min-h-14 md:min-w-[220px] px-6 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2.5">
                Pay · <span className={`font-label ${holdLeft < 60 ? 'pulse-soft' : ''}`}>{mmss(holdLeft)}</span> left
              </button>
            </div>
          ) : (
            <button type="button" onClick={hold} disabled={count === 0 || holding || locked}
              className={`btn-gold min-h-[52px] md:min-h-14 md:min-w-[240px] px-6 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2.5 ${holding ? 'is-busy' : ''}`}>
              {holding ? (
                <><svg className="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" /></svg>Holding…</>
              ) : (
                <>{Icon.lock(18)}Hold Selected Seats</>
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
