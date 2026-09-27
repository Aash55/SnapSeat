import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../services/api';
import { useToast } from './toastContext';
import { mmss } from '../lib/format';

/**
 * "You still have seats held" strip. A customer who left checkout can resume or release
 * instead of being blocked by their own hold until it expires.
 */
export function ActiveHoldBanner({ excludeEventId, onReleased }) {
  const [hold, setHold] = useState(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    api.get('/holds/active').then((res) => {
      if (!alive || !res.data.hold) return;
      const h = res.data.hold;
      setHold({ ...h, endsAt: Date.now() + h.ttlSeconds * 1000 });
      setLeft(h.ttlSeconds);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!hold) return undefined;
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((hold.endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setHold(null);
    }, 1000);
    return () => clearInterval(id);
  }, [hold]);

  if (!hold || hold.eventId === excludeEventId) return null;

  const release = async () => {
    setBusy(true);
    try {
      await api.delete(`/holds/${hold.holdGroupId}`);
      setHold(null);
      toast.success('Seats released');
      onReleased?.();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not release the seats'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="status" className="fade flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3.5 rounded-[14px] bg-[#1D1A25] border border-[#5A4220]">
      <span className="w-8 h-8 shrink-0 rounded-full bg-gold/15 text-gold hidden sm:flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      </span>
      <div className="flex-grow min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] font-bold">You have {hold.seatIds.length} {hold.seatIds.length === 1 ? 'seat' : 'seats'} held</span>
        <span className="text-sm text-gray-text truncate">{hold.eventTitle} · <span className="font-label text-gold">{mmss(left)}</span> left to pay</span>
      </div>
      <div className="flex gap-2 shrink-0">
        <button type="button" onClick={release} disabled={busy} className="btn-ghost min-h-11 px-4 rounded-[10px] text-sm font-semibold">Release</button>
        <Link to={`/checkout/${hold.holdGroupId}`} className="btn-gold min-h-11 px-4 rounded-[10px] text-sm font-bold flex items-center">Resume checkout</Link>
      </div>
    </div>
  );
}
