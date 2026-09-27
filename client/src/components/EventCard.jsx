import { Link } from 'react-router-dom';
import { dateParts, inr } from '../lib/format';

export const EventCard = ({ event }) => {
  const { id, title, venue, city, date, availableSeats, minPrice } = event;
  const p = dateParts(date);
  const soldOut = availableSeats === 0;
  const few = !soldOut && availableSeats <= 10;

  return (
    <article className="ev-card rounded-2xl p-6 flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center gap-3">
        <span className="font-display text-[44px] font-semibold leading-none text-[#F4F1EA]">{p.day}</span>
        <div className="flex flex-col gap-1 font-label text-xs tracking-[0.12em]">
          <span className="text-gold">{p.mon}</span>
          <span className="text-[#8F89A0]">{p.dow}</span>
        </div>
      </div>
      <h2 className="m-0 font-display text-2xl font-medium leading-[1.2] min-h-[58px] text-[#F4F1EA] line-clamp-2">{title}</h2>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-gray-text text-sm min-w-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          <span className="truncate">{venue}{city ? `, ${city}` : ''}</span>
        </div>
        <span className={`font-label text-[11px] tracking-[0.1em] ${soldOut ? 'text-danger' : few ? 'text-gold' : 'text-[#8F89A0]'}`}>
          {soldOut ? 'SOLD OUT' : `${minPrice ? `FROM ${inr(minPrice)} · ` : ''}${availableSeats} ${few ? 'LEFT' : 'SEATS LEFT'}`}
        </span>
      </div>
      <div className="perf -mx-6" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-label text-[13px] text-[#F4F1EA]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8F89A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <span>{p.time}</span>
        </div>
        {soldOut ? (
          <span className="min-h-11 px-5 rounded-[10px] bg-[#26222F] text-[#6B6478] text-sm font-bold flex items-center">Sold out</span>
        ) : (
          <Link to={`/events/${id}/seats`} aria-label={`View seats for ${title}`}
            className="btn-gold group min-h-11 px-5 rounded-[10px] text-sm font-bold flex items-center gap-2">
            View Seats
            <svg className="transition-transform group-hover:translate-x-[3px]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        )}
      </div>
    </article>
  );
};
