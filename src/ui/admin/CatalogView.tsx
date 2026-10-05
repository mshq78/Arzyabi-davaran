import React, { useEffect, useState } from 'react';
import { adminApi } from '../../client/api';
import { BehaviorCatalog } from '../../domain/types';
import { toPersianDigits } from '../../domain/dateUtils';
import { BookOpen, Edit2, ShieldAlert, X } from 'lucide-react';

export const CatalogView: React.FC = () => {
  const [behaviors, setBehaviors] = useState<BehaviorCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBehavior, setEditingBehavior] = useState<BehaviorCatalog | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newGuide, setNewGuide] = useState('');

  useEffect(() => {
    loadBehaviors();
  }, []);

  const loadBehaviors = async () => {
    setLoading(true);
    try {
      const list = await adminApi.getBehaviors();
      setBehaviors(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (b: BehaviorCatalog) => {
    setEditingBehavior(b);
    setNewLabel(b.label_fa);
    setNewGuide(b.guide_fa);
  };

  const handleSaveEdit = async () => {
    if (!editingBehavior || !newLabel.trim()) return;
    try {
      await adminApi.updateBehavior(editingBehavior.id, {
        label_fa: newLabel.trim(),
        guide_fa: newGuide.trim(),
      });
      setEditingBehavior(null);
      await loadBehaviors();
      alert('متن رفتار اصلاح شد و نسخه جدید کاتالوگ ثبت گردید.');
    } catch (err: any) {
      alert(err.message || 'خطا در ویرایش رفتار.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">کتابخانه رفتارهای استاندارد (کاتالوگ)</h2>
        <p className="text-xs text-slate-400">
          مشاهده کدهای ثابت و راهنمای تفسیری (guide_fa فقط برای مدیر سیستم قابل مشاهده است)
        </p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">در حال بارگذاری کاتالوگ...</div>
        ) : (
          behaviors.map((b) => (
            <div
              key={b.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                      b.polarity === 'warning'
                        ? 'bg-violet-950/40 text-violet-300 border-violet-800/50'
                        : 'bg-teal-950/40 text-teal-300 border-teal-800/50'
                    }`}
                  >
                    {b.code}
                  </span>
                  <h3 className="font-bold text-sm text-white">{b.label_fa}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-md">
                    نسخه {toPersianDigits(b.version)}
                  </span>
                  <button
                    onClick={() => handleStartEdit(b)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    title="ویرایش متن (ارتقای نسخه)"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Interpretation Guide - Admin Exclusive */}
              <div className="bg-slate-850 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                <span className="text-teal-400 font-bold block text-[11px]">
                  راهنمای تفسیر تسهیلگر (Guide):
                </span>
                <p className="text-slate-300 leading-relaxed">{b.guide_fa}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingBehavior && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">
                اصلاح متن رفتار ({editingBehavior.code})
              </h3>
              <button onClick={() => setEditingBehavior(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 leading-relaxed">
              توجه: کد رفتار ({editingBehavior.code}) برای همیشه ثابت می‌ماند و این تغییر یک نسخه جدید از کاتالوگ ثبت خواهد کرد.
            </p>

            <div>
              <label className="block text-xs text-slate-300 mb-1">متن روی اپ تسهیلگر:</label>
              <textarea
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">راهنمای تفسیری:</label>
              <textarea
                value={newGuide}
                onChange={(e) => setNewGuide(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingBehavior(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
              >
                ثبت نسخه جدید
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
