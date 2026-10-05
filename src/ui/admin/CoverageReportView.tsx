import React, { useEffect, useState } from 'react';
import { adminApi } from '../../client/api';
import { toPersianDigits } from '../../domain/dateUtils';
import { AlertCircle, CheckCircle2, Filter, Layers, RefreshCw } from 'lucide-react';

interface CoverageReportViewProps {
  eventId: string;
}

export const CoverageReportView: React.FC<CoverageReportViewProps> = ({ eventId }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string>('ALL');

  useEffect(() => {
    loadReport();
  }, [eventId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getCoverageReport(eventId);
      setRows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activityTitles = Array.from(new Set(rows.map((r) => r.activity_title))).filter(Boolean);

  const filtered = rows.filter((r) => {
    if (filterMissingOnly && !r.missing_coverage) return false;
    if (selectedActivity !== 'ALL' && r.activity_title !== selectedActivity) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">گزارش پوشش داده (فعالیت × فرد)</h2>
          <p className="text-xs text-slate-400">
            بررسی شاخص‌های تنوع ناظران، غیبت شواهد، و عدم فرصت مشاهده
          </p>
        </div>

        <button
          onClick={loadReport}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تازه‌سازی گزارش</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <select
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs"
          >
            <option value="ALL">تمام فعالیت‌ها</option>
            {activityTitles.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setFilterMissingOnly(!filterMissingOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition ${
            filterMissingOnly
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>فقط دارای نقص پوشش (Missing Coverage)</span>
        </button>

        <span className="mr-auto text-[11px] text-slate-400">
          تعداد ردیف‌ها: {toPersianDigits(filtered.length)}
        </span>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">در حال تولید گزارش...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">موردی برای نمایش یافت نشد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">فعالیت</th>
                  <th className="p-3">کد فرد</th>
                  <th className="p-3">نام و نام خانوادگی</th>
                  <th className="p-3 text-center">تسهیلگران تخصیص‌یافته</th>
                  <th className="p-3 text-center">تعداد مشاهده</th>
                  <th className="p-3 text-center">تنوع تسهیلگران ناظر</th>
                  <th className="p-3 text-center">علامت عدم فرصت</th>
                  <th className="p-3 text-left">وضعیت پوشش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-850/40">
                    <td className="p-3 text-slate-300 font-medium">{row.activity_title}</td>
                    <td className="p-3 font-mono font-bold text-slate-200">{row.participant_code}</td>
                    <td className="p-3 text-white font-medium">{row.participant_name}</td>
                    <td className="p-3 text-center font-mono text-slate-300">
                      {toPersianDigits(row.assigned_observer_count)}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-teal-300">
                      {toPersianDigits(row.observation_count)}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-sky-300">
                      {toPersianDigits(row.distinct_observer_count)}
                    </td>
                    <td className="p-3 text-center font-mono text-amber-300">
                      {toPersianDigits(row.no_opportunity_count)}
                    </td>
                    <td className="p-3 text-left">
                      {row.missing_coverage ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                          فاقد پوشش
                        </span>
                      ) : row.observation_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                          پوشش کامل
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                          عدم فرصت
                        </span>
                      )}
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
