import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorCode, errorMessage } from '../services/api';
import { CustomerHeader } from '../components/CustomerHeader';
import { useToast } from '../components/toastContext';
import { useNow } from '../hooks/useNow';
import { categoryColor } from '../lib/categoryColors';
import { inr, longDate, mmss } from '../lib/format';

const RING = 2 * Math.PI * 58; // r = 58
const SHOW_TEST_SWITCH = import.meta.env.DEV; // never rendered in a production build

// One idempotency key per hold, kept for the whole checkout (reloads included). A retry after a
// decline or a network error sends the SAME key, which is what makes "you won't be charged
// twice" true: the server either replays the earlier result or re-attempts the same payment.
function paymentKeyFor(holdGroupId) {
  const storageKey = `snapseat:paykey:${holdGroupId}`;
  let key = null;
  try { key = sessionStorage.getItem(storageKey); } catch { /* storage blocked */ }
  if (!key) {
    key = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    try { sessionStorage.setItem(storageKey, key); } catch { /* keep in memory only */ }
  }
  return key;
}

export default function CheckoutPage() {
  const { holdGroupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(1000);

  const [hold, setHold] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | normal | processing | failed | expired | gone | paid
  const [endsAt, setEndsAt] = useState(null);
  const [failure, setFailure] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [simulateFail, setSimulateFail] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const pollRef = useRef(null);

  const stopPolling = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };

  const applyResult = useCallback((r) => {
    if (r.status === 'SUCCESS') { setPaymentId(r.paymentId); setPhase('paid'); }
    else if (r.status === 'FAILED') { setPhase('failed'); setFailure(r.failureReason || 'The bank declined this attempt.'); }
    else if (r.status === 'REFUND_PENDING') navigate(`/confirmation/${r.paymentId}`, { replace: true });
    return r.status;
  }, [navigate]);

  // A duplicate of an in-flight request comes back PENDING: watch the payment until it settles.
  const pollPayment = useCallback((pid) => {
    stopPolling();
    setPhase('processing');
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const { data } = await api.get(`/payments/${pid}`);
        if (data.status !== 'PENDING') { stopPolling(); applyResult(data); }
      } catch { /* keep trying */ }
      if (tries > 30) { stopPolling(); setPhase('failed'); setFailure('We couldn’t confirm the payment status. Retrying is safe, you won’t be charged twice.'); }
    }, 1000);
  }, [applyResult]);

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    let alive = true;
    api.get(`/holds/${holdGroupId}`)
      .then(({ data }) => {
        if (!alive) return;
        if (data.status === 'consumed') {
          navigate(`/confirmation/${data.paymentId}`, { replace: true });
          return;
        }
        setHold(data);
        setEndsAt(Date.now() + data.ttlSeconds * 1000);
        if (data.status === 'expired') setPhase('expired');
        else if (data.payment?.status === 'FAILED') { setPhase('failed'); setFailure(data.payment.failureReason || 'The bank declined this attempt.'); }
        else if (data.payment?.status === 'PENDING') pollPayment(data.payment.id);
        else setPhase('normal');
      })
      .catch((err) => {
        if (!alive) return;
        if (err.response?.status === 404 || err.response?.status === 400) setPhase('gone');
        else { setPhase('gone'); toast.error(errorMessage(err)); }
      });
    return () => { alive = false; };
  }, [holdGroupId, navigate, pollPayment, toast]);

  const secsLeft = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;
  // The hold runs out while the person is still deciding (or after a decline): show expired.
  const view = (phase === 'normal' || phase === 'failed') && endsAt && secsLeft <= 0 ? 'expired' : phase;
  const expired = view === 'expired' || view === 'gone';
  const low = secsLeft < 60 && !expired && view !== 'paid';
  const total = hold?.totalAmount || 0;
  const totalTtl = hold?.holdTtlSeconds || 300;

  const lines = useMemo(() => {
    const map = new Map();
    (hold?.seats || []).forEach((s) => {
      const l = map.get(s.categoryName) || { name: s.categoryName, count: 0, sum: 0 };
      l.count += 1; l.sum += s.price; map.set(s.categoryName, l);
    });
    return [...map.values()];
  }, [hold]);

  const pay = async () => {
    if (view === 'processing' || expired || view === 'paid') return;
    setPhase('processing');
    setFailure('');
    const key = paymentKeyFor(holdGroupId);
    try {
      const { data } = await api.post('/payments', { holdGroupId, idempotencyKey: key }, {
        headers: { 'Idempotency-Key': key, ...(SHOW_TEST_SWITCH && simulateFail ? { 'X-Simulate-Payment': 'decline' } : {}) },
      });
      if (data.status === 'PENDING') pollPayment(data.paymentId);
      else applyResult(data);
    } catch (err) {
      const code = errorCode(err);
      if (code === 'HOLD_EXPIRED') setPhase('expired');
      else if (code === 'PAYMENT_IN_PROGRESS' && err.response.data.paymentId) pollPayment(err.response.data.paymentId);
      else if (code === 'HOLD_NOT_FOUND') setPhase('gone');
      else {
        setPhase('failed');
        setFailure(err.response ? errorMessage(err) : 'We couldn’t reach the server. Retrying is safe, you won’t be charged twice.');
      }
    }
  };

  const release = async () => {
    if (releasing || view === 'processing') return;
    setReleasing(true);
    try {
      await api.delete(`/holds/${holdGroupId}`);
      toast.info('Seats released.');
      navigate(hold?.event ? `/events/${hold.event.id}/seats` : '/events');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not release the seats'));
      setReleasing(false);
    }
  };

  const seatsLink = hold?.event ? `/events/${hold.event.id}/seats` : '/events';
  const ringColor = expired ? '#3A3448' : low ? '#F97066' : '#F5B544';
  const holdLabel = expired ? 'HOLD EXPIRED' : view === 'paid' ? 'PAID' : low ? 'HURRY — UNDER A MINUTE' : 'SEATS HELD FOR YOU';

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <CustomerHeader />
        <main aria-busy="true" className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-16 py-8 flex flex-col gap-6">
          <div className="sk w-32 h-4" /><div className="sk w-96 max-w-full h-10" />
          <div className="flex flex-col md:flex-row gap-6"><div className="sk flex-grow h-72 rounded-2xl" /><div className="sk md:w-[440px] h-72 rounded-2xl" /></div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <CustomerHeader />
      <main className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col gap-6 px-4 md:px-16 pt-4 md:pt-8 pb-12">
        <div className="flex flex-col gap-2">
          <Link to={seatsLink} className="self-start flex items-center gap-1.5 text-sm font-semibold min-h-7">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            Back to seats
          </Link>
          <span className="font-label text-xs tracking-[0.16em] text-gold">CHECKOUT</span>
          <h1 className="m-0 font-display text-[30px] md:text-[44px] font-medium leading-[1.05] tracking-[-0.02em]">{hold?.event?.title || 'Your hold'}</h1>
          {hold?.event && (
            <span className="text-sm text-gray-text">{hold.event.venue}{hold.event.city ? `, ${hold.event.city}` : ''} · <span className="font-label text-[#F4F1EA]">{longDate(hold.event.date)}</span></span>
          )}
        </div>

        <div className="flex flex-col-reverse md:flex-row gap-6 items-stretch md:items-start">
          <section aria-labelledby="seats-h" className="panel-card flex-grow min-w-0 rounded-2xl p-5 md:p-8 flex flex-col gap-5 overflow-hidden">
            <div className="flex justify-between items-baseline">
              <h2 id="seats-h" className="m-0 text-lg font-bold">{expired ? 'Seats released' : 'Your seats'}</h2>
              <span className="font-label text-xs text-[#8F89A0]">{hold?.seats?.length || 0} {hold?.seats?.length === 1 ? 'SEAT' : 'SEATS'}</span>
            </div>
            {hold?.seats?.length ? (
              <>
                <div className="flex flex-wrap gap-2.5">
                  {hold.seats.map((s) => (
                    <div key={s.id} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#121017] border border-[#2C2838] ${expired ? 'opacity-45' : ''}`}>
                      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: categoryColor(s.categoryIndex) }} />
                      <span className={`font-label text-[15px] font-medium ${expired ? 'line-through' : ''}`}>{s.seatNumber}</span>
                      <span className="text-[13px] text-gray-text">{s.categoryName}</span>
                      <span className="font-label text-[13px] text-gray-light">{inr(s.price)}</span>
                    </div>
                  ))}
                </div>
                <div className="perf my-1 -mx-5 md:-mx-8" />
                <div className="flex flex-col gap-2.5 text-sm">
                  {lines.map((l) => (
                    <div key={l.name} className="flex justify-between text-gray-text"><span>{l.name} × {l.count}</span><span className="font-label">{inr(l.sum)}</span></div>
                  ))}
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-gray-text">Total</span>
                  <span className="font-display text-4xl font-semibold">{inr(total)}</span>
                </div>
              </>
            ) : (
              <p className="m-0 text-sm text-gray-text">These seats have gone back on sale.</p>
            )}
          </section>

          <section aria-label="Payment" className="panel-card w-full md:w-[440px] md:shrink-0 box-border rounded-2xl p-5 md:p-8 flex flex-col gap-5">
            <div className="flex items-center gap-5">
              <div role="timer" aria-label={expired ? 'Hold expired' : `${mmss(secsLeft)} left to pay`} className={`relative w-[132px] h-[132px] shrink-0 ${low ? 'pulse-soft' : ''}`}>
                <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
                  <circle cx="66" cy="66" r="58" fill="none" stroke="#26222F" strokeWidth="8" />
                  <circle className="ring-progress" cx="66" cy="66" r="58" fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={RING} strokeDashoffset={RING * (1 - (expired ? 0 : Math.min(secsLeft, totalTtl)) / totalTtl)} transform="rotate(-90 66 66)" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <span className={`font-label text-[28px] ${expired ? 'text-[#8F89A0]' : low ? 'text-danger' : 'text-[#F4F1EA]'}`}>{expired ? '00:00' : mmss(secsLeft)}</span>
                  <span className="text-[11px] text-[#8F89A0]">{expired ? 'expired' : 'left to pay'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={`font-label text-xs tracking-[0.14em] ${expired ? 'text-[#8F89A0]' : low ? 'text-danger' : 'text-gold'}`}>{holdLabel}</span>
                <span className="text-sm leading-normal text-gray-text">
                  {expired ? `Your ${Math.round(totalTtl / 60)}-minute hold ran out before payment.` : 'Nobody else can book these seats until the timer ends.'}
                </span>
              </div>
            </div>

            {view === 'failed' && (
              <div role="alert" className="fade flex gap-3 p-3.5 rounded-xl bg-danger/8 border border-danger/40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97066" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="shrink-0 mt-px"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.01" /></svg>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold">Payment failed</span>
                  <span className="text-[13px] leading-normal text-gray-text">
                    {/[.!?]$/.test(failure) ? failure : `${failure || 'The bank declined this attempt'}.`} No money was taken and your seats are still held. Retrying is safe, you won’t be charged twice.
                  </span>
                </div>
              </div>
            )}

            {expired && (
              <div role="alert" className="fade flex flex-col gap-3.5">
                <div className="flex gap-3 p-3.5 rounded-xl bg-dark-card-hover border border-dark-border-hover">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A39DB0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 mt-px"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold">Your hold expired</span>
                    <span className="text-[13px] leading-normal text-gray-text">These seats went back on sale. Nothing was charged. Pick seats again to continue.</span>
                  </div>
                </div>
                <Link to={seatsLink} className="btn-gold h-14 rounded-xl text-base font-bold flex items-center justify-center gap-2">Pick seats again</Link>
              </div>
            )}

            {view === 'paid' && (
              <div role="status" className="fade flex flex-col gap-3.5">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[rgba(12,163,12,.1)] border border-[rgba(12,163,12,.4)] text-sm font-bold text-[#5FD35F]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  Payment received
                </div>
                <Link to={`/confirmation/${paymentId}`} className="btn-gold h-14 rounded-xl text-base font-bold flex items-center justify-center gap-2">View your ticket →</Link>
              </div>
            )}

            {!expired && view !== 'paid' && (
              <div className="flex flex-col gap-3">
                <button type="button" onClick={pay} disabled={view === 'processing'} aria-busy={view === 'processing'}
                  className={`btn-gold h-14 rounded-xl text-base font-bold flex items-center justify-center gap-2.5 ${view === 'processing' ? 'is-busy' : ''}`}>
                  {view === 'processing' && <svg className="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" /></svg>}
                  {view === 'processing' ? 'Processing payment…' : view === 'failed' ? `Retry payment · ${inr(total)}` : `Pay ${inr(total)}`}
                </button>
                <button type="button" onClick={release} disabled={view === 'processing' || releasing} className="btn-ghost h-12 rounded-xl text-sm font-semibold">
                  {releasing ? 'Releasing…' : 'Release seats'}
                </button>
                {view === 'processing' && <span role="status" className="text-xs text-[#8F89A0] text-center">Confirming with your bank. Don’t close this tab.</span>}
              </div>
            )}

            {SHOW_TEST_SWITCH && (
              <>
                <div className="perf -mx-5 md:-mx-8" />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="tm" className="text-[13px] font-semibold text-gray-light cursor-pointer">Test mode: simulate failure</label>
                    <span className="font-label text-[10px] tracking-[0.14em] text-[#8F89A0]">DEV BUILDS ONLY</span>
                  </div>
                  <button id="tm" type="button" role="switch" aria-checked={simulateFail} onClick={() => setSimulateFail((v) => !v)}
                    disabled={view === 'processing' || expired}
                    className={`w-11 h-[26px] shrink-0 rounded-full p-0.5 flex items-center border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${simulateFail ? 'bg-danger/25 border-danger' : 'bg-dark-border border-dark-border-hover'}`}>
                    <span className="w-5 h-5 rounded-full transition-transform" style={{ background: simulateFail ? '#F97066' : '#8F89A0', transform: `translateX(${simulateFail ? 18 : 0}px)` }} />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
