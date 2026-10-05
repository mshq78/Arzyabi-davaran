import React, { useState } from 'react';
import { useSync } from './useSync';
import { useAuth } from './AuthContext';
import { usePWAInstall } from './usePWAInstall';
import { toPersianDigits } from '../../domain/dateUtils';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  LogOut,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

export const HeaderStatus: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, reviewItems, triggerManualSync, dismissReview } = useSync();
  const { user, logout, showPendingLogoutModal, cancelLogout, confirmForceLogout } = useAuth();
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  return (
    <>
      {/* Top Banner Bar */}
      <div className="bg-slate-900 border-b border-slate-800 text-slate-200 px-4 py-2.5 flex items-center justify-between text-xs sticky top-0 z-30 shadow-xs">
        {/* Left / Brand + Connectivity */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-slate-100">
            <img src="/logo-mark.png" alt="" className="w-5 h-5 object-contain" />
            <span className="text-sm font-black tracking-normal">GERA</span>
          </div>

          <span className="text-slate-600">|</span>

          {/* Connection Indicator */}
          {isSyncing ? (
            <div className="flex items-center gap-1.5 text-sky-400 font-medium animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>در حال همگام‌سازی</span>
            </div>
          ) : !isOnline ? (
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              <span>
                آفلاین
                {pendingCount > 0 ? ` - ${toPersianDigits(pendingCount)} ثبت در انتظار ارسال` : ''}
              </span>
            </div>
          ) : pendingCount > 0 ? (
            <button
              onClick={triggerManualSync}
              className="flex items-center gap-1.5 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full hover:bg-amber-500/20 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{toPersianDigits(pendingCount)} ثبت در انتظار ارسال</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>آنلاین</span>
            </div>
          )}
        </div>

        {/* Right / Actions */}
        <div className="flex items-center gap-2">
          {/* Review badge if items were rejected by server */}
          {reviewItems.length > 0 && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold hover:bg-rose-500/30 transition cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>نیازمند بررسی ({toPersianDigits(reviewItems.length)})</span>
            </button>
          )}

          {/* In-App PWA Install */}
          {isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>نصب اپلیکیشن</span>
            </button>
          )}

          {isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px] hover:bg-slate-700 transition"
            >
              راهنمای نصب iOS
            </button>
          )}

          {/* User profile & Logout */}
          {user && (
            <div className="flex items-center gap-2 mr-1">
              <span className="text-slate-400 hidden sm:inline">{user.full_name}</span>
              <button
                onClick={() => logout()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                title="خروج از حساب"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* iOS Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 text-white shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">نصب در آیفون و آیپد (iOS)</h3>
            <ol className="text-xs text-slate-300 space-y-2.5 list-decimal list-inside leading-relaxed">
              <li>
                در نوار پایین یا بالای مرورگر سافاری، دکمه <strong>اشتراک‌گذاری (Share)</strong> را لمس کنید.
              </li>
              <li>
                منو را به پایین بکشید و گزینه <strong>Add to Home Screen (افزودن به صفحه اصلی)</strong> را انتخاب کنید.
              </li>
              <li>در بالای صفحه روی <strong>Add</strong> بزنید.</li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 rounded-xl bg-slate-800 text-xs font-semibold hover:bg-slate-700 transition"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}

      {/* Pending Items on Logout Warning Modal */}
      {showPendingLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/40 p-6 text-white shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-sm font-bold">توجه: ثبت‌های ارسال‌نشده</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              هنوز ثبتِ ارسال‌نشده دارید. قبل از خروج، اتصال اینترنت و همگام‌سازی را بررسی کنید.
            </p>
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                onClick={cancelLogout}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                بازگشت
              </button>
              <button
                onClick={confirmForceLogout}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition"
              >
                با این حال خارج شو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal for Server-Rejected Items */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 text-white shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-bold text-sm">ثبت‌های نیازمند بررسی</h3>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              این موارد توسط سرور پذیرفته نشدند اما برای حفظ داده‌ها حذف نشده‌اند. در صورت تمایل می‌توانید آنها را مخفی کنید.
            </p>

            <div className="space-y-3">
              {reviewItems.map((item) => (
                <div key={item.offline_uuid} className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-300">دلیل رد سرور: {item.error_message}</span>
                    <button
                      onClick={() => dismissReview(item.offline_uuid)}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      صرف‌نظر و مخفی‌سازی
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2 rounded-lg font-mono">
                    کد خطا: {item.error_code} | شناسه آفلاین: {item.offline_uuid.substring(0, 8)}...
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowReviewModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </>
  );
};
