import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Navbar } from '../components/Navbar';

export default function ConfirmationPage() {
  // The route is declared as "/confirmation/:paymentId" in App.jsx — destructuring `id`
  // here (as if the param were called that) always came back undefined, so every fetch
  // below was actually `GET /api/payments/undefined`, which the server 500s on. That 500
  // was swallowed by the catch block and silently rendered as "Payment Not Found" even
  // for a genuinely successful booking. Renaming the destructured field fixes it without
  // touching anything else that already refers to `id`.
  const { paymentId: id } = useParams();
  const [payment, setPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const response = await api.get(`/payments/${id}`);
        setPayment(response.data.data || response.data);
      } catch (error) {
        console.error('Failed to fetch payment', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayment();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <Navbar />
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center p-4 text-center">
          <h2 className="text-white text-2xl mb-4">Payment Not Found</h2>
          <Link to="/events" className="text-gold hover:underline">Return to Events</Link>
        </div>
      </div>
    );
  }

  // `payment.status` is the PAYMENT's own status ('SUCCESS' | 'REFUND_PENDING' | 'FAILED'
  // | 'PENDING') — 'CONFIRMED' is never one of its values, that's the BOOKING's status
  // (payment.booking.status). The three cards below were written to match against
  // 'CONFIRMED', which never happened, so a successful payment matched none of them and
  // rendered a blank card. Comparing against 'SUCCESS' is the fix.
  const status = payment.status;

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-8 text-center">
          
          {status === 'SUCCESS' && (
            <>
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="font-display text-white text-2xl font-bold mb-2">Booking Confirmed!</h1>
              <p className="text-gray-text mb-6">Your seats have been successfully secured.</p>
              
              <div className="bg-[#0B0B0F] rounded-xl border border-dark-border p-4 mb-8 text-left">
                <p className="text-sm text-gray-text mb-1">Booking ID</p>
                <p className="text-white font-label text-sm mb-4">{payment.id}</p>
                
                <p className="text-sm text-gray-text mb-1">Amount Paid</p>
                <p className="text-white font-bold">₹{Number(payment.amount).toFixed(2)}</p>
              </div>
              
              <div className="inline-block bg-success/20 text-success px-4 py-1.5 rounded-full text-sm font-semibold mb-8 border border-success/30">
                CONFIRMED
              </div>
            </>
          )}

          {status === 'REFUND_PENDING' && (
            <>
              <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="font-display text-white text-2xl font-bold mb-2">Refund Pending</h1>
              <p className="text-gray-text mb-6 text-sm px-4">Payment succeeded but your hold had expired. A refund has been initiated automatically.</p>
              
              <div className="inline-block bg-warning/20 text-warning px-4 py-1.5 rounded-full text-sm font-semibold mb-8 border border-warning/30">
                REFUND PENDING
              </div>
            </>
          )}

          {status === 'FAILED' && (
            <>
              <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="font-display text-white text-2xl font-bold mb-2">Payment Failed</h1>
              <p className="text-gray-text mb-6">Your payment could not be processed. No charges were made.</p>
              
              <div className="inline-block bg-danger/20 text-danger px-4 py-1.5 rounded-full text-sm font-semibold mb-8 border border-danger/30">
                FAILED
              </div>
            </>
          )}

          {status !== 'SUCCESS' && status !== 'REFUND_PENDING' && status !== 'FAILED' && (
            <>
              <div className="w-20 h-20 bg-dark-card-hover rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
              </div>
              <h1 className="font-display text-white text-2xl font-bold mb-2">Payment Processing</h1>
              <p className="text-gray-text mb-6 text-sm px-4">
                We&rsquo;re still confirming this payment (status: {status || 'unknown'}). Refresh in a moment, or check My Bookings later.
              </p>
            </>
          )}

          <Link
            to="/events"
            className="block w-full bg-dark-card border border-dark-border hover:border-gold text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Back to Events
          </Link>
          
        </div>
      </main>
    </div>
  );
}
