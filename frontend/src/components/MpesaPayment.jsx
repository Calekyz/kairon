import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Phone, CreditCard, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function MpesaPayment({ planId, planPrice, planName, onSuccess }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutId, setCheckoutId] = useState(null);
  const [status, setStatus] = useState(null);

  const handlePayment = async (e) => {
    e.preventDefault();
    
    // Validate phone number
    let cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 9 && cleaned.startsWith('7')) {
      cleaned = '254' + cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('07')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.length === 12 && cleaned.startsWith('254')) {
      // Already correct format
    } else {
      toast.error('Please enter a valid Kenyan phone number (e.g., 0712345678)');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/payment/initiate',
        {
          planId: planId,
          phoneNumber: cleaned
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setCheckoutId(response.data.checkoutRequestId);
        setStatus('pending');
        toast.success('STK Push sent! Check your phone and enter your M-Pesa PIN.');
        
        // Start polling for status
        pollPaymentStatus(response.data.checkoutRequestId);
      } else {
        toast.error(response.data.error || 'Payment initiation failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };
  
  const pollPaymentStatus = async (checkoutId) => {
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `http://localhost:5000/api/payment/status/${checkoutId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success && response.data.resultCode === '0') {
          clearInterval(interval);
          setStatus('success');
          toast.success('Payment successful! Your subscription is now active.');
          if (onSuccess) onSuccess();
        } else if (response.data.resultCode && response.data.resultCode !== '0') {
          clearInterval(interval);
          setStatus('failed');
          toast.error(response.data.resultDesc || 'Payment failed');
        }
      } catch (error) {
        // Continue polling on error
        console.error('Status poll error:', error);
      }
    }, 3000); // Poll every 3 seconds
    
    // Stop polling after 2 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (status === 'pending') {
        setStatus('timeout');
        toast.error('Payment verification timed out. Please contact support.');
      }
    }, 120000);
  };
  
  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4">Pay with M-Pesa</h3>
      
      <div className="mb-6 p-4 bg-blue-900/20 rounded-lg border border-blue-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300">Plan:</span>
          <span className="text-white font-semibold">{planName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Amount:</span>
          <span className="text-2xl font-bold text-blue-400">KSh {planPrice}</span>
        </div>
      </div>
      
      {!checkoutId ? (
        <form onSubmit={handlePayment}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              M-Pesa Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0712345678"
                className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              You will receive an STK Push on this number to complete payment
            </p>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader className="animate-spin h-5 w-5 mr-2" />
                Sending STK Push...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 mr-2" />
                Pay KSh {planPrice} with M-Pesa
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="text-center py-4">
          {status === 'pending' && (
            <div>
              <Loader className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" />
              <p className="text-white font-semibold">Waiting for payment...</p>
              <p className="text-gray-400 text-sm mt-2">
                Check your phone and enter your M-Pesa PIN
              </p>
            </div>
          )}
          
          {status === 'success' && (
            <div>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-white font-semibold">Payment Successful!</p>
              <p className="text-gray-400 text-sm mt-2">
                Your subscription is now active
              </p>
            </div>
          )}
          
          {status === 'failed' && (
            <div>
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-white font-semibold">Payment Failed</p>
              <p className="text-gray-400 text-sm mt-2">
                Please try again or contact support
              </p>
              <button
                onClick={() => {
                  setCheckoutId(null);
                  setStatus(null);
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          You will receive an M-Pesa STK Push prompt on your phone.<br />
          Enter your PIN to complete the transaction securely.
        </p>
      </div>
    </div>
  );
}
