import React, { useEffect, useState } from 'react';
import { adminApi } from '../../client/api';
import { Activity } from '../../domain/types';
import { formatShamsiDateTime, toPersianDigits } from '../../domain/dateUtils';
import { CheckCircle2, Lock, Play, Plus, X } from 'lucide-react';

interface ActivitiesViewProps {
  eventId: string;
}

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({ eventId }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOrder, setNewOrder] = useState<number>(1);

  useEffect(() => {
    loadActivities();
  }, [eventId]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const list = await adminApi.getActivities(eventId);
      setActivities(list);
      setNewOrder(list.length + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await adminApi.createActivity(eventId, {
        title: newTitle.trim(),
        order_no: Number(newOrder),
      });
      setShowCreateModal(false);
      setNewTitle('');
      await loadActivities();
    } catch (err: any) {
      alert(err.message || 'خطا در ایجاد فعالیت.');
    }
  };

  const handleUpdateStatus = async (activityId: string, status: string) => {
    try {
      await adminApi.updateActivityStatus(activityId, status);
      await loadActivities();
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت فعالیت.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">مدیریت فعالیت‌ها</h2>
          <p className="text-xs text-slate-400">باز و بسته کردن فعالیت‌ها برای ثبت مشاهدات توسط تسهیلگران</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن فعالیت</span>
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">در حال بارگذاری فعالیت‌ها...</div>
        ) : activities.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            هنوز فعالیتی برای این دوره ثبت نشده است.
          </div>
        ) : (
          activities.map((act) => (
            <div
              key={act.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 font-bold font-mono text-xs flex items-center justify-center border border-slate-700">
                  {toPersianDigits(act.order_no)}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-white">{act.title}</h3>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>وضعیت: {act.status === 'Open' ? 'باز (در حال ثبت)' : act.status === 'Closed' ? 'بسته شده' : 'پیش‌نویس'}</span>
                    {act.closed_at && (
                      <span>• زمان بسته شدن: {formatShamsiDateTime(act.closed_at)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Actions */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                {act.status !== 'Open' && (
                  <button
                    onClick={() => handleUpdateStatus(act.id, 'Open')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>باز کردن فعالیت</span>
                  </button>
                )}

                {act.status === 'Open' && (
                  <button
                    onClick={() => handleUpdateStatus(act.id, 'Closed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>بستن فعالیت (اتمام ثبت)</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Activity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">ساخت فعالیت جدید</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">عنوان فعالیت:</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="مثال: شبیه‌سازی اتاق بحران"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">شماره ترتیب:</label>
              <input
                type="number"
                required
                value={newOrder}
                onChange={(e) => setNewOrder(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
              >
                ساخت فعالیت
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
