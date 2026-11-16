import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Utensils, Eye, EyeOff, KeyRound, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendPasswordReset } from '../../services/auth/authService';

export const LoginPage: React.FC = () => {
  const { login, user, profile, loading, isSuperAdmin, userRole } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (user && !loading && (profile || isSuperAdmin)) {
      if (isSuperAdmin) {
        navigate('/admin', { replace: true });
      } else if (userRole === 'KITCHEN') {
        navigate('/kitchen', { replace: true });
      } else if (userRole === 'CASHIER') {
        navigate('/billing', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, profile, isSuperAdmin, userRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const detectedRole = await login(identifier, password);
      // Automatic Role-Based Redirection
      if (detectedRole === 'SUPER_ADMIN') {
        navigate('/admin', { replace: true });
      } else if (detectedRole === 'KITCHEN') {
        navigate('/kitchen', { replace: true });
      } else if (detectedRole === 'CASHIER') {
        navigate('/billing', { replace: true });
      } else {
        // OWNER or MANAGER
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setError(null);
    try {
      await sendPasswordReset(forgotEmail);
      setForgotSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch password reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-white border border-zinc-200/80 rounded-2xl shadow-sm p-6 sm:p-8">
        {/* App Logo & Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-[#145C43] text-white rounded-2xl flex items-center justify-center mb-4 shadow-sm shadow-[#145C43]/20">
            <Utensils className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Food POS & Billing</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Universal Mobile Billing & WhatsApp Receipts
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Single Common Login Form for All Roles */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              LOGIN ID OR EMAIL ADDRESS
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. princeowner, shopowner01, or admin"
                className="w-full pl-11 pr-4 min-h-[52px] text-base bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145C43] focus:bg-white transition-all text-zinc-900 placeholder-zinc-400"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                PASSWORD
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(identifier.includes('@') ? identifier : '');
                  setShowForgotModal(true);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <KeyRound className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-11 min-h-[52px] text-base bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145C43] focus:bg-white transition-all text-zinc-900 placeholder-zinc-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 focus:outline-none p-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full min-h-[52px] py-3.5 bg-[#145C43] hover:bg-[#0F4935] text-white font-bold text-sm sm:text-base rounded-xl transition-all shadow-sm mt-3 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Security & Access Notice */}
        <div className="mt-6 text-center text-xs text-zinc-400">
          Super Admin, Shop Owners, Managers & Staff authenticate here.
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-1">Reset Password</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Enter your registered business email and we'll send a secure password reset link.
            </p>

            {forgotSent ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl mb-4">
                Password reset email sent! Check your inbox and follow the instructions to set a new password.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="owner@yourfoodbusiness.com"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#145C43]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotSent(false);
                    }}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-[#145C43] hover:bg-[#0F4935] rounded-lg transition-colors disabled:opacity-50"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Link'}
                  </button>
                </div>
              </form>
            )}

            {forgotSent && (
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotSent(false);
                }}
                className="w-full py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
