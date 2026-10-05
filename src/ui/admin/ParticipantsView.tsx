import React, { useEffect, useState } from 'react';
import { readTable } from '../../utils/participantsImport';
import { adminApi } from '../../client/api';
import { Participant } from '../../domain/types';
import { toPersianDigits } from '../../domain/dateUtils';
import {
  AlertCircle,
  Check,
  Edit2,
  Filter,
  Plus,
  Search,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';

interface ParticipantsViewProps {
  eventId: string;
}

export const ParticipantsView: React.FC<ParticipantsViewProps> = ({ eventId }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  // Manual modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualGroup, setManualGroup] = useState('01G');

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // Edit modal
  const [editingParticipant, setEditingParticipant] = useState<any | null>(null);

  useEffect(() => {
    loadParticipants();
  }, [eventId]);

  const loadParticipants = async () => {
    setLoading(true);
    try {
      const list = await adminApi.getParticipants(eventId);
      setParticipants(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Group codes list
  const groupCodes = Array.from(
    new Set(participants.map((p) => p.group_code).filter(Boolean))
  ).sort();

  const filtered = participants.filter((p) => {
    const matchesSearch =
      p.full_name.includes(search.trim()) ||
      p.participant_code.toLowerCase().includes(search.toLowerCase().trim());
    const matchesGroup = selectedGroup === 'ALL' || p.group_code === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    try {
      await adminApi.createParticipant(eventId, {
        full_name: manualName.trim(),
        participant_code: manualCode.trim() || undefined,
        group_code: manualGroup.trim() || '01G',
      });
      setShowManualModal(false);
      setManualName('');
      setManualCode('');
      await loadParticipants();
    } catch (err: any) {
      alert(err.message || 'خطا در افزودن شرکت‌کننده.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    readTable(file)
      .then((rawJson: any[]) => {
        // Normalize rows and validate
        const errors: string[] = [];
        const normalized = rawJson.map((row, idx) => {
          const name = row.name_full || row.full_name || row['نام و نام خانوادگی'] || row['نام'];
          const group = row.code_group || row.group_code || row['گروه'] || '01G';
          const code = row.participant_code || row.code_participant || row['کد شرکت‌کننده'];

          if (!name) {
            errors.push(`ردیف ${idx + 1}: فاقد نام است.`);
          }

          return {
            name_full: name || 'بدون نام',
            code_group: String(group).trim(),
            participant_code: code ? String(code).trim() : '',
            code_personnel: row.code_personnel || row.personnel_code || '',
            organization: row.organization || row['سازمان'] || '',
            title_job: row.title_job || row.job_title || row['شغل'] || '',
          };
        });

        setParsedRows(normalized);
        setImportErrors(errors);
      })
      .catch(() => {
        alert('خطا در خواندن فایل اکسل (xlsx) یا CSV.');
      });
  };

  const handleCommitImport = async () => {
    if (parsedRows.length === 0 || importing) return;
    setImporting(true);
    try {
      await adminApi.importParticipants(eventId, parsedRows);
      setShowImportModal(false);
      setParsedRows([]);
      await loadParticipants();
    } catch (err: any) {
      alert(err.message || 'خطا در واردسازی اطلاعات.');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingParticipant) return;
    try {
      await adminApi.updateParticipant(editingParticipant.id, editingParticipant);
      setEditingParticipant(null);
      await loadParticipants();
    } catch (err: any) {
      alert(err.message || 'خطا در ویرایش شرکت‌کننده.');
    }
  };

  const handleToggleStatus = async (p: any) => {
    const nextStatus = p.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await adminApi.updateParticipant(p.id, { status: nextStatus });
      await loadParticipants();
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت شرکت‌کننده.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">مدیریت شرکت‌کنندگان</h2>
          <p className="text-xs text-slate-400">
            فهرست افراد، تخصیص گروه‌ها و واردسازی دسته‌جمعی از فایل
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>واردسازی اکسل / CSV</span>
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن فرد</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام یا کد فرد..."
            className="w-full pr-10 pl-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs"
          >
            <option value="ALL">همه گروه‌ها</option>
            {groupCodes.map((code) => (
              <option key={code} value={code}>
                گروه {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">در حال بارگذاری...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">هیچ شرکت‌کننده‌ای یافت نشد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">کد</th>
                  <th className="p-3">نام و نام خانوادگی</th>
                  <th className="p-3">گروه</th>
                  <th className="p-3">کد پرسنلی / سازمان</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/40">
                    <td className="p-3 font-mono font-bold text-slate-300">{p.participant_code}</td>
                    <td className="p-3 font-medium text-white">{p.full_name}</td>
                    <td className="p-3 font-mono text-indigo-300 font-bold">{p.group_code || '-'}</td>
                    <td className="p-3 text-slate-400">
                      {p.organization ? `${p.organization} (${p.personnel_code || '-'})` : p.personnel_code || '-'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          p.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {p.status === 'Active' ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="p-3 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingParticipant({ ...p })}
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800"
                          title="ویرایش"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                          title={p.status === 'Active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                        >
                          {p.status === 'Active' ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Participant Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleManualAdd}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">افزودن شرکت‌کننده دستی</h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">نام و نام خانوادگی:</label>
              <input
                type="text"
                required
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="مثال: آرش رضایی"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">کد شرکت‌کننده (اختیاری):</label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="مثال: PT-065 (در صورت خالی بودن خودکار تولید می‌شود)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">کد گروه:</label>
              <input
                type="text"
                value={manualGroup}
                onChange={(e) => setManualGroup(e.target.value)}
                placeholder="مثال: 01G"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
              >
                افزودن
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Excel / CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">واردسازی شرکت‌کنندگان از فایل Excel یا CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-850 rounded-xl text-xs text-slate-300 leading-relaxed space-y-1">
              <p className="font-bold text-indigo-300">راهنمای ساختار ستون‌های فایل:</p>
              <p>
                ستون‌های مجاز: <code className="text-amber-300">name_full</code> یا <code className="text-amber-300">full_name</code>، <code className="text-amber-300">code_group</code> یا <code className="text-amber-300">group_code</code> (گروه‌ها خودکار ساخته می‌شوند)، <code className="text-amber-300">participant_code</code> (اختیاری).
              </p>
            </div>

            <input
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileUpload}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
            />

            {/* Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">
                    پیش‌نمایش: {toPersianDigits(parsedRows.length)} سطر شناسایی شد
                  </span>
                  {importErrors.length > 0 && (
                    <span className="text-rose-400 font-bold">{toPersianDigits(importErrors.length)} خطا</span>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-800 text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2">نام کامل</th>
                        <th className="p-2">گروه</th>
                        <th className="p-2">کد</th>
                        <th className="p-2">کد پرسنلی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {parsedRows.slice(0, 15).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-850">
                          <td className="p-2 font-medium text-white">{row.name_full}</td>
                          <td className="p-2 font-mono text-indigo-300">{row.code_group}</td>
                          <td className="p-2 font-mono text-slate-400">{row.participant_code || '(تولید خودکار)'}</td>
                          <td className="p-2 text-slate-400">{row.code_personnel || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={parsedRows.length === 0 || importing}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition disabled:opacity-40"
              >
                {importing ? 'در حال واردسازی...' : 'تأیید و واردسازی اطلاعات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Participant Modal */}
      {editingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4">
            <h3 className="font-bold text-sm">ویرایش مشخصات شرکت‌کننده</h3>

            <div>
              <label className="block text-xs text-slate-300 mb-1">نام و نام خانوادگی:</label>
              <input
                type="text"
                value={editingParticipant.full_name}
                onChange={(e) =>
                  setEditingParticipant({ ...editingParticipant, full_name: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">کد شرکت‌کننده:</label>
              <input
                type="text"
                value={editingParticipant.participant_code}
                onChange={(e) =>
                  setEditingParticipant({ ...editingParticipant, participant_code: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">سازمان:</label>
              <input
                type="text"
                value={editingParticipant.organization || ''}
                onChange={(e) =>
                  setEditingParticipant({ ...editingParticipant, organization: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingParticipant(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
              >
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
