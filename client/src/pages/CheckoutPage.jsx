import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Navbar } from '../components/Navbar';
import { useToast } from '../components/Toast';

export default function CheckoutPage() {
  const { holdGroupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [holdDetails, setHoldDetails] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const hasExpiredRef = useRef(false);
  // The hold's TTL is a server setting (15 min today), not a fixed 5 min — this is the
  // denominator the countdown ring animates against, captured once when the hold loads.
  const totalTtlRef = useRef(null);

  useEffect(() => {
    const fetchHold = async () => {
      try {
        const response = await api.get(`/holds/${holdGroupId}`);
        // A hold that already expired before this page loaded comes back as
        // { status: 'expired' } with no seats/ttlSeconds — there's nothing to check out.
        if (response.data.status === 'expired') {
          toast.warning('Your hold expired');
          navigate('/events');
          return;
        }
        setHoldDetails(response.data);
        totalTtlRef.current = response.data.ttlSeconds || 900;
        setTimeLeft(response.data.ttlSeconds ?? 900);
      } catch (error) {
        toast.error('Hold session expired or invalid');
        navigate('/events');
      }
    };

    fetchHold();
  }, [holdGroupId]);

  useEffect(() => {
    if (timeLeft === null) return;
    
    if (timeLeft <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      toast.warning('Your hold expired');
      navigate('/events');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  const handlePayment = async (simulateFailure) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const response = await api.post('/payments', {
        holdGroupId,
        idempotencyKey,
        simulateFailure
      });
      const paymentId = response.data.paymentId || response.data.id;
      navigate(`/confirmation/${paymentId}`);
    } catch (error) {
      const msg = error.response?.data?.error || 'Payment failed';
      toast.error(msg);
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!holdDetails) return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <Navbar />
      <div className="flex-1 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    </div>
  );

  const totalAmount = holdDetails.totalAmount || holdDetails.seats?.reduce((sum, s) => sum + Number(s.price), 0) || 0;

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-8">
          
          <div className="text-center mb-8">
            <p className="text-gray-text text-sm uppercase tracking-widest font-semibold mb-2">Time Remaining</p>
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 border-dark-border relative">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="58" fill="transparent" stroke="var(--color-dark-border)" strokeWidth="4" />
                <circle cx="64" cy="64" r="58" fill="transparent" stroke="var(--color-gold)" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (1 - (timeLeft || 0) / (totalTtlRef.current || 900))}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000" />
              </svg>
              <span className={`text-4xl font-bold font-label ${timeLeft <= 60 ? 'text-danger' : 'text-gold'}`}>{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-white font-medium mb-4">Selected Seats</h3>
            <div className="space-y-3">
              {holdDetails.seats?.map(seat => (
                <div key={seat.id || seat.seatNumber} className="flex justify-between items-center bg-[#0B0B0F] p-3 rounded-lg border border-dark-border">
                  <div>
                    <p className="text-white text-sm font-medium">Seat {seat.seatNumber}</p>
                    <p className="text-gray-text text-xs">{seat.categoryName}</p>
                  </div>
                  <p className="text-white">₹{Number(seat.price).toFixed(2)}</p>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center mt-6 pt-6 border-t border-dashed border-dark-border">
              <span className="text-gray-text">Total Amount</span>
              <span className="text-white text-2xl font-bold">₹{Number(totalAmount).toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handlePayment(false)}
              disabled={isProcessing || timeLeft <= 0}
              className="w-full bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isProcessing && <div className="animate-spin h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full"></div>}
              ✓ Simulate Success
            </button>
            <button
              onClick={() => handlePayment(true)}
              disabled={isProcessing || timeLeft <= 0}
              className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isProcessing && <div className="animate-spin h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full"></div>}
              ✗ Simulate Failure
            </button>
          </div>
          
        </div>
      </main>
    </div>
  );
}
