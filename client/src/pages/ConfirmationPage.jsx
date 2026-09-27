import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../services/api';
import { CustomerHeader } from '../components/CustomerHeader';
import { categoryColor } from '../lib/categoryColors';
import { dateParts, inr, time12 } from '../lib/format';

const STATES = {
  SUCCESS: {
    eyebrow: 'YOU’RE IN', title: 'Booking confirmed',
    body: () => 'Your seats are locked in. Show this booking code at the venue entry.',
    color: '#5FD35F', bg: 'rgba(12,163,12,.12)', border: 'rgba(12,163,12,.5)',
  },
  REFUND_PENDING: {
    eyebrow: 'PAYMENT RECEIVED · HOLD EXPIRED', title: 'Refund pending',
    body: (p) => `Your payment came through after your hold ran out, so these seats weren’t booked. A full refund of ${inr(p.amount)} is on its way, usually in 5–7 working days.`,
    color: '#FAB219', bg: 'rgba(250,178,25,.12)', border: 'rgba(250,178,25,.5)',
  },
  FAILED: {
    eyebrow: 'NOTHING WAS CHARGED', title: 'Payment failed',
    body: () => 'The payment didn’t go through and no money was taken. If your hold hasn’t run out, you can go back and try again.',
    color: '#F97066', bg: 'rgba(249,112,102,.12)', border: 'rgba(249,112,102,.5)',
  },
  PENDING: {
    eyebrow: 'CONFIRMING', title: 'Confirming your payment',
    body: () => 'This usually takes a few seconds. This page updates on its own.',
    color: '#F5B544', bg: 'rgba(245,181,68,.12)', border: 'rgba(245,181,68,.5)',
  },
};

const Glyph = ({ status, size }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (status === 'SUCCESS') return <svg {...common} strokeWidth="2.6"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (status === 'FAILED') return <svg {...common} strokeWidth="2.6"><path d="M6 6l12 12M18 6L6 18" /></svg>;
  return <svg {...common} strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
};

