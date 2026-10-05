import React, { useState } from 'react';
import { api } from '../../client/api';
import { CheckCircle2, XCircle, ShieldCheck, ArrowLeft } from 'lucide-react';

interface OnboardingPageProps {
  eventId: string;
  onComplete: () => void;
}

const ONBOARDING_RULES = [
  {
    id: 1,
    title: 'چیزی را ثبت کن که دیدی.',
    correct: '«بعد از شکست روش اول، تقسیم کار را عوض کرد.»',
    incorrect: '«انعطاف‌پذیر است.»',
  },
  {
    id: 2,
    title: 'رفتار را با شخصیت اشتباه نگیر.',
    correct: '«دو بار نظر افراد ساکت را پرسید.»',
    incorrect: '«رهبر مشارکتی است.»',
  },
  {
    id: 3,
    title: 'ندیدن رفتار، ضعف نیست.',
    correct: 'هیچ چیزی ثبت نکن یا «فرصت مشاهده نداشتم» بزن.',
    incorrect: '«چون ایده نداد، رفتار منفی بزن.»',
  },
  {
    id: 4,
    title: 'اگر مطمئن نیستی، ثبت نکن.',
    correct: 'فقط رفتار روشن را علامت بزن.',
    incorrect: '«حدس بزن احتمالاً چه منظوری داشت.»',
  },
  {
    id: 5,
    title: 'مثبت و منفی را متعادل نکن.',
    correct: 'هرچه واقعاً دیده‌ای ثبت کن.',
    incorrect: '«برای منصف بودن یک مثبت و یک منفی بزن.»',
  },
  {
    id: 6,
    title: 'یک اتفاق پیوسته را چند بار نشمار.',
    correct: 'یک ثبت مشاهده با چند برچسب رفتاری مرتبط.',
    incorrect: '«برای همان ۳۰ ثانیه پنج بار همان رفتار را ثبت کن.»',
  },
];

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ eventId, onComplete }) => {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!agreed) return;
    setSubmitting(true);
    try {
      await api.ackOnboarding(eventId);
      onComplete();
    } catch (err) {
      console.error(err);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-2 text-center sm:text-right">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
          <ShieldCheck className="w-4 h-4" />
          <span>آموزش ۷ دقیقه‌ای تسهیلگر</span>
        </div>
        <h2 className="text-xl font-extrabold text-slate-100">اصول کلیدی ثبت مشاهده رفتاری</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          وظیفه شما به عنوان تسهیلگر، «قضاوت درباره افراد» نیست؛ بلکه «ثبت دقیق وقایع رفتاری عینی» است.
        </p>
      </div>

      {/* Rules Cards */}
      <div className="space-y-4">
        {ONBOARDING_RULES.map((rule) => (
          <div
            key={rule.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
          >
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center font-mono">
                {rule.id}
              </span>
              <span>{rule.title}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Correct example */}
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>مثال درست (مشاهده عینی):</span>
                </div>
                <p className="text-emerald-200/90 leading-relaxed pr-5">{rule.correct}</p>
              </div>

              {/* Incorrect example */}
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  <span>مثال نادرست (قضاوت ذهنی):</span>
                </div>
                <p className="text-rose-200/90 leading-relaxed pr-5">{rule.incorrect}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mandatory Checkbox Agreement */}
      <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4.5 space-y-4 shadow-lg">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-5 h-5 mt-0.5 rounded-sm border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 cursor-pointer flex-shrink-0"
          />
          <span className="text-xs font-bold text-slate-200 leading-relaxed">
            می‌دانم که وظیفه من ثبت رفتار قابل مشاهده است، نه قضاوت درباره شخصیت یا شایستگی افراد.
          </span>
        </label>

        <button
          onClick={handleConfirm}
          disabled={!agreed || submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/20 transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed touch-target cursor-pointer"
        >
          <span>{submitting ? 'در حال ثبت تأییدیه...' : 'تأیید و ورود به فعالیت‌های دوره'}</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
