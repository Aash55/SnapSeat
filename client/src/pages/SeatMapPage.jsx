import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Navbar } from '../components/Navbar';
import { useToast } from '../components/Toast';

export default function SeatMapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSeats = async () => {
    try {
      const eventRes = await api.get(`/events/${id}`);
      setEvent(eventRes.data);
      
      const seatsRes = await api.get(`/events/${id}/seats`);
      setSeats(seatsRes.data.seats || []);
    } catch (error) {
      console.error('Failed to fetch seat map', error);
      toast.error('Failed to load seat map');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSeats();
    const interval = setInterval(fetchSeats, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const toggleSeat = (seat) => {
    if (seat.status !== 'free') return;
    
    setSelectedSeats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seat.id)) {
        newSet.delete(seat.id);
      } else {
        if (newSet.size >= 4) {
          toast.warning('You can select up to 4 seats max');
          return prev;
        }
        newSet.add(seat.id);
      }
      return newSet;
    });
  };

  const handleHold = async () => {
    if (selectedSeats.size === 0) return;
    
    setIsSubmitting(true);
    try {
      const response = await api.post('/holds', {
        eventId: parseInt(id),
        seatIds: Array.from(selectedSeats)
      });
      const holdGroupId = response.data.holdGroupId;
      navigate(`/checkout/${holdGroupId}`);
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Some seats are no longer available. Please select again.');
        fetchSeats();
        setSelectedSeats(new Set());
      } else {
        toast.error(error.response?.data?.error || 'Failed to hold seats');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group seats by categoryName
  const groupedSeats = seats.reduce((acc, seat) => {
    const cat = seat.categoryName || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(seat);
    return acc;
  }, {});

  const selectedSeatsList = seats.filter(s => selectedSeats.has(s.id));
  const totalPrice = selectedSeatsList.reduce((sum, s) => sum + Number(s.price), 0);

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col pb-24">
      <Navbar />
      
      <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full">
        <Link to="/events" className="text-gray-text hover:text-white mb-6 inline-flex items-center gap-2 text-sm transition-colors">
          &larr; Back to Events
        </Link>
        
        {event && (
          <div className="mb-8">
            <h1 className="text-white text-3xl font-bold font-display mb-2">{event.title}</h1>
            <p className="text-gray-text">{event.venue} • {new Date(event.date).toLocaleString()}</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 mb-10 p-4 bg-dark-card border border-dark-border rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border border-green-500 bg-[#141419]"></div>
            <span className="text-gray-text text-sm">Free</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500/30"></div>
            <span className="text-gray-text text-sm">Held</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-700"></div>
            <span className="text-gray-text text-sm">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-600"></div>
            <span className="text-white text-sm">Selected</span>
          </div>
        </div>

        {/* Seat Map */}
        {isLoading && seats.length === 0 ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupedSeats).map(([categoryName, catSeats]) => (
              <div key={categoryName} className="bg-[#101015] p-6 rounded-2xl border border-dark-border">
                <div className="mb-6 flex justify-between items-end border-b border-dark-border pb-4">
                  <h3 className="text-white text-lg font-medium">{categoryName} Section</h3>
                  <span className="text-gold font-semibold">₹{Number(catSeats[0]?.price).toFixed(2)}</span>
                </div>
                
                <div className="flex flex-wrap justify-center gap-3">
                  {catSeats.map(seat => {
                    const isSelected = selectedSeats.has(seat.id);
                    let btnClass = "w-12 h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ";
                    
                    if (isSelected) {
                      btnClass += "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)] cursor-pointer";
                    } else if (seat.status === 'free') {
                      btnClass += "bg-[#141419] border border-green-500/50 text-gray-300 hover:border-green-400 hover:bg-green-500/10 cursor-pointer";
                    } else if (seat.status === 'held') {
                      btnClass += "bg-amber-500/20 text-amber-400/60 cursor-not-allowed";
                    } else if (seat.status === 'booked') {
                      btnClass += "bg-gray-800/50 text-gray-600 line-through cursor-not-allowed";
                    }
                    
                    return (
                      <button
                        key={seat.id}
                        disabled={seat.status !== 'free' && !isSelected}
                        onClick={() => toggleSeat(seat)}
                        className={btnClass}
                        title={`Seat ${seat.seatNumber} - ${categoryName}`}
                      >
                        {seat.seatNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-dark-bg/95 backdrop-blur-md border-t border-dark-border p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-gray-text text-sm">{selectedSeats.size} / 4 seats selected</p>
            <p className="text-white text-xl font-bold font-display mt-1">Total: ₹{totalPrice.toFixed(2)}</p>
          </div>
          <button
            onClick={handleHold}
            disabled={selectedSeats.size === 0 || isSubmitting}
            className="bg-gold hover:bg-gold-hover text-dark-bg font-semibold px-8 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <div className="animate-spin h-4 w-4 border-2 border-dark-bg border-t-transparent rounded-full"></div>}
            Hold Selected Seats
          </button>
        </div>
      </div>
    </div>
  );
}
