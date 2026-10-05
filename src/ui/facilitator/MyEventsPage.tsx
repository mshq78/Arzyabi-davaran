import React, { useEffect, useState } from 'react';
import { api } from '../../client/api';
import { Event } from '../../domain/types';
import { formatShamsiDate } from '../../domain/dateUtils';
import { Calendar, ChevronLeft, MapPin, Sparkles } from 'lucide-react';

interface MyEventsPageProps {
  onSelectEvent: (eventId: string) => void;
}

export const MyEventsPage: React.FC<MyEventsPageProps> = ({ onSelectEvent }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const list = await api.getActiveEvents();
      setEvents(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-slate-400 text-xs">
        در حال بارگذاری دوره‌های فعال...
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-slate-100">دوره‌های من</h2>
        <p className="text-xs text-slate-400">دوره‌های فعالی که شما به عنوان تسهیلگر به آنها تخصیص دارید</p>
      </div>

      {events.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-2">
          <p>در حال حاضر دوره فعالی برای حساب شما یافت نشد.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <button
              key={evt.id}
              onClick={() => onSelectEvent(evt.id)}
              className="w-full text-right bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl p-4.5 transition shadow-sm space-y-3 block active:scale-[0.99] touch-target cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex-1 leading-snug">{evt.title}</h3>
                <ChevronLeft className="w-5 h-5 text-slate-500 mr-2 flex-shrink-0" />
              </div>

              {evt.description && (
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {evt.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
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
                <span className="mr-auto inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                  فعال
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
