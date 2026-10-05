import React, { useEffect, useState } from 'react';
import { api } from '../../client/api';
import { Activity, EffectiveParticipant } from '../../domain/types';
import { toPersianDigits } from '../../domain/dateUtils';
import { useAuth } from '../common/AuthContext';
import {
  CheckCircle,
  Circle,
  Clock,
  Filter,
  Layers,
  Search,
  Users,
} from 'lucide-react';

interface ActiveActivityPageProps {
  eventId: string;
  onSelectParticipant: (activityId: string, participantId: string) => void;
  onBackToEvents: () => void;
}

export const ActiveActivityPage: React.FC<ActiveActivityPageProps> = ({
  eventId,
  onSelectParticipant,
  onBackToEvents,
}) => {
  const { user } = useAuth();
  const [eventTitle, setEventTitle] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [participants, setParticipants] = useState<EffectiveParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnrecordedOnly, setFilterUnrecordedOnly] = useState(false);

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    setLoading(true);
    try {
      const data = await api.getEventAssignments(eventId);
      if (data) {
        setEventTitle(data.event?.title || 'دوره');
        const openActs = (data.activities || []).filter((a: Activity) => a.status === 'Open');
        setActivities(openActs);
        if (openActs.length > 0) {
          setSelectedActivityId(openActs[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedActivityId && user) {
      loadParticipants(selectedActivityId);
    } else {
      setParticipants([]);
    }
  }, [selectedActivityId, user]);

  const loadParticipants = async (actId: string) => {
    if (!user) return;
    try {
      const list = await api.getActivityParticipants(actId, user.id);
      setParticipants(list);
    } catch (err) {
      console.error(err);
    }
  };

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);

  // Filter participants
  const filteredParticipants = participants.filter((p) => {
    const matchesSearch =
      p.full_name.includes(searchQuery.trim()) ||
      p.participant_code.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (p.group_code && p.group_code.toLowerCase().includes(searchQuery.toLowerCase().trim()));

    if (!matchesSearch) return false;
    if (filterUnrecordedOnly && p.has_observation) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-slate-400 text-xs">
        در حال بارگذاری فعالیت‌های فعال...
      </div>
    );
  }

  // If no open activities
  if (activities.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-200">فعلاً فعالیتی برای ثبت باز نیست.</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          به محض اینکه مدیر رویداد فعالیت بعدی را باز کند، فهرست افراد برای شما در دسترس قرار خواهد گرفت.
        </p>
        <button
          onClick={loadEventData}
          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
        >
          بررسی مجدد
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-4 pb-20">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="truncate">{eventTitle}</span>
          <button
            onClick={onBackToEvents}
            className="text-indigo-400 hover:text-indigo-300 transition"
          >
            تغییر دوره
          </button>
        </div>

        {/* Multi-Activity Switcher */}
        {activities.length > 1 ? (
          <div>
            <label className="block text-[11px] text-slate-400 mb-1.5">انتخاب فعالیت جاری:</label>
            <div className="grid grid-cols-2 gap-2">
              {activities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => setSelectedActivityId(act.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-right transition border ${
                    selectedActivityId === act.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="truncate">{act.title}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
            <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>{selectedActivity?.title}</span>
          </div>
        )}
      </div>

      {/* Search and Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی نام یا کد فرد..."
            className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center justify-between text-xs px-1">
          <button
            onClick={() => setFilterUnrecordedOnly(!filterUnrecordedOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition cursor-pointer touch-target ${
              filterUnrecordedOnly
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>فقط افراد هنوز ثبت‌نشده</span>
          </button>

          <span className="text-[11px] text-slate-500 font-medium">
            تعداد: {toPersianDigits(filteredParticipants.length)} نفر
          </span>
        </div>
      </div>

      {/* Participants List */}
      <div className="space-y-2">
        {filteredParticipants.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-1">
            <Users className="w-6 h-6 text-slate-600 mx-auto" />
            <p>موردی با این مشخصات یافت نشد.</p>
          </div>
        ) : (
          filteredParticipants.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectParticipant(selectedActivityId, p.id)}
              className="w-full text-right bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-3 transition shadow-xs touch-target cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700/80 font-mono">
                  {toPersianDigits(p.participant_code.replace('PT-', ''))}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">{p.full_name}</h4>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{p.participant_code}</span>
                    {p.group_code && (
                      <>
                        <span>•</span>
                        <span>گروه {p.group_code}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Strict Neutral Status Indicator */}
              <div>
                {p.has_observation ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
                    <span>ثبت داشته</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-850 text-slate-400 border border-slate-800 text-[11px]">
                    <Circle className="w-3 h-3 text-slate-500" />
                    <span>هنوز ثبت نشده</span>
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
