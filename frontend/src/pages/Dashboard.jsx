import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, TrendingDown, LogOut, CreditCard, Bell } from 'lucide-react';
import axios from 'axios';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');

  const fetchSignal = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/trading/signal', 
        { symbol: selectedSymbol, duration: 5 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSignal(response.data);
      toast.success(`${response.data.signal} signal detected!`, {
        icon: response.data.signal === 'RISE' ? '📈' : '📉'
      });
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
      } else {
        toast.error('Failed to fetch signal');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/trading/historical',
        { symbol: selectedSymbol, count: 50 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const formattedData = response.data.data.map((item, index) => ({
        time: index,
        price: item.price
      }));
      setHistoricalData(formattedData);
    } catch (error) {
      console.error('Failed to fetch historical data');
    }
  };

  useEffect(() => {
    fetchHistoricalData();
    const interval = setInterval(fetchHistoricalData, 30000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-gray-900/50 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-500" />
              <span className="ml-2 text-xl font-bold text-white">KAIRON</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-300">
                {user?.email}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
              >
                <LogOut className="h-5 w-5 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Signal Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">Trading Signals</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Instrument
                  </label>
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="R_10">Volatility 10 Index</option>
                    <option value="R_50">Volatility 50 Index</option>
                    <option value="R_75">Volatility 75 Index</option>
                    <option value="R_100">Volatility 100 Index</option>
                  </select>
                </div>
                
                <button
                  onClick={fetchSignal}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Analyzing...' : 'Get Signal'}
                </button>
                
                {signal && (
                  <div className={`mt-6 p-4 rounded-lg ${
                    signal.signal === 'RISE' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
                  }`}>
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-2">
                        {signal.signal === 'RISE' ? (
                          <TrendingUp className="h-8 w-8 text-green-500 inline" />
                        ) : (
                          <TrendingDown className="h-8 w-8 text-red-500 inline" />
                        )}
                      </div>
                      <div className={`text-xl font-bold ${
                        signal.signal === 'RISE' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {signal.recommendation}
                      </div>
                      <div className="text-sm text-gray-400 mt-2">
                        Price: {signal.currentPrice}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Subscription Card */}
            <div className="mt-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 backdrop-blur-lg rounded-2xl p-6 border border-purple-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Subscription</h3>
                <CreditCard className="h-5 w-5 text-purple-400" />
              </div>
              <p className="text-gray-300 text-sm">
                Active until December 31, 2024
              </p>
              <button className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition">
                Renew Subscription
              </button>
            </div>
          </div>
          
          {/* Chart Panel */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">Market Analysis</h2>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '0.5rem'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <div className="flex space-x-4 text-sm">
                  <div className="flex items-center">
                    <Bell className="h-4 w-4 text-blue-400 mr-1" />
                    <span className="text-gray-400">Real-time alerts enabled</span>
                  </div>
                </div>
                <div className="text-gray-500 text-sm">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
