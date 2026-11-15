import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { sendPasswordReset } from '../../services/auth/authService';

export const SuperAdminLoginPage: React.FC = () => {
  const { superAdminLogin, user, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('superadmin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot Password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (user && isSuperAdmin && !loading) {
      navigate('/admin', { replace: true });
    }
  }, [user, isSuperAdmin, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await superAdminLogin(identifier, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify Super Admin credentials.');
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
    <div className="min-h-screen bg-[#F7F9F7] flex flex-col justify-center items-center px-4 py-8 select-none font-sans">
      <div className="w-full max-w-md bg-white border border-[#E5EAE6] rounded-2xl shadow-xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-[#145C43] text-white rounded-2xl flex items-center justify-center mb-4 shadow-md shadow-[#145C43]/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-[#202923] tracking-tight">Super Admin Portal</h1>
          <p className="text-xs text-[#68736D] mt-1">
            Platform Governance & Centralized Multi-Tenant Administration
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#202923] uppercase tracking-wider mb-1.5">
              Super Admin Login ID or Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#929B95] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="superadmin or admin@foodpos.app"
                className="w-full pl-10 pr-4 py-2.5 bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl text-xs text-[#202923] placeholder-[#929B95] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]/20 focus:border-[#145C43]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#202923] uppercase tracking-wider">
                Master Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(identifier.includes('@') ? identifier : 'superadmin@foodpos.app');
                  setShowForgotModal(true);
                }}
                className="text-xs text-[#145C43] hover:text-[#0F4935] font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#929B95] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-[#F7F9F7] border border-[#E5EAE6] rounded-xl text-xs text-[#202923] placeholder-[#929B95] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145C43]/20 focus:border-[#145C43]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#929B95] hover:text-[#202923] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full py-3 px-4 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-bold rounded-xl shadow-md shadow-[#145C43]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
          >
            <span>{isSubmitting ? 'Verifying Super Admin Session...' : 'Sign In as Super Admin'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5EAE6] rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#202923] mb-1">Super Admin Password Reset</h3>
            <p className="text-xs text-[#68736D] mb-4">
              Enter registered administrator email to receive secure recovery credentials.
            </p>

            {forgotSent ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl mb-4">
                Recovery email dispatched. Follow instructions in your verified admin inbox.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#202923] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@foodpos.app"
                    className="w-full px-3 py-2 text-xs bg-[#F7F9F7] border border-[#E5EAE6] text-[#202923] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#145C43]/20 focus:border-[#145C43]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotSent(false);
                    }}
                    className="flex-1 py-2 text-xs font-semibold text-[#68736D] bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-[#145C43] hover:bg-[#0F4935] rounded-lg transition-colors disabled:opacity-50"
                  >
                    {forgotLoading ? 'Dispatching...' : 'Send Recovery Link'}
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
                className="w-full py-2 text-xs font-semibold text-[#202923] bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
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
