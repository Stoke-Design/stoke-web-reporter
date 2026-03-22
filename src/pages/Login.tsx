import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../auth';
import { useAuth } from '../App';
import { Logo } from '../components/Logo';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      await refreshUser(); // Update App-level auth state
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="bg-gray-900 rounded-2xl p-4">
            <Logo />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h1 className="text-xl font-semibold text-gray-900 text-center mb-6">Sign in to Reporter</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Stoke Design Website Reporter</p>
      </div>
    </div>
  );
}
