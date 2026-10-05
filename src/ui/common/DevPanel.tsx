import React, { useState } from 'react';
import {
  getSimulatedLatency,
  getSimulatedOffline,
  setSimulatedLatency,
  setSimulatedOffline,
} from '../../client/transport';
import { adminApi } from '../../client/api';
import { useAuth } from './AuthContext';
import { CONFIG } from '../../domain/config';
import { toPersianDigits } from '../../domain/dateUtils';
import { AlertTriangle, Database, RefreshCw, Settings, Wifi, WifiOff, X } from 'lucide-react';

export const DevPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(getSimulatedOffline);
  const [latency, setLatency] = useState(getSimulatedLatency);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const { login, refreshUser, user } = useAuth();

  if (!CONFIG.DEMO_MODE) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleToggleOffline = () => {
    const next = !isOffline;
    setIsOffline(next);
    setSimulatedOffline(next);
    showToast(next ? 'شبیه‌سازی قطع اینترنت فعال شد.' : 'شبیه‌سازی اینترنت متصل شد.');
  };

  const handleLatencyChange = (ms: number) => {
    setLatency(ms);
    setSimulatedLatency(ms);
    showToast(`تأخیر شبکه روی ${toPersianDigits(ms)} میلی‌ثانیه تنظیم شد.`);
  };

  const handleSeed500 = async () => {
    setLoadingAction('seed500');
    try {
      await adminApi.seed500Observations();
      showToast('۵۰۰ مشاهده نمونه با موفقیت در پایگاه داده ایجاد شد.');
    } catch (err: any) {
      showToast(err.message || 'خطا در ساخت مشاهدات نمونه.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetDb = async () => {
    if (!window.confirm('آیا مطمئن هستید؟ همه داده‌ها پاک شده و با اطلاعات اولیه Seed خواهند شد.')) return;
    setLoadingAction('reset');
    try {
      await adminApi.resetDatabase();
      await refreshUser();
      showToast('پایگاه داده ریست و مجدداً بارگذاری شد.');
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      showToast(err.message || 'خطا در ریست پایگاه داده.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleQuickLogin = async (username: string) => {
    try {
      await login(username, 'demo1234', true);
      showToast(`ورود با حساب ${username} انجام شد.`);
      setIsOpen(false);
    } catch (err: any) {
      showToast(err.message || 'خطا در تغییر حساب.');
    }
  };

  return (
    <>
      {toastMsg && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900/90 text-white px-4 py-2 text-xs font-medium backdrop-blur shadow-xl border border-slate-700 animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* Floating Toggle Button */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-amber-400 text-xs font-medium backdrop-blur border border-amber-500/30 shadow-lg transition active:scale-95 touch-target"
          title="ابزارهای توسعه (DevPanel)"
        >
          <Settings className="w-4 h-4 animate-spin-slow" />
          <span>پنل تست</span>
          {isOffline && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
        </button>
      </div>

      {/* Slide-over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 text-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">پنل ابزار و تست (DEMO_MODE)</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Offline Toggle */}
            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOffline ? (
                    <WifiOff className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Wifi className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="text-xs font-semibold text-white">شبیه‌سازی قطع اینترنت</span>
                </div>
                <button
                  onClick={handleToggleOffline}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    isOffline
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {isOffline ? 'اینترنت قطع است (وصل کن)' : 'اینترنت وصل است (قطع کن)'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                مستقل از اتصال واقعی مرورگر، شبکه نرم‌افزاری اپ را قطع و سناریوی آفلاین را تست می‌کند.
              </p>
            </div>

            {/* Network Latency */}
            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">تأخیر شبیه‌سازی سرور:</span>
                <span className="font-mono text-amber-300 font-bold">{toPersianDigits(latency)} ms</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {[0, 150, 400, 1000].map((ms) => (
                  <button
                    key={ms}
                    onClick={() => handleLatencyChange(ms)}
                    className={`py-1.5 rounded text-[11px] font-medium border transition ${
                      latency === ms
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {toPersianDigits(ms)} ms
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Switch Demo Accounts */}
            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">سوئیچ سریع حساب نمونه:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleQuickLogin('sysadmin')}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-indigo-200 text-right hover:bg-indigo-900/60 transition"
                >
                  <div className="font-bold">مدیر کل سیستم</div>
                  <div className="text-[10px] text-indigo-400">sysadmin</div>
                </button>
                <button
                  onClick={() => handleQuickLogin('eventadmin')}
                  className="px-2.5 py-1.5 rounded-lg bg-teal-950/60 border border-teal-700/50 text-teal-200 text-right hover:bg-teal-900/60 transition"
                >
                  <div className="font-bold">مدیر دوره بوت‌کمپ</div>
                  <div className="text-[10px] text-teal-400">eventadmin</div>
                </button>
                <button
                  onClick={() => handleQuickLogin('fac1')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-right hover:bg-slate-700 transition"
                >
                  <div className="font-bold">تسهیلگر ۱ (سارا)</div>
                  <div className="text-[10px] text-slate-400">fac1 • گروه ۱</div>
                </button>
                <button
                  onClick={() => handleQuickLogin('fac2')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-right hover:bg-slate-700 transition"
                >
                  <div className="font-bold">تسهیلگر ۲ (رضا)</div>
                  <div className="text-[10px] text-slate-400">fac2 • گروه ۲</div>
                </button>
              </div>
            </div>

            {/* Test Actions: 500 Observations & Reset */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleSeed500}
                disabled={loadingAction !== null}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-600/20 border border-sky-500/40 text-sky-200 text-xs font-semibold hover:bg-sky-600/30 transition disabled:opacity-50"
              >
                <Database className="w-4 h-4 text-sky-400" />
                <span>{loadingAction === 'seed500' ? 'در حال تولید...' : 'تولید ۵۰۰ مشاهده نمونه (تست پوشش و اکسپورت)'}</span>
              </button>

              <button
                onClick={handleResetDb}
                disabled={loadingAction !== null}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-200 text-xs font-semibold hover:bg-rose-600/30 transition disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 text-rose-400" />
                <span>{loadingAction === 'reset' ? 'در حال پاکسازی...' : 'ریست کامل پایگاه داده و Seed دوباره'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
