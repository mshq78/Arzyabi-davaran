import React from 'react';
import { useSync } from '../common/useSync';
import { toPersianDigits } from '../../domain/dateUtils';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

export const SyncStatusPage: React.FC = () => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    reviewItems,
    lastSyncTime,
    triggerManualSync,
    dismissReview,
  } = useSync();

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4 pb-20">
      <div>
        <h2 className="text-base font-bold text-slate-100">وضعیت همگام‌سازی و اتصال</h2>
        <p className="text-xs text-slate-400">اطلاعات اتصال محلی و ثبتهای در صف ارسال</p>
      </div>

      {/* Main Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isOnline ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Wifi className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <WifiOff className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="font-bold text-sm text-white">
                {isOnline ? 'اتصال شبکه برقرار است' : 'آفلاین هستید'}
              </div>
              <div className="text-[11px] text-slate-400">
                {isOnline
                  ? 'ثبت‌های جدید بلافاصله به سرور فرستاده می‌شوند.'
                  : 'ثبت‌ها روی همین دستگاه نگه داشته می‌شوند و پس از اتصال ارسال خواهند شد.'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div className="bg-slate-850 p-3 rounded-xl">
            <span className="text-[11px] text-slate-400 block">در انتظار ارسال:</span>
            <span className="text-lg font-black text-amber-300 font-mono mt-0.5 block">
              {toPersianDigits(pendingCount)}
            </span>
          </div>

          <div className="bg-slate-850 p-3 rounded-xl">
            <span className="text-[11px] text-slate-400 block">آخرین همگام‌سازی:</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block">
              {lastSyncTime || 'هنوز ثبت نشده'}
            </span>
          </div>
        </div>

        <button
          onClick={triggerManualSync}
          disabled={isSyncing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50 touch-target cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'در حال همگام‌سازی...' : 'تلاش مجدد برای همگام‌سازی'}</span>
        </button>
      </div>

      {/* Review items section */}
      {reviewItems.length > 0 && (
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>ثبت‌های نیازمند بررسی ({toPersianDigits(reviewItems.length)})</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            این ثبت‌ها در سمت سرور تأیید نشدند (مثلاً فعالیت در لحظه ثبت بسته شده بود) اما برای حفظ شواهد در حافظه دستگاه باقی مانده‌اند.
          </p>

          <div className="space-y-2">
            {reviewItems.map((item) => (
              <div
                key={item.offline_uuid}
                className="bg-slate-850 border border-slate-700/60 p-3 rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <span className="font-bold text-rose-300">{item.error_message}</span>
                  <button
                    onClick={() => dismissReview(item.offline_uuid)}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    صرف‌نظر و مخفی‌سازی
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  کد: {item.error_code} | شناسه: {item.offline_uuid.substring(0, 8)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
