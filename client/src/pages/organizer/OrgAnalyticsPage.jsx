import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { OrganizerNavbar } from '../../components/organizer/OrganizerNavbar';
import { organizerApi } from '../../services/organizerApi';
import { useToast } from '../../components/toastContext';
import { CATEGORY_COLORS } from '../../lib/categoryColors';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PALETTE = CATEGORY_COLORS;

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const compact = (v) => (v >= 100000 ? `${Math.round(v / 10000) / 10}L` : v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

const time12 = (iso) => {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]}, ${h}:${m} ${ap}`;
};

export default function OrgAnalyticsPage() {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('rev'); // 'rev' | 'seats'
  const [limit, setLimit] = useState(10);
  const [sortDesc, setSortDesc] = useState(true);
  const toast = useToast();

  useEffect(() => {
    organizerApi.listEvents().then((res) => setEvents(res.data)).catch(() => {});
  }, []);

  const [loadError, setLoadError] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    organizerApi.getAnalytics(selected)
      .then((res) => { if (!alive) return; setData(res.data); setLoadError(false); setLimit(10); })
      .catch(() => {
        if (!alive) return;
        // `data` may stay null; the `d` fallback below keeps rendering safe and the banner explains.
        setLoadError(true);
        toast.error('Could not load analytics.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selected, toast, reloadKey]);
  const reload = () => { setLoading(true); setReloadKey((k) => k + 1); };
  const choose = (value) => { setLoading(true); setSelected(value); };

  const catColor = useMemo(() => {
    const map = {};
    (data?.categoryMix || []).forEach((c, i) => { map[c.name] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [data]);

  // Safe fallback so a failed fetch renders an empty-but-valid analytics view (plus the
  // error banner below) instead of crashing on `data.stats.xxx` while `data` is null.
  const d = data || { stats: { revenue: 0, seatsSold: 0, totalCapacity: 0, occupancyPct: 0, totalBookings: 0 }, occupancy: [], categoryMix: [], bookings: [], daily: [] };
  const showFailedBanner = !loading && !data && loadError;
  const isEmpty = !loading && data && data.stats.totalBookings === 0;
  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.bookings].sort((a, b) => (sortDesc ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.createdAt) - new Date(b.createdAt)));
    return rows;
  }, [data, sortDesc]);

  const daily = data?.daily || [];
  const vals = daily.map((d) => (metric === 'rev' ? d.revenue : d.seats));
  const maxV = Math.max(...vals, 1);

  return (
    <div className="w-full min-h-screen bg-dark-bg flex flex-col">
      <OrganizerNavbar active="analytics" />
      <main className="flex-1 px-4 md:px-16 py-6 md:py-10 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-label text-xs tracking-widest text-gold">ORGANIZER CONSOLE</span>
            <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">Analytics</h1>
            <span className="text-sm text-gray-text">Bookings and revenue for your events. Last 21 days, daily.</span>
          </div>
          <div className="flex flex-col gap-1.5 w-full md:w-[360px]">
            <label htmlFor="evsel" className="font-label text-[11px] tracking-wider text-gray-text">SHOWING</label>
            <div className="relative">
              <select
                id="evsel" value={selected} onChange={(e) => choose(e.target.value)}
                className="w-full h-[46px] box-border px-3.5 pr-10 rounded-[10px] text-[15px] font-semibold bg-[#121017] border border-dark-border focus:border-gold outline-none appearance-none cursor-pointer"
              >
                <option value="all">All events</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8F89A0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3.5 top-[15px] pointer-events-none"><path d="M6 9l6 6 6-6" /></svg>
            </div>
          </div>
        </div>

        <section aria-label="Totals for the selected scope" className="grid grid-cols-2 md:grid-cols-4 bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
          {[
            { label: 'REVENUE', value: data ? `₹${fmt(data.stats.revenue)}` : '', foot: 'confirmed only' },
            { label: 'SEATS SOLD', value: data ? fmt(data.stats.seatsSold) : '', foot: data ? `of ${fmt(data.stats.totalCapacity)} total` : '' },
            { label: 'OCCUPANCY', value: data ? `${data.stats.occupancyPct}%` : '', foot: selected === 'all' ? `across ${events.length} events` : 'this event' },
            { label: 'BOOKINGS', value: data ? fmt(data.stats.totalBookings) : '', foot: 'confirmed bookings' },
          ].map((t, i) => (
            <div key={t.label} className={`p-4 md:p-5 flex flex-col gap-1.5 border-r border-dark-border ${i < 2 ? 'border-b md:border-b-0 border-dark-border' : ''}`}>
              <span className="font-label text-[11px] tracking-wider text-gray-text">{t.label}</span>
              {loading ? (
                <><div className="sk w-2/3 h-7" /><div className="sk w-1/2 h-3" /></>
              ) : (
                <><span className="font-display text-2xl md:text-[30px] font-semibold leading-tight">{t.value}</span><span className="text-xs text-gray-text">{t.foot}</span></>
              )}
            </div>
          ))}
        </section>

        {showFailedBanner && (
          <div className="bg-dark-card border border-danger/35 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 shrink-0 rounded-full bg-danger/15 text-danger flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold">Couldn&rsquo;t load analytics</span>
                <span className="text-xs text-gray-text">Check that the server is running, then retry.</span>
              </div>
            </div>
            <button type="button" onClick={reload} className="h-10 px-4 rounded-[10px] border border-dark-border text-sm font-semibold hover:bg-dark-card-hover hover:border-dark-border-hover transition-colors shrink-0">
              Retry
            </button>
          </div>
        )}

        {isEmpty && (
          <section className="fade bg-dark-card border border-dark-border rounded-2xl py-16 px-6 flex flex-col items-center gap-4 text-center">
            <span className="w-13 h-13 rounded-2xl bg-dark-card-hover text-gray-text flex items-center justify-center p-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
            </span>
            <h2 className="font-display text-[26px] font-medium">No bookings yet for {selected === 'all' ? 'your events' : (events.find(e => String(e.id) === String(selected))?.title || 'this event')}</h2>
            <p className="max-w-[440px] text-sm leading-relaxed text-gray-text">Charts and the bookings table fill in as soon as the first customer books. All {fmt(data.stats.totalCapacity)} seats are still available.</p>
            <Link to="/organizer/events" className="text-sm font-bold flex items-center gap-1.5">View in My Events &rarr;</Link>
          </section>
        )}

        {!isEmpty && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-[8fr_4fr] gap-6 items-stretch">
              {/* Revenue/Seats bar chart */}
              <section className="bg-dark-card border border-dark-border rounded-2xl p-4 md:p-6 flex flex-col gap-5 min-w-0">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-[17px] font-bold m-0">{metric === 'rev' ? 'Revenue by day' : 'Seats sold by day'}</h2>
                    <span className="text-[13px] text-gray-text">Last 21 days &middot; confirmed bookings only</span>
                  </div>
                  <div role="radiogroup" aria-label="Metric" className="flex p-[3px] rounded-[10px] bg-[#121017] border border-dark-border">
                    <button type="button" role="radio" aria-checked={metric === 'rev'} onClick={() => setMetric('rev')} className={`h-[34px] px-3 rounded-[7px] text-[13px] font-semibold transition-colors ${metric === 'rev' ? 'bg-dark-border-hover text-white' : 'text-gray-text hover:text-white'}`}>Revenue</button>
                    <button type="button" role="radio" aria-checked={metric === 'seats'} onClick={() => setMetric('seats')} className={`h-[34px] px-3 rounded-[7px] text-[13px] font-semibold transition-colors ${metric === 'seats' ? 'bg-dark-border-hover text-white' : 'text-gray-text hover:text-white'}`}>Seats sold</button>
                  </div>
                </div>
                {loading ? (
                  <div className="sk h-[220px] rounded-[10px]" />
                ) : (
                  <div className="flex gap-2.5">
                    <div aria-hidden="true" className="w-11 md:w-13 h-[220px] flex flex-col justify-between items-end font-label text-[11px] text-gray-text -mt-1.5 mb-1.5">
                      {[1, 0.75, 0.5, 0.25, 0].map((k) => (
                        <span key={k} className="leading-[14px]">{metric === 'rev' ? '₹' : ''}{compact(maxV * k)}</span>
                      ))}
                    </div>
                    <div className="flex-grow min-w-0 flex flex-col gap-2">
                      <div className="relative h-[220px]">
                        <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
                          <div className="h-px bg-dark-border" /><div className="h-px bg-dark-border" /><div className="h-px bg-dark-border" /><div className="h-px bg-dark-border" /><div className="h-px bg-dark-border-hover" />
                        </div>
                        <div className="absolute inset-0 flex items-end">
                          {daily.map((d) => {
                            const v = metric === 'rev' ? d.revenue : d.seats;
                            const h = Math.round((v / maxV) * 1000) / 10;
                            const label = `${d.date}: ${metric === 'rev' ? `₹${fmt(d.revenue)}` : `${fmt(d.seats)} seats`}, ${d.bookings} bookings`;
                            return (
                              <div key={d.date} title={label} className="flex-1 h-full flex items-end justify-center">
                                <div className="w-[8px] md:w-[18px] bg-gold hover:bg-gold-hover rounded-t transition-colors" style={{ height: `${h}%`, minHeight: v > 0 ? '3px' : '0px' }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div aria-hidden="true" className="flex font-label text-[10px] md:text-[11px] text-gray-text">
                        {daily.map((d, i) => {
                          const every = 3;
                          const show = (20 - i) % every === 0;
                          const dd = new Date(d.date);
                          return <span key={d.date} className="flex-1 text-center whitespace-nowrap">{show ? `${String(dd.getDate()).padStart(2, '0')} ${MON[dd.getMonth()]}` : ''}</span>;
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Occupancy */}
              <section className="bg-dark-card border border-dark-border rounded-2xl p-4 md:p-6 flex flex-col gap-5 min-w-0">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[17px] font-bold m-0">Seat occupancy</h2>
                  <span className="text-[13px] text-gray-text">{selected === 'all' ? 'Seats sold vs total, per event' : 'Seats sold vs total, per category'}</span>
                </div>
                {loading ? (
                  <div className="flex flex-col gap-4"><div className="sk w-2/5 h-11" /><div className="sk h-9" /><div className="sk h-9" /></div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-display text-4xl md:text-[48px] font-semibold leading-none">{d.stats.occupancyPct}%</span>
                      <span className="text-[13px] text-gray-text"><span className="font-label text-gray-light">{fmt(d.stats.seatsSold)}</span> of {fmt(d.stats.totalCapacity)} seats sold</span>
                    </div>
                    <div className="flex flex-col gap-4">
                      {d.occupancy.map((o, i) => (
                        <div key={o.name} className="flex flex-col gap-1.5">
                          <div className="flex justify-between gap-2 text-[13px]">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 shrink-0 rounded-[3px]" style={{ background: selected === 'all' ? '#F5B544' : (catColor[o.name] || PALETTE[i % PALETTE.length]) }} />
                              <span className="truncate text-gray-light">{o.name}</span>
                            </span>
                            <span className="shrink-0 font-label text-xs text-gray-text">{o.sold}/{o.cap} &middot; <span className="text-white">{o.pct}%</span></span>
                          </div>
                          <div className="h-2.5 rounded-full bg-dark-border-hover overflow-hidden">
                            <div className="h-full rounded-full transition-[width]" style={{ width: `${o.pct}%`, background: selected === 'all' ? '#F5B544' : (catColor[o.name] || PALETTE[i % PALETTE.length]) }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>

            {/* Category mix */}
            <section className="bg-dark-card border border-dark-border rounded-2xl p-4 md:p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-[17px] font-bold m-0">Bookings by seat category</h2>
                <span className="text-[13px] text-gray-text">Share of seats sold. Colors match the occupancy chart above.</span>
              </div>
              {loading ? (
                <><div className="sk h-7 rounded-md" /><div className="sk h-20 rounded-xl" /></>
              ) : (
                <>
                  <div role="img" aria-label="Seats sold by category" className="flex gap-0.5 h-7">
                    {d.categoryMix.map((c, i) => (
                      <div key={c.name} title={`${c.name}: ${fmt(c.seats)} seats, ₹${fmt(c.revenue)}`} className="h-full" style={{ flex: `${Math.max(c.seats, 0.001)} 1 0`, minWidth: 4, background: catColor[c.name], borderRadius: d.categoryMix.length === 1 ? 6 : i === 0 ? '6px 0 0 6px' : i === d.categoryMix.length - 1 ? '0 6px 6px 0' : 0 }} />
                    ))}
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(d.categoryMix.length, 1)}, minmax(0, 1fr))` }}>
                    {d.categoryMix.map((c) => (
                      <div key={c.name} className="p-4 rounded-xl bg-[#121017] border border-dark-border flex flex-col gap-2.5">
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: catColor[c.name] }} />{c.name}
                          <span className="ml-auto font-label text-xs font-medium text-gray-text">{d.stats.seatsSold ? Math.round((c.seats / d.stats.seatsSold) * 100) : 0}%</span>
                        </span>
                        <div className="flex justify-between items-baseline">
                          <span><span className="font-display text-2xl font-semibold">{fmt(c.seats)}</span> <span className="text-xs text-gray-text">seats</span></span>
                          <span className="font-label text-[13px] text-gray-light">&#8377;{fmt(c.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Bookings table */}
            <section className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
              <div className="flex justify-between items-center gap-3 px-5 md:px-6 py-5 border-b border-dark-border">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[17px] font-bold m-0">Bookings</h2>
                  <span className="text-[13px] text-gray-text">{data && data.bookings.length ? `${data.bookings.length} bookings` : 'No bookings'}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[880px]">
                  <div className="grid grid-cols-[140px_minmax(0,1fr)_110px_120px_150px_170px] items-center bg-[#121017] border-b border-dark-border font-label text-[11px] tracking-wider text-gray-text">
                    <div className="px-6 py-3.5">BOOKING ID</div>
                    <div className="px-3 py-3.5">{selected === 'all' ? 'EVENT' : 'CATEGORY'}</div>
                    <div className="px-3 py-3.5">SEATS</div>
                    <div className="px-3 py-3.5 text-right">AMOUNT</div>
                    <div className="px-3 pl-7 py-3.5">STATUS</div>
                    <div className="px-3 py-3.5">
                      <button type="button" onClick={() => setSortDesc((v) => !v)} className="flex items-center gap-1.5 text-gray-text hover:text-white transition-colors">
                        TIME <span className="text-gold">{sortDesc ? '↓' : '↑'}</span>
                      </button>
                    </div>
                  </div>
                  {loading && [1, 2, 3, 4, 5].map((k) => (
                    <div key={k} className="grid grid-cols-[140px_minmax(0,1fr)_110px_120px_150px_170px] items-center py-4 border-b border-dark-border">
                      <div className="px-6"><div className="sk w-20 h-3.5" /></div>
                      <div className="px-3"><div className="sk w-2/3 h-3.5" /></div>
                      <div className="px-3"><div className="sk w-12 h-3.5" /></div>
                      <div className="px-3"><div className="sk w-12 h-3.5 ml-auto" /></div>
                      <div className="px-3 pl-7"><div className="sk w-24 h-3.5" /></div>
                      <div className="px-3"><div className="sk w-24 h-3.5" /></div>
                    </div>
                  ))}
                  {!loading && sortedRows.slice(0, limit).map((r) => (
                    <div key={r.id} className="grid grid-cols-[140px_minmax(0,1fr)_110px_120px_150px_170px] items-center border-b border-dark-border hover:bg-dark-card-hover/60 transition-colors text-sm">
                      <div className="px-6 py-3.5 font-label text-[13px] text-gray-light">{r.id}</div>
                      <div className="px-3 py-3.5 truncate text-gray-light">{selected === 'all' ? r.eventName : r.category}</div>
                      <div className="px-3 py-3.5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-[2px]" style={{ background: catColor[r.category] || PALETTE[0] }} />
                        <span className="font-label text-[13px]">&times; {r.seats}</span>
                      </div>
                      <div className="px-3 py-3.5 text-right font-label text-[13px]">&#8377;{fmt(r.amount)}</div>
                      <div className="px-3 pl-7 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(12,163,12,.12)] border border-[rgba(12,163,12,.4)] text-xs font-bold text-[#5FD35F]">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                          Confirmed
                        </span>
                      </div>
                      <div className="px-3 py-3.5 font-label text-xs text-gray-text">{time12(r.createdAt)}</div>
                    </div>
                  ))}
                  {!loading && sortedRows.length === 0 && (
                    <div className="py-10 text-center text-sm text-gray-text">No bookings in this scope yet.</div>
                  )}
                </div>
              </div>
              {!loading && sortedRows.length > 0 && (
                <div className="flex justify-between items-center gap-3 px-5 md:px-6 py-4">
                  <span className="text-[13px] text-gray-text">Showing {Math.min(limit, sortedRows.length)} of {sortedRows.length}</span>
                  {limit < sortedRows.length && (
                    <button type="button" onClick={() => setLimit((v) => v + 10)} className="h-10 px-4 rounded-[10px] border border-dark-border text-[13px] font-semibold hover:bg-dark-card-hover hover:border-dark-border-hover transition-colors">Show 10 more</button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
