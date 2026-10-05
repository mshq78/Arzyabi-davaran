import React, { useEffect, useState } from 'react';
import { adminApi } from '../../client/api';
import { Event } from '../../domain/types';
import { formatShamsiDate, toPersianDigits } from '../../domain/dateUtils';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  Layers,
  MapPin,
  Play,
  Plus,
  ShieldAlert,
  X,
} from 'lucide-react';

interface EventsViewProps {
  onSelectEvent: (event: Event) => void;
  selectedEventId?: string;
}

export const EventsView: React.FC<EventsViewProps> = ({ onSelectEvent, selectedEventId }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Create event modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-10-05');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  // Unassigned check modal
  const [checkEvent, setCheckEvent] = useState<Event | null>(null);
  const [checkResults, setCheckResults] = useState<any[] | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const list = await adminApi.getEvents();
      setEvents(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const newEvt = await adminApi.createEvent({
        title: title.trim(),
        event_date: date,
        location: location.trim(),
        description: description.trim(),
      });
      setShowCreateModal(false);
      setTitle('');
      await loadEvents();
      onSelectEvent(newEvt);
    } catch (err: any) {
      alert(err.message || 'خطا در ایجاد دوره.');
    }
  };

  const handleCopy = async (id: string) => {
    try {
      const copied = await adminApi.copyEvent(id);
      await loadEvents();
      onSelectEvent(copied);
      alert('دوره با موفقیت کپی شد.');
    } catch (err: any) {
      alert(err.message || 'خطا در کپی دوره.');
    }
  };

  const handleStatusChange = async (event: Event, nextStatus: string) => {
    // If activating, run assignment coverage check first!
    if (nextStatus === 'Active') {
      setCheckEvent(event);
      setChecking(true);
      try {
        const results = await adminApi.checkUnassigned(event.id);
        setCheckResults(results);
      } catch (err: any) {
        alert(err.message || 'خطا در بررسی پوشش تخصیص.');
        setCheckEvent(null);
      } finally {
        setChecking(false);
      }
      return;
    }

    try {
      await adminApi.updateEventStatus(event.id, nextStatus);
      await loadEvents();
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت دوره.');
    }
  };

  const confirmActivation = async () => {
    if (!checkEvent) return;
    try {
      await adminApi.updateEventStatus(checkEvent.id, 'Active');
      setCheckEvent(null);
      setCheckResults(null);
      await loadEvents();
      alert('دوره با موفقیت فعال شد.');
    } catch (err: any) {
      alert(err.message || 'خطا در فعال‌سازی دوره.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
            فعال
          </span>
        );
      case 'Closed':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
            بسته شده
          </span>
        );
      case 'Archived':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-850 text-slate-500 border border-slate-800 text-[10px]">
            بایگانی
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold">
            پیش‌نویس
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">دوره‌های ارزیابی و مشاهده</h2>
          <p className="text-xs text-slate-400">ساخت، کپی، کنترل پوشش و مدیریت وضعیت دوره‌ها</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>دوره جدید</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-xs text-slate-500">
            در حال بارگذاری دوره‌ها...
          </div>
        ) : events.length === 0 ? (
          <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            هیچ دوره‌ای ثبت نشده است.
          </div>
        ) : (
          events.map((evt) => {
            const isSelected = selectedEventId === evt.id;

            return (
              <div
                key={evt.id}
                className={`bg-slate-900 border rounded-2xl p-4.5 space-y-3 transition flex flex-col justify-between ${
                  isSelected ? 'border-indigo-500/80 shadow-md shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-white leading-snug">{evt.title}</h3>
                    <div>{getStatusBadge(evt.status)}</div>
                  </div>

                  {evt.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {evt.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{formatShamsiDate(evt.event_date)}</span>
                    </div>
                    {evt.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-teal-400" />
                        <span>{evt.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                  <button
                    onClick={() => onSelectEvent(evt)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold transition cursor-pointer"
                  >
                    مدیریت این دوره
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(evt.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="کپی ساختار دوره"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {evt.status === 'Draft' && (
                      <button
                        onClick={() => handleStatusChange(evt, 'Active')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-600/30 transition cursor-pointer"
                      >
                        فعال‌سازی
                      </button>
                    )}

                    {evt.status === 'Active' && (
                      <button
                        onClick={() => handleStatusChange(evt, 'Closed')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] hover:bg-slate-700 transition cursor-pointer"
                      >
                        بستن دوره
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pre-Activation Coverage Check Modal */}
      {checkEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">کنترل پوشش تخصیص قبل از فعال‌سازی</h3>
              </div>
              <button onClick={() => setCheckEvent(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {checking ? (
              <div className="text-center py-8 text-xs text-slate-400">
                در حال بررسی تخصیص تسهیلگران برای هر فعالیت...
              </div>
            ) : checkResults ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  بررسی وضعیت تخصیص تسهیلگران به گروه‌ها و افراد در دوره‌ی «{checkEvent.title}»:
                </p>

                <div className="space-y-2">
                  {checkResults.map((r, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        r.is_fully_assigned
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                          : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{r.activity_title}</span>
                        <span>{r.is_fully_assigned ? 'پوشش کامل' : 'دارای نقص تخصیص'}</span>
                      </div>

                      {!r.is_fully_assigned && (
                        <div className="text-[11px] space-y-1 pt-1 border-t border-amber-900/40 text-amber-300">
                          {r.unassigned_groups.length > 0 && (
                            <div>
                              گروه‌های بدون تسهیلگر:{' '}
                              {r.unassigned_groups.map((g: any) => g.code).join('، ')}
                            </div>
                          )}
                          {r.unassigned_participants_count > 0 && (
                            <div>
                              تعداد افراد فاقد تسهیلگر ناظر:{' '}
                              {toPersianDigits(r.unassigned_participants_count)} نفر
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCheckEvent(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
                  >
                    بازگشت و اصلاح تخصیص
                  </button>
                  <button
                    type="button"
                    onClick={confirmActivation}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    تأیید و فعال‌سازی دوره
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">ایجاد دوره جدید</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">عنوان دوره:</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: بوت‌کمپ سنجش تعاملی ۱۴۰۵"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">تاریخ برگزاری (شمسی یا میلادی):</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="2026-10-05"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">مکان برگزاری:</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: پردیس فناوری دانشگاه"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">توضیح کوتاه:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="توضیح مختصر درباره اهداف و محورهای دوره..."
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
                ایجاد دوره
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
