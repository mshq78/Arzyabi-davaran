import React, { useState } from 'react';
import { useAuth } from '../common/AuthContext';
import { CONFIG } from '../../domain/config';
import { LogIn, ShieldAlert, Sparkles } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (role: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState(CONFIG.DEMO_MODE ? 'fac1' : '');
  const [password, setPassword] = useState(CONFIG.DEMO_MODE ? 'demo1234' : '');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('لطفاً نام کاربری و رمز عبور را وارد کنید.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const loggedUser = await login(username.trim(), password.trim(), rememberMe);
      onLoginSuccess(loggedUser.role);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ورود به سامانه.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDemo = (u: string) => {
    setUsername(u);
    setPassword('demo1234');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <img src="/logo-mark.png" alt="پردیس نوآوری گرا" className="mx-auto w-16 h-16 object-contain" />
          <h1 className="text-lg font-bold text-white tracking-tight">سامانه ثبت مشاهده رفتاری</h1>
          <p className="text-xs text-slate-400">ورود تسهیلگران و عوامل اجرایی رویداد</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              نام کاربری یا شماره موبایل
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-indigo-500 transition dir-ltr text-right"
              placeholder="نام کاربری"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              رمز عبور
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-indigo-500 transition dir-ltr text-right"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-sm border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span>مرا روی این دستگاه نگه دار</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition active:scale-[0.99] disabled:opacity-50 touch-target cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? 'در حال ورود...' : 'ورود به سامانه'}</span>
          </button>
        </form>

        {/* Demo Accounts List (Only when DEMO_MODE is active) */}
        {CONFIG.DEMO_MODE && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-3">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>حساب‌های نمونه آزمایشی (رمز: demo1234)</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectDemo('fac1')}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-right border border-slate-700/60 text-slate-300 transition"
              >
                <div className="font-bold text-white">تسهیلگر ۱</div>
                <div className="text-[10px] text-slate-400">fac1 (سارا احمدی)</div>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemo('fac2')}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-right border border-slate-700/60 text-slate-300 transition"
              >
                <div className="font-bold text-white">تسهیلگر ۲</div>
                <div className="text-[10px] text-slate-400">fac2 (رضا کریمی)</div>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemo('eventadmin')}
                className="p-2 rounded-lg bg-teal-950/40 hover:bg-teal-900/40 text-right border border-teal-800/40 text-teal-200 transition"
              >
                <div className="font-bold text-white">مدیر دوره</div>
                <div className="text-[10px] text-teal-400">eventadmin</div>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemo('sysadmin')}
                className="p-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/40 text-right border border-indigo-800/40 text-indigo-200 transition"
              >
                <div className="font-bold text-white">مدیر سیستم</div>
                <div className="text-[10px] text-indigo-400">sysadmin</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
