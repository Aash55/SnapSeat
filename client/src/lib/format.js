// Formatting helpers. Dates render in the viewer's own timezone.
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const time12 = (date) => {
  const d = new Date(date);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

export const dateParts = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { day: '--', mon: '---', dow: '---', year: '', time: '--:--' };
  return { day: String(d.getDate()).padStart(2, '0'), mon: MON[d.getMonth()], dow: DOW[d.getDay()], year: d.getFullYear(), time: time12(d) };
};

/** "SAT 11 OCT 2026 · 6:45 PM" */
export const longDate = (date) => {
  const p = dateParts(date);
  return `${p.dow} ${p.day} ${p.mon} ${p.year} · ${p.time}`;
};

export const mmss = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** A value for <input type="datetime-local"> in the viewer's LOCAL time (not UTC). */
export const toLocalInput = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const initials = (text) => {
  const base = String(text || '').split('@')[0].replace(/[^a-zA-Z0-9 ._-]/g, '');
  const parts = base.split(/[ ._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
};

export const displayName = (email) => {
  const base = String(email || '').split('@')[0];
  return base.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Guest';
};