export default function ConfirmationPage() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let timer;
    const load = () => api.get(`/payments/${paymentId}`)
      .then(({ data }) => {
        if (!alive) return;
        setPayment(data);
        if (data.status === 'PENDING') timer = setTimeout(load, 1500);
      })
      .catch((err) => { if (alive) setError(err.response?.status === 404 || err.response?.status === 400 ? 'We couldn’t find this booking.' : errorMessage(err)); });
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [paymentId]);

  if (!payment && !error) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <CustomerHeader />
        <main aria-busy="true" className="flex-1 flex flex-col items-center gap-6 px-4 pt-12">
          <div className="sk w-20 h-20 rounded-full" /><div className="sk w-72 h-10" /><div className="sk w-full max-w-[560px] h-80 rounded-[20px]" />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <CustomerHeader />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="m-0 font-display text-3xl font-medium">{error}</h1>
          <Link to="/events" className="btn-gold min-h-11 px-5 rounded-[10px] text-sm font-bold flex items-center">Browse events</Link>
        </main>
      </div>
    );
  }

  const st = STATES[payment.status] || STATES.PENDING;
  const ok = payment.status === 'SUCCESS';
  const refund = payment.status === 'REFUND_PENDING';
  const failed = payment.status === 'FAILED';
  const ev = payment.event;
  const p = ev ? dateParts(ev.date) : null;
  const gates = ev ? time12(new Date(new Date(ev.date).getTime() - 30 * 60000)) : '';
  const code = payment.bookingCode || `PAY-${String(payment.paymentId).padStart(6, '0')}`;

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <CustomerHeader />
      <main className="flex-1 flex flex-col items-center gap-7 px-4 md:px-16 pt-8 md:pt-12 pb-12">
        <div role="status" className="flex flex-col items-center gap-4 text-center max-w-[520px]">
          <div className="pop-in w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-2"
            style={{ background: st.bg, borderColor: st.border, color: st.color }}>
            <Glyph status={payment.status} size={34} />
          </div>
          <span className="font-label text-xs tracking-[0.16em]" style={{ color: st.color }}>{st.eyebrow}</span>
          <h1 className="m-0 font-display text-[34px] md:text-5xl font-medium leading-[1.05] tracking-[-0.02em]">{st.title}</h1>
          <p className="m-0 text-[15px] leading-relaxed text-gray-text">{st.body(payment)}</p>
        </div>

        {!failed && ev && (
          <article aria-label={`${ok ? 'Ticket' : 'Booking'} ${code}, ${st.title}`}
            className="rise w-full max-w-[560px] rounded-[20px] overflow-hidden bg-dark-card border border-dark-border shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_32px_64px_-28px_rgba(0,0,0,.95)]">
            <div className="p-5 md:p-8 flex flex-col gap-5">
              <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="font-label text-[11px] tracking-[0.16em] text-[#8F89A0]">{refund ? 'PAYMENT REFERENCE' : 'BOOKING CODE'}</span>
                  <span className={`font-label text-[22px] md:text-[28px] tracking-[0.06em] ${refund ? 'text-[#8F89A0]' : 'text-gold'}`}>{code}</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border"
                  style={{ background: st.bg, borderColor: st.border, color: st.color }}>
                  <Glyph status={payment.status} size={12} />{ok ? 'Confirmed' : refund ? 'Refund pending' : 'Confirming'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="m-0 font-display text-[22px] md:text-[28px] font-medium leading-[1.15]">{ev.title}</h2>
                <span className="text-sm text-gray-text">{ev.venue}{ev.city ? `, ${ev.city}` : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1"><span className="font-label text-[11px] tracking-[0.14em] text-[#8F89A0]">DATE</span><span className="font-label text-[15px]">{p.dow} {p.day} {p.mon} {p.year}</span></div>
                <div className="flex flex-col gap-1"><span className="font-label text-[11px] tracking-[0.14em] text-[#8F89A0]">TIME</span><span className="font-label text-[15px]">{p.time}</span></div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-label text-[11px] tracking-[0.14em] text-[#8F89A0]">{refund ? 'SEATS · NOT BOOKED' : 'SEATS'}</span>
                <div className="flex flex-wrap gap-2">
                  {payment.seats.map((s) => (
                    <span key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[#121017] border border-[#2C2838] ${refund ? 'opacity-50' : ''}`}>
                      <span className="w-2 h-2 rounded-[2px]" style={{ background: categoryColor(s.categoryIndex) }} />
                      <span className={`font-label text-sm ${refund ? 'line-through' : ''}`}>{s.seatNumber}</span>
                      <span className="text-xs text-[#8F89A0]">{s.categoryName}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="tear" aria-hidden="true" />
            <div className="px-5 py-5 md:px-8 md:py-6 flex justify-between items-center gap-4 bg-[#131119]">
              <div className="flex flex-col gap-1">
                <span className="font-label text-[11px] tracking-[0.14em] text-[#8F89A0]">{refund ? 'AMOUNT TO REFUND' : 'AMOUNT PAID'}</span>
                <span className="font-display text-[30px] font-semibold leading-none">{inr(payment.amount)}</span>
              </div>
              <div className="flex flex-col gap-1 items-end text-right">
                <span className="font-label text-[11px] tracking-[0.14em] text-[#8F89A0]">{refund ? 'REFUND STATUS' : 'ENTRY'}</span>
                <span className="text-[13px] text-gray-light max-w-[220px]">{refund ? 'Initiated · 5–7 working days' : ok ? `Gates open ${gates}` : 'Waiting for the bank'}</span>
              </div>
            </div>
          </article>
        )}

        <div className="flex flex-col md:flex-row gap-3 w-full max-w-[560px]">
          {failed && ev && (
            <Link to={`/events/${ev.id}/seats`} className="btn-gold flex-1 h-[52px] rounded-xl text-[15px] font-bold flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
              Back to seats
            </Link>
          )}
          <Link to="/events" className={`${failed ? 'btn-ghost' : 'btn-gold'} flex-1 h-[52px] rounded-xl text-[15px] font-bold flex items-center justify-center gap-2`}>
            Browse more events
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </main>
    </div>
  );
}
