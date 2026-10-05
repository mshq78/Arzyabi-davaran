import React, { useEffect, useState } from 'react';
import { api } from '../../client/api';
import { BehaviorCatalog, Participant, Activity } from '../../domain/types';
import { detectOpposingPairs, CONFIG } from '../../domain/config';
import { toPersianDigits } from '../../domain/dateUtils';
import { useAuth } from '../common/AuthContext';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  EyeOff,
  PlusCircle,
  Send,
  X,
} from 'lucide-react';

interface ObserveParticipantPageProps {
  eventId: string;
  activityId: string;
  participantId: string;
  onBack: () => void;
  onSuccess: (message: string) => void;
}

export const ObserveParticipantPage: React.FC<ObserveParticipantPageProps> = ({
  eventId,
  activityId,
  participantId,
  onBack,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [behaviors, setBehaviors] = useState<BehaviorCatalog[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [showWarningSheet, setShowWarningSheet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activityId, participantId]);

  const loadData = async () => {
    try {
      const [bData, aData] = await Promise.all([
        api.getBehaviors(),
        api.getEventAssignments(eventId),
      ]);

      setBehaviors(bData.behaviors);

      const p = (aData.participants || []).find((item: Participant) => item.id === participantId);
      const act = (aData.activities || []).find((item: Activity) => item.id === activityId);

      setParticipant(p || null);
      setActivity(act || null);
    } catch (err) {
      console.error(err);
    }
  };

  const positiveBehaviors = behaviors.filter((b) => b.polarity === 'positive');
  const warningBehaviors = behaviors.filter((b) => b.polarity === 'warning');

  const toggleBehavior = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // Check opposing pairs
  const opposingPairs = detectOpposingPairs(selectedCodes);

  // Check recent duplicate recordings in the last 60 seconds
  const checkDuplicate = async (codes: string[]) => {
    try {
      const recents = await api.getRecentObservations();
      const now = Date.now();
      const recentDup = recents.find((obs) => {
        if (
          obs.activity_id === activityId &&
          obs.participant_id === participantId &&
          obs.status !== 'Voided'
        ) {
          const obsTime = new Date(obs.client_created_at).getTime();
          if (now - obsTime < CONFIG.DUPLICATE_CHECK_WINDOW_MS) {
            return obs.behavior_codes.some((c: string) => codes.includes(c));
          }
        }
        return false;
      });

      return !!recentDup;
    } catch {
      return false;
    }
  };

  const handleSubmitObservation = async (forceDuplicate: boolean = false) => {
    if (selectedCodes.length === 0 || !user || isSubmitting) return;

    // Check duplicate warning if not forced
    if (!forceDuplicate) {
      const isDup = await checkDuplicate(selectedCodes);
      if (isDup) {
        setDuplicateWarning('همین رفتار کمتر از یک دقیقه قبل برای این فرد ثبت شده است. دوباره ثبت شود؟');
        return;
      }
    }

    setDuplicateWarning(null);
    setIsSubmitting(true);

    try {
      await api.recordObservation({
        event_id: eventId,
        activity_id: activityId,
        participant_id: participantId,
        facilitator_id: user.id,
        behavior_codes: selectedCodes,
        note: note.trim() || undefined,
      });

      onSuccess('ثبت شد.');
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت مشاهده.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNoOpportunity = async () => {
    if (selectedCodes.length > 0 || !user || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await api.recordNoOpportunity({
        event_id: eventId,
        activity_id: activityId,
        participant_id: participantId,
        facilitator_id: user.id,
      });

      onSuccess('ثبت شد.');
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت عدم فرصت مشاهده.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-28">
      {/* Sticky Header with Participant and Activity Title */}
      <div className="sticky top-10 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 -mr-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition touch-target"
              title="بازگشت به فهرست افراد"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>{participant?.full_name || 'در حال بارگذاری...'}</span>
                {participant?.participant_code && (
                  <span className="text-[11px] font-normal text-slate-400 font-mono">
                    ({participant.participant_code})
                  </span>
                )}
              </h2>
              <div className="text-[11px] text-indigo-400 font-medium truncate max-w-[240px]">
                فعالیت: {activity?.title}
              </div>
            </div>
          </div>

          <div className="text-left">
            <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded-lg">
              {toPersianDigits(selectedCodes.length)} مورد انتخاب‌شده
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Guiding Prompt at top */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed space-y-1">
          <p className="font-semibold text-slate-100">
            در این موقعیت چه چیزی را واقعاً از این فرد دیدید؟
          </p>
          <p className="text-slate-400 text-[11px]">
            فقط رفتارهایی را علامت بزنید که بتوانید همان اتفاق را برای شخص دیگری تعریف کنید.
          </p>
        </div>

        {/* Soft warning for opposing pairs if detected */}
        {opposingPairs.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              این دو رفتار معمولاً با هم دیده نمی‌شوند؛ اگر هر دو واقعاً در همین واقعه رخ داده‌اند، ادامه دهید.
            </p>
          </div>
        )}

        {/* 14 Positive Behaviors List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
            <span>رفتارهای مثبت مشاهده‌شده:</span>
          </div>

          <div className="space-y-2">
            {positiveBehaviors.map((b) => {
              const isSelected = selectedCodes.includes(b.code);
              return (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => toggleBehavior(b.code)}
                  className={`w-full text-right p-3.5 rounded-xl border text-xs leading-relaxed flex items-start justify-between gap-3 transition touch-target cursor-pointer ${
                    isSelected
                      ? 'bg-teal-950/50 border-teal-500 text-teal-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold font-mono mt-0.5 ${
                        isSelected
                          ? 'bg-teal-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : b.code}
                    </span>
                    <span className="font-medium text-slate-200">{b.label_fa}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Separate Button to Open Warning Behaviors Bottom Sheet */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowWarningSheet(true)}
            className="w-full py-3 px-4 rounded-xl bg-violet-950/30 hover:bg-violet-950/50 border border-violet-800/50 text-violet-300 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.99] touch-target cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-violet-400" />
            <span>رفتار مسئله‌دار دیدم</span>
            {warningBehaviors.some((b) => selectedCodes.includes(b.code)) && (
              <span className="w-2 h-2 rounded-full bg-violet-400 inline-block mr-1" />
            )}
          </button>
        </div>

        {/* Optional Note Field (Max 160 Characters) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="text-slate-400 font-medium">یادداشت کوتاه (اختیاری):</label>
            <span
              className={`text-[11px] font-mono ${
                note.length > 140 ? 'text-amber-400 font-bold' : 'text-slate-500'
              }`}
            >
              {toPersianDigits(note.length)} / {toPersianDigits(160)}
            </span>
          </div>
          <textarea
            value={note}
            maxLength={160}
            onChange={(e) => setNote(e.target.value)}
            placeholder="توضیح کوتاه درباره بافت اتفاق در صورت نیاز..."
            rows={2}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 transition resize-none"
          />
        </div>
      </div>

      {/* Warning Behaviors Bottom Sheet / Modal */}
      {showWarningSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-slate-900 border-t border-slate-800 rounded-t-2xl p-5 text-white space-y-4 max-h-[85vh] overflow-y-auto animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-violet-300 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-violet-400" />
                <span>رفتارهای هشداردهنده</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWarningSheet(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guiding Reminder inside warning sheet */}
            <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 text-[11px] text-violet-200 leading-relaxed">
              سکوت، کم‌حرفی، دیر وارد شدن به بحث یا دیده نشدن یک رفتار، به‌خودی‌خود رفتار هشدار نیست. فقط اقدام یا عدم‌اقدام روشن و اثرگذار را علامت بزنید.
            </div>

            <div className="space-y-2">
              {warningBehaviors.map((b) => {
                const isSelected = selectedCodes.includes(b.code);
                return (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => toggleBehavior(b.code)}
                    className={`w-full text-right p-3 rounded-xl border text-xs leading-relaxed flex items-start justify-between gap-3 transition touch-target cursor-pointer ${
                      isSelected
                        ? 'bg-violet-950/60 border-violet-500 text-violet-100'
                        : 'bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold font-mono mt-0.5 ${
                          isSelected
                            ? 'bg-violet-500 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : b.code}
                      </span>
                      <span className="font-medium text-slate-200">{b.label_fa}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowWarningSheet(false)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition touch-target"
            >
              تأیید و بازگشت
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Warning Dialog (The ONLY confirm modal in recording flow) */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-amber-500/40 p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>هشدار ثبت تکراری</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{duplicateWarning}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => handleSubmitObservation(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition"
              >
                دوباره ثبت شود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 shadow-xl">
        <div className="max-w-xl mx-auto flex items-center gap-2.5">
          {selectedCodes.length > 0 ? (
            <button
              type="button"
              onClick={() => handleSubmitObservation(false)}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-sm font-black shadow-lg shadow-indigo-600/30 transition active:scale-[0.99] touch-target cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ارسال...' : 'ثبت مشاهده'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNoOpportunity}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold transition active:scale-[0.99] touch-target cursor-pointer"
            >
              <EyeOff className="w-4 h-4 text-slate-400" />
              <span>فرصت مشاهده نداشتم</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
