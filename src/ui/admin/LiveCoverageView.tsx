import React, { useEffect, useState } from 'react';
import { adminApi } from '../../client/api';
import { toPersianDigits, formatShamsiTime } from '../../domain/dateUtils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Users,
  Wifi,
} from 'lucide-react';

interface LiveCoverageViewProps {
  eventId: string;
}

export const LiveCoverageView: React.FC<LiveCoverageViewProps> = ({ eventId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [minObservations, setMinObservations] = useState(2);
  const [minObservers, setMinObservers] = useState(2);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // 10s live polling
    return () => clearInterval(interval);
  }, [eventId]);

  const loadData = async () => {
    try {
      const res = await adminApi.getLiveCoverage(eventId);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs">
        در حال دریافت داده‌های پوشش زنده...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 rounded-2xl border border-slate-800">
        اطلاعات پوشش برای این دوره یافت نشد.
      </div>
    );
  }

  // Filter low data participants based on live adjustable thresholds
  const lowDataList = (data.low_data_participants || []).filter(
    (p: any) => p.observation_count < minObservations || p.observer_diversity < minObservers
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Notice: Coverage Only */}
      <div className="bg-sky-950/30 border border-sky-800/40 rounded-2xl p-4 text-xs text-sky-200 leading-relaxed flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-sky-100">داشبورد پایش زنده پوشش مشاهدات: </span>
          این بخش صرفاً شاخص‌های توزیع و تنوع ثبت شواهد را نشان می‌دهد. هیچ‌گونه نمره، رتبه یا نسبت رفتارهای مثبت/هشدار در طول اجرای رویداد نمایش داده نمی‌شود.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>درصد پوشش فعالیت جاری</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            ٪{toPersianDigits(data.coverage_percent)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {toPersianDigits(data.observed_participants_count)} از {toPersianDigits(data.participant_count)} نفر
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>کل مشاهدات ثبت‌شده</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-300 mt-2 font-mono">
            {toPersianDigits(data.total_observations_count)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            در تمام فعالیت‌های دوره
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>فعالیت جاری</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-sm font-bold text-white mt-2 truncate">
            {data.current_activity?.title || 'بدون فعالیت باز'}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            {data.current_activity ? 'در حال اجرا (باز)' : '-'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>فعالیت بعدی</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-sm font-bold text-slate-200 mt-2 truncate">
            {data.next_activity?.title || 'تعریف‌نشده'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {data.next_activity ? 'پیش‌نویس' : '-'}
          </div>
        </div>
      </div>

      {/* Facilitator Connection and Sync State */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-teal-400" />
            <span>وضعیت اتصال و فعالیت تسهیلگران</span>
          </h3>
          <button
            onClick={loadData}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تازه‌سازی</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {(data.facilitators || []).map((fac: any) => {
            const hasRecentActivity =
              fac.last_active_at &&
              Date.now() - new Date(fac.last_active_at).getTime() < 5 * 60 * 1000;

            return (
              <div
                key={fac.id}
                className="bg-slate-850 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">{fac.full_name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {fac.last_active_at
                      ? `فعالیت: ${formatShamsiTime(fac.last_active_at)}`
                      : 'بدون فعالیت اخیراً'}
                  </div>
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasRecentActivity ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'
                  }`}
                  title={hasRecentActivity ? 'متصل' : 'غیرفعال'}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Low Data Participants Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>فهرست افراد با داده کم (نیازمند توجه تسهیلگران)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              افرادی که تعداد مشاهدات یا تنوع مشاهده‌گران آنها از آستانه مشخص کمتر است.
            </p>
          </div>

          {/* Threshold Adjusters */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">حداقل مشاهده:</span>
              <select
                value={minObservations}
                onChange={(e) => setMinObservations(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs"
              >
                <option value={1}>۱</option>
                <option value={2}>۲</option>
                <option value={3}>۳</option>
                <option value={4}>۴</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">حداقل تسهیلگر متفاوت:</span>
              <select
                value={minObservers}
                onChange={(e) => setMinObservers(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs"
              >
                <option value={1}>۱</option>
                <option value={2}>۲</option>
                <option value={3}>۳</option>
              </select>
            </div>
          </div>
        </div>

        {lowDataList.length === 0 ? (
          <div className="p-8 text-center text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 rounded-xl">
            تمام افراد دارای پوشش کافی مطابق آستانه‌های تعیین‌شده هستند.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">کد</th>
                  <th className="p-3">نام و نام‌خانوادگی</th>
                  <th className="p-3 text-center">تعداد مشاهدات</th>
                  <th className="p-3 text-center">تنوع مشاهده‌گران (تسهیلگر متفاوت)</th>
                  <th className="p-3 text-center">ثبت عدم فرصت</th>
                  <th className="p-3 text-left">وضعیت پوشش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lowDataList.map((p: any) => (
                  <tr key={p.participant_id} className="hover:bg-slate-850/50">
                    <td className="p-3 font-mono font-bold text-slate-300">{p.participant_code}</td>
                    <td className="p-3 font-medium text-white">{p.full_name}</td>
                    <td className="p-3 text-center font-mono font-bold text-amber-300">
                      {toPersianDigits(p.observation_count)}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-sky-300">
                      {toPersianDigits(p.observer_diversity)}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-400">
                      {toPersianDigits(p.no_opportunity_count)}
                    </td>
                    <td className="p-3 text-left">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium">
                        داده کم
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
