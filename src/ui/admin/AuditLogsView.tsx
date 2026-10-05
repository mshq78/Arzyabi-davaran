import React, { useEffect, useState } from 'react';
import { adminApi } from '../../client/api';
import { AuditLog } from '../../domain/types';
import { formatShamsiDateTime } from '../../domain/dateUtils';
import { FileText, Filter, RefreshCw, Search } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const list = await adminApi.getAuditLogs();
      setLogs(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = Array.from(new Set(logs.map((l) => l.action))).filter(Boolean);

  const filtered = logs.filter((log) => {
    const matchesSearch =
      (log.actor_name || '').includes(search.trim()) ||
      log.action.toLowerCase().includes(search.toLowerCase().trim()) ||
      log.entity_type.toLowerCase().includes(search.toLowerCase().trim());
    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">رد پای ممیزی و رویدادهای سیستمی (Audit Log)</h2>
          <p className="text-xs text-slate-400">
            ثبت غیرقابل تغییر تمام عملیات‌های مدیریتی، ورودها، ویرایش‌ها، ابطال‌ها و صدور فایل‌ها
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تازه‌سازی</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی کاربر، عملیات یا موجودیت..."
            className="w-full pr-10 pl-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs"
          >
            <option value="ALL">تمام عملیات‌ها</option>
            {actionTypes.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">در حال بارگذاری لاگ‌ها...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">هیچ لاگی یافت نشد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">زمان (شمسی)</th>
                  <th className="p-3">کاربر عامل</th>
                  <th className="p-3">نوع عملیات</th>
                  <th className="p-3">موجودیت</th>
                  <th className="p-3">شناسه موجودیت</th>
                  <th className="p-3 text-left">جزئیات قبل/بعد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const hasDetails = log.before_json || log.after_json;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-850/40">
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {formatShamsiDateTime(log.created_at)}
                        </td>
                        <td className="p-3 font-bold text-white">{log.actor_name || log.actor_id}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{log.entity_type}</td>
                        <td className="p-3 font-mono text-slate-400 text-[11px]">{log.entity_id}</td>
                        <td className="p-3 text-left">
                          {hasDetails ? (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-xs text-teal-400 hover:text-teal-300 font-medium cursor-pointer"
                            >
                              {isExpanded ? 'بستن' : 'مشاهده تفاوت'}
                            </button>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Before / After Row */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80">
                          <td colSpan={6} className="p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {log.before_json && (
                                <div className="space-y-1">
                                  <span className="text-slate-400 font-bold">وضعیت قبل (Before):</span>
                                  <pre className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-rose-300 overflow-x-auto max-h-40">
                                    {JSON.stringify(JSON.parse(log.before_json), null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.after_json && (
                                <div className="space-y-1">
                                  <span className="text-slate-400 font-bold">وضعیت بعد (After):</span>
                                  <pre className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-teal-300 overflow-x-auto max-h-40">
                                    {JSON.stringify(JSON.parse(log.after_json), null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
