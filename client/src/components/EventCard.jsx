import { Link } from 'react-router-dom';

export const EventCard = ({ event }) => {
  const { id, title, venue, date } = event;
  
  // Parse date string
  const dateObj = new Date(date);
  
  // Fallback to empty strings if invalid date
  let dayNum = '--';
  let monthStr = '---';
  let dayOfWeek = '---';
  let timeStr = '--:--';
  
  if (!isNaN(dateObj.getTime())) {
    dayNum = dateObj.getDate().toString();
    monthStr = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    dayOfWeek = dateObj.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
    timeStr = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-dark-border-hover transition-colors group">
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-5xl font-bold text-white leading-none">{dayNum}</span>
          <div className="flex flex-col">
            <span className="text-gold text-xs font-semibold uppercase">{monthStr}</span>
            <span className="text-gold text-xs">{dayOfWeek}</span>
          </div>
        </div>
      </div>
      
      <h3 className="text-white font-semibold text-lg mt-3 line-clamp-2 min-h-[3.5rem]">{title}</h3>
      
      <div className="flex items-center gap-1.5 mt-3 text-gray-text text-sm">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="truncate">{venue}</span>
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-dark-border">
        <div className="flex items-center gap-1.5 text-gray-text text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{timeStr}</span>
        </div>
        
        <Link 
          to={`/events/${id}/seats`}
          className="bg-gold text-dark-bg font-semibold text-sm px-4 py-2 rounded-lg hover:bg-gold-hover transition-colors"
        >
          View Seats &rarr;
        </Link>
      </div>
    </div>
  );
};
