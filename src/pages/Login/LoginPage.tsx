import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Utensils, ArrowRight, Sparkles, ShieldCheck, Eye, EyeOff, KeyRound, Mail, CheckCircle2 } from 'lucide-react';
import { sendPasswordReset } from '../../services/auth/authService';

export const LoginPage: React.FC = () => {
  const { login, signup, demoLogin, superAdminLogin, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      if (isSignUp) {
        await signup(email, password);
        setSuccessMsg('Account created successfully! Verification email dispatched.');
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
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
        {/* App Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-zinc-950 text-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Utensils className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Food POS & Billing</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Universal Mobile Billing & WhatsApp Receipts
          </p>
        </div>

        {/* Demo Business Testing */}
        <div className="mb-6 p-4 bg-emerald-50/60 border border-emerald-200/60 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
              Instant Demo Access
            </h3>
          </div>
          <p className="text-xs text-emerald-800 mb-3">
            Explore with preloaded menu, draft billing, extras, and thermal receipt printing.
          </p>
          <button
            type="button"
            onClick={() => demoLogin()}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-2"
          >
            <span>Explore Demo Shop (No Sign-In Required)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-zinc-200"></div>
          <span className="flex-shrink mx-3 text-xs uppercase tracking-wider text-zinc-400 font-medium">
            Staff Login ID or Email
          </span>
          <div className="flex-grow border-t border-zinc-200"></div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Login ID or Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. cashier01 or owner@foodpos.app"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                Password
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm rounded-xl transition-colors shadow-2xs mt-2 disabled:opacity-50"
          >
            {isSignUp ? 'Create Business Account' : 'Sign In to Billing Counter'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-medium block w-full"
          >
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Register a new shop"}
          </button>

          <div className="pt-3 border-t border-zinc-100">
            <a
              href="/admin/login"
              className="text-[11px] text-zinc-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Platform Admin Login</span>
            </a>
          </div>
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
                    className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
                    className="flex-1 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
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
