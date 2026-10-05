import React, { useEffect, useState } from 'react';
import { api } from '../../client/api';
import { formatShamsiDateTime, toPersianDigits } from '../../domain/dateUtils';
import { BehaviorCatalog } from '../../domain/types';
import {
  AlertCircle,
  Ban,
  Clock,
  Edit2,
  Lock,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';

interface MyRecentEntriesPageProps {
  onBack: () => void;
}

export const MyRecentEntriesPage: React.FC<MyRecentEntriesPageProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [allBehaviors, setAllBehaviors] = useState<BehaviorCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editCodes, setEditCodes] = useState<string[]>([]);
  const [editNote, setEditNote] = useState('');
  const [voidConfirmItem, setVoidConfirmItem] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, bData] = await Promise.all([
        api.getRecentObservations(),
        api.getBehaviors(),
      ]);
      setEntries(list);
      setAllBehaviors(bData.behaviors);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (item: any) => {
    setEditingItem(item);
    setEditCodes([...item.behavior_codes]);
    setEditNote(item.note || '');
  };

  const handleSaveEdit = async () => {
    if (!editingItem || editCodes.length === 0) return;
    try {
      await api.editObservation(editingItem.offline_uuid, {
        behavior_codes: editCodes,
        note: editNote.trim() || undefined,
      });
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ویرایش ثبت.');
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidConfirmItem) return;
    try {
      await api.voidObservation(voidConfirmItem.offline_uuid);
      setVoidConfirmItem(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ابطال ثبت.');
    }
  };

  const toggleEditCode = (code: string) => {
    setEditCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PendingLocal':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>در انتظار ارسال</span>
          </span>
        );
      case 'Synced':
        return (
          <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[10px] font-medium">
            ارسال شد
          </span>
        );
      case 'Corrected':
        return (
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-medium">
            اصلاح‌شده
          </span>
        );
      case 'Voided':
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px] line-through">
            باطل‌شده
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100">ثبت‌های اخیر من</h2>
          <p className="text-xs text-slate-400">حداکثر ۲۰ ثبت اخیر شما جهت بررسی و اصلاح</p>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition touch-target"
          title="تازه‌سازی"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-xs">در حال بارگذاری...</div>
      ) : entries.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
          هنوز ثبتی توسط شما انجام نشده است.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((item) => {
            const isClosed = item.activity_status === 'Closed';
            const isVoided = item.status === 'Voided';

            return (
              <div
                key={item.offline_uuid}
                className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 transition ${
                  isVoided ? 'opacity-60 bg-slate-900/60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{item.participant_name}</h3>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      فعالیت: {item.activity_title}
                    </div>
                  </div>
                  <div>{getStatusBadge(item.status)}</div>
                </div>

                {/* Behaviors recorded */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.behaviors?.map((b: any) => (
                    <span
                      key={b.code}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 ${
                        b.polarity === 'warning'
                          ? 'bg-violet-950/40 border-violet-800/50 text-violet-200'
                          : 'bg-teal-950/40 border-teal-800/50 text-teal-200'
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-70">{b.code}</span>
                      <span>{b.label}</span>
                    </span>
                  ))}
                </div>

                {item.note && (
                  <p className="text-xs text-slate-300 bg-slate-850 p-2.5 rounded-xl leading-relaxed border border-slate-800/80">
                    {item.note}
                  </p>
                )}

                {/* Footer time & Actions */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                  <span>{formatShamsiDateTime(item.client_created_at)}</span>

                  <div className="flex items-center gap-2">
                    {isClosed ? (
                      <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <Lock className="w-3.5 h-3.5" />
                        <span>فعالیت بسته شده</span>
                      </span>
                    ) : !isVoided ? (
                      <>
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>ویرایش</span>
                        </button>
                        <span className="text-slate-700">•</span>
                        <button
                          onClick={() => setVoidConfirmItem(item)}
                          className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                        >
                          <Ban className="w-3 h-3" />
                          <span>ابطال</span>
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">ویرایش ثبت مشاهده: {editingItem.participant_name}</h3>
              <button onClick={() => setEditingItem(null)} className="p-1 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto p-1">
              {allBehaviors.map((b) => {
                const isSelected = editCodes.includes(b.code);
                return (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => toggleEditCode(b.code)}
                    className={`w-full text-right p-2.5 rounded-xl border text-xs leading-relaxed flex items-center gap-2 transition ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-md bg-slate-700 text-[10px] flex items-center justify-center font-mono font-bold">
                      {b.code}
                    </span>
                    <span>{b.label_fa}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">یادداشت (حداکثر ۱۶۰ نویسه):</label>
              <textarea
                value={editNote}
                maxLength={160}
                onChange={(e) => setEditNote(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editCodes.length === 0}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"
              >
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirm Modal */}
      {voidConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-rose-500/40 p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>تأیید ابطال مشاهده</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از ابطال این مشاهده برای «{voidConfirmItem.participant_name}» اطمینان دارید؟ این ثبت در تاریخچه به عنوان باطل‌شده باقی می‌ماند.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidConfirmItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition"
              >
                ابطال مشاهده
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
