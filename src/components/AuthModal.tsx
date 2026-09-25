import React, { useState, useId } from 'react';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  X,
  Cloud,
  Database,
} from 'lucide-react';
import { signUp, signIn } from '../services/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import type { AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  canClose?: boolean;
  onClose?: () => void;
  onSuccess: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  canClose = false,
  onClose,
  onSuccess,
}) => {
  const modalTitleId = useId();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanDisplayName = displayName.trim();

    if (!cleanEmail) {
      setError('لطفاً ایمیل خود را وارد نمایید.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('فرمت آدرس ایمیل نامعتبر است.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    if (mode === 'signup' && !cleanDisplayName) {
      setError('لطفاً نام یا نام مستعار خود را وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      let user: AuthUser;
      if (mode === 'signup') {
        user = await signUp(cleanEmail, cleanPassword, cleanDisplayName);
      } else {
        user = await signIn(cleanEmail, cleanPassword);
      }
      onSuccess(user);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در برقراری ارتباط');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#141d38] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="p-6 pb-4 border-b border-slate-800 bg-[#172242]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
                <span className="text-xl">د</span>
              </div>
              <div>
                <h2 id={modalTitleId} className="text-base font-extrabold text-white">
                  {mode === 'signin' ? 'ورود به حساب کاربری' : 'ایجاد حساب کاربری'}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">سامانه مدیریت دنگ و مخارج دنگاتو</span>
                  {isSupabaseConfigured ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <Cloud className="w-2.5 h-2.5 text-emerald-400" />
                      ابری
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <Database className="w-2.5 h-2.5 text-amber-400" />
                      محلی
                    </span>
                  )}
                </div>
              </div>
            </div>

            {canClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Tab Switcher: Sign In vs Sign Up */}
          <div className="flex items-center p-1 bg-[#0b132b] rounded-2xl border border-slate-700/60 mt-4">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'signin'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>ورود</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'signup'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>ثبت‌نام</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name (Only in Sign Up) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  نام و نام خانوادگی / نام مستعار <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required={mode === 'signup'}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: علی رضایی"
                  className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm"
                />
              </div>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                آدرس ایمیل <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm font-mono"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                رمز عبور <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                  dir="ltr"
                  className="w-full px-4 py-2.5 pl-10 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                {mode === 'signup'
                  ? 'رمز عبور امن برای ورود به اتاق‌های شما در تمام دستگاه‌ها استفاده می‌شود.'
                  : 'رمز عبور حساب دنگاتو خود را وارد کنید.'}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all mt-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال پردازش...</span>
                </>
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>ورود به حساب</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>ایجاد حساب کاربری</span>
                </>
              )}
            </button>
          </form>

          {/* Quick toggle at bottom */}
          <div className="pt-2 text-center text-xs text-slate-400">
            {mode === 'signin' ? (
              <span>
                حساب کاربری ندارید؟{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                >
                  ثبت‌نام کنید
                </button>
              </span>
            ) : (
              <span>
                قبلاً ثبت‌نام کرده‌اید؟{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                >
                  وارد شوید
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
