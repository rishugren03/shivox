import React, { useState } from 'react';
import { X, Mail, Lock, User, Sparkles, ArrowRight, LogIn } from 'lucide-react';
import axios from 'axios';
import type { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register' ? { email, password, fullName } : { email, password };
      
      const res = await axios.post(`http://localhost:5001${endpoint}`, payload);
      
      if (res.data.user) {
        localStorage.setItem('tsenta_user_email', res.data.user.email);
        localStorage.setItem('tsenta_user_id', res.data.user.id);
        onSuccess(res.data.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-neutral-900 to-red-600" />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 pt-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 mb-3">
            {mode === 'register' ? <Sparkles className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            {mode === 'register' ? 'Create Your Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {mode === 'register'
              ? 'Join Tsenta AI to automate job matching & auto-applications'
              : 'Sign in to access your profile, preferences & application tracker'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Alex Founder"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs text-neutral-900 pl-10 pr-3 py-2.5 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="alex@founder.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs text-neutral-900 pl-10 pr-3 py-2.5 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs text-neutral-900 pl-10 pr-3 py-2.5 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'register' ? 'Create Account & Continue' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center border-t border-neutral-100 pt-4">
          <p className="text-xs text-neutral-600">
            {mode === 'register' ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              onClick={() => {
                setError(null);
                setMode(mode === 'register' ? 'login' : 'register');
              }}
              className="font-bold text-red-600 hover:underline inline-block ml-1"
            >
              {mode === 'register' ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
