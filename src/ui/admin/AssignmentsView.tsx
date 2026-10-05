import React, { useEffect, useState } from 'react';
import { adminApi } from '../../client/api';
import { Activity, Assignment, User } from '../../domain/types';
import {
  Ban,
  Check,
  Plus,
  RefreshCw,
  Repeat,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';

interface AssignmentsViewProps {
  eventId: string;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({ eventId }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Assignment modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [actId, setActId] = useState('');
  const [facId, setFacId] = useState('');
  const [kind, setKind] = useState<'group' | 'individual' | 'override'>('group');
  const [targetId, setTargetId] = useState(''); // group code or participant id

  // Rotation tool modal
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotFromAct, setRotFromAct] = useState('');
  const [rotToAct, setRotToAct] = useState('');
  const [rotationPreview, setRotationPreview] = useState<any[] | null>(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [asgList, actList, userList] = await Promise.all([
        adminApi.getAssignments(eventId),
        adminApi.getActivities(eventId),
        adminApi.getUsers(),
      ]);
      setAssignments(asgList);
      setActivities(actList);
      setUsers(userList.filter((u) => u.role === 'FACILITATOR'));

      if (actList.length > 0) {
        setActId(actList[0].id);
        setRotFromAct(actList[0].id);
        if (actList[1]) setRotToAct(actList[1].id);
      }
      if (userList.length > 0) setFacId(userList[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createAssignment(eventId, {
        activity_id: actId,
        facilitator_id: facId,
        kind,
        group_id: kind === 'group' ? targetId : undefined,
        participant_id: kind !== 'group' ? targetId : undefined,
      });
      setShowAddModal(false);
      setTargetId('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت تخصیص.');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('آیا از ابطال این تخصیص مطمئن هستید؟')) return;
    try {
      await adminApi.revokeAssignment(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ابطال تخصیص.');
    }
  };

  const handlePreviewRotation = async () => {
    if (!rotFromAct || !rotToAct) return;
    try {
      const res = await adminApi.rotateAssignments(eventId, rotFromAct, rotToAct, false);
      setRotationPreview(res.assignments);
    } catch (err: any) {
      alert(err.message || 'خطا در پیش‌نمایش چرخش.');
    }
  };

  const handleCommitRotation = async () => {
    try {
      await adminApi.rotateAssignments(eventId, rotFromAct, rotToAct, true);
      setShowRotateModal(false);
      setRotationPreview(null);
      await loadData();
      alert('چرخش تخصیص‌ها با موفقیت اعمال شد.');
    } catch (err: any) {
      alert(err.message || 'خطا در اعمال چرخش.');
    }
  };

  const userMap = new Map(users.map((u) => [u.id, u]));
  const actMap = new Map(activities.map((a) => [a.id, a]));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">ماتریس تخصیص تسهیلگران</h2>
          <p className="text-xs text-slate-400">
            تخصیص گروهی، فردی، یا اولویت (Override) و ابزار چرخش بین فعالیت‌ها
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRotateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <RotateCw className="w-4 h-4 text-teal-400" />
            <span>چرخش پیشنهادی گروه‌ها</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تخصیص جدید</span>
          </button>
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">در حال بارگذاری تخصیص‌ها...</div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">هنوز تخصیصی ثبت نشده است.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">فعالیت</th>
                  <th className="p-3">تسهیلگر</th>
                  <th className="p-3">نوع تخصیص</th>
                  <th className="p-3">هدف (گروه یا فرد)</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {assignments.map((asg) => (
                  <tr key={asg.id} className="hover:bg-slate-850/40">
                    <td className="p-3 font-medium text-white">{actMap.get(asg.activity_id)?.title || asg.activity_id}</td>
                    <td className="p-3 font-medium text-indigo-300">{userMap.get(asg.facilitator_id)?.full_name || asg.facilitator_id}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          asg.kind === 'override'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : asg.kind === 'individual'
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}
                      >
                        {asg.kind === 'override' ? 'جایگزین (Override)' : asg.kind === 'individual' ? 'فردی' : 'گروهی'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{asg.group_id || asg.participant_id || '-'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] border ${
                          asg.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700 line-through'
                        }`}
                      >
                        {asg.status === 'Active' ? 'فعال' : 'ابطال‌شده'}
                      </span>
                    </td>
                    <td className="p-3 text-left">
                      {asg.status === 'Active' && (
                        <button
                          onClick={() => handleRevoke(asg.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                          title="ابطال تخصیص"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateAssignment}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">ثبت تخصیص جدید</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">فعالیت:</label>
              <select
                value={actId}
                onChange={(e) => setActId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">تسهیلگر:</label>
              <select
                value={facId}
                onChange={(e) => setFacId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.mobile_or_username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">نوع تخصیص:</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="group">گروهی (تمامی اعضای گروه)</option>
                <option value="individual">فردی (افزودن فرد مشخص به دید تسهیلگر)</option>
                <option value="override">جایگزین / Override (سلب دسترسی دیگران و واگذاری انحصاری)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                {kind === 'group' ? 'شناسه / کد گروه (مثال: grp-01G یا 01G):' : 'شناسه فرد (مثال: pt-001):'}
              </label>
              <input
                type="text"
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder={kind === 'group' ? 'grp-01G' : 'pt-001'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
              >
                ثبت تخصیص
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Suggested Rotation Modal */}
      {showRotateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-sm">ابزار چرخش پیشنهادی گروه‌ها</h3>
              </div>
              <button onClick={() => setShowRotateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              برای فعالیت بعدی، گروه‌ها یک گام بین تسهیلگران جابه‌جا می‌شوند (گروه i به تسهیلگر بعدی). پیش‌نمایش را بررسی کرده و در صورت تأیید ذخیره کنید.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">فعالیت مبدأ:</label>
                <select
                  value={rotFromAct}
                  onChange={(e) => setRotFromAct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">فعالیت مقصد:</label>
                <select
                  value={rotToAct}
                  onChange={(e) => setRotToAct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handlePreviewRotation}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-teal-300 border border-teal-500/30 text-xs font-bold transition"
            >
              مشاهده پیش‌نمایش چرخش
            </button>

            {rotationPreview && (
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <h4 className="text-xs font-bold text-white">
                  پیش‌نمایش تخصیص جدید ({rotationPreview.length} گروه):
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-1">
                  {rotationPreview.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-850 border border-slate-800 text-xs flex justify-between items-center"
                    >
                      <span className="font-mono text-indigo-300 font-bold">{item.group_id}</span>
                      <span className="text-slate-400">به تسهیلگر:</span>
                      <span className="font-bold text-white">
                        {userMap.get(item.facilitator_id)?.full_name || item.facilitator_id}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleCommitRotation}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition"
                >
                  تأیید و ذخیره چرخش تخصیص‌ها
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
