import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { TrendingUp, Shield, Zap } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(email, password);
      toast.success('Welcome back to KAIRON!');
      navigate('/dashboard');
    } catch (error) {
      if (error.message === 'SESSION_TERMINATED') {
        toast.error('Session terminated. Please purchase a new license.');
      } else {
        toast.error(error.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <TrendingUp className="h-16 w-16 text-blue-500" />
          </div>
          <h2 className="mt-6 text-4xl font-bold text-white">KAIRON</h2>
          <p className="mt-2 text-gray-400">Professional Trading Signals</p>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <Link to="/signup" className="text-sm text-blue-400 hover:text-blue-300">
              Don't have an account? Sign up
            </Link>
          </div>
        </div>
        
        <div className="flex justify-center space-x-8 text-gray-500 text-sm">
          <div className="flex items-center">
            <Shield className="h-4 w-4 mr-1" />
            Secure
          </div>
          <div className="flex items-center">
            <Zap className="h-4 w-4 mr-1" />
            Real-time
          </div>
        </div>
      </div>
    </div>
  );
}
