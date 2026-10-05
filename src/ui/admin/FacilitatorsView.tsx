import React, { useEffect, useState } from 'react';
import { adminApi } from '../../client/api';
import { User } from '../../domain/types';
import { formatShamsiTime } from '../../domain/dateUtils';
import { KeyRound, LogOut, Plus, RefreshCw, Shield, UserCheck, UserX, X } from 'lucide-react';

export const FacilitatorsView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'FACILITATOR' | 'EVENT_ADMIN' | 'SYSTEM_ADMIN'>('FACILITATOR');

  const [tempPasswordModal, setTempPasswordModal] = useState<{ user: User; pass: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await adminApi.getUsers();
      setUsers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createUser({
        full_name: name.trim(),
        mobile_or_username: username.trim(),
        password: password.trim(),
        role,
      });
      setShowAddModal(false);
      setName('');
      setUsername('');
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'خطا در ساخت کاربر.');
    }
  };

  const handleResetPassword = async (user: User) => {
    if (!window.confirm(`آیا از بازنشانی رمز عبور برای «${user.full_name}» اطمینان دارید؟`)) return;
    try {
      const res = await adminApi.resetPassword(user.id);
      setTempPasswordModal({ user, pass: res.temp_password });
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'خطا در بازنشانی رمز.');
    }
  };

  const handleRevokeSessions = async (user: User) => {
    try {
      await adminApi.revokeSessions(user.id);
      alert(`نشست‌های فعال «${user.full_name}» ابطال شدند.`);
    } catch (err: any) {
      alert(err.message || 'خطا در ابطال نشست‌ها.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">مدیریت کاربران و تسهیلگران</h2>
          <p className="text-xs text-slate-400">ساخت کاربر، بازنشانی رمز، ابطال نشست و بررسی وضعیت فعالیت</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن کاربر</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">در حال بارگذاری کاربران...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-850 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">نام و نام خانوادگی</th>
                  <th className="p-3">نام کاربری</th>
                  <th className="p-3">نقش</th>
                  <th className="p-3">آخرین فعالیت</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-850/40">
                    <td className="p-3 font-medium text-white">{u.full_name}</td>
                    <td className="p-3 font-mono text-slate-300">{u.mobile_or_username}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.role === 'SYSTEM_ADMIN'
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                            : u.role === 'EVENT_ADMIN'
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {u.role === 'SYSTEM_ADMIN'
                          ? 'مدیر ارشد'
                          : u.role === 'EVENT_ADMIN'
                          ? 'مدیر دوره'
                          : 'تسهیلگر'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 text-[11px]">
                      {u.last_active_at ? formatShamsiTime(u.last_active_at) : 'بدون فعالیت'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          u.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {u.status === 'Active' ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="p-3 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800"
                          title="بازنشانی رمز عبور"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRevokeSessions(u)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                          title="ابطال نشست‌های این کاربر"
                        >
                          <LogOut className="w-3.5 h-3.5" />
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">افزودن کاربر جدید</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: پرهام راد"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">نام کاربری / شماره موبایل:</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: fac9"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">رمز عبور اولیه:</label>
              <input
                type="text"
                required
                minLength={8}
                placeholder="حداقل ۸ نویسه"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">نقش دسترسی:</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="FACILITATOR">تسهیلگر (فقط ثبت مشاهده)</option>
                <option value="EVENT_ADMIN">مدیر دوره (مدیریت شرکت‌کنندگان و فعالیت‌ها)</option>
                <option value="SYSTEM_ADMIN">مدیر سیستم (دسترسی کلان)</option>
              </select>
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
                ساخت کاربر
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Temporary Password Modal */}
      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-5 text-white shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-amber-300">رمز عبور جدید صادر شد</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              رمز موقت جدید برای کاربر «{tempPasswordModal.user.full_name}»:
            </p>
            <div className="bg-slate-800 p-3 rounded-xl text-center font-mono text-base font-bold text-amber-300 select-all border border-slate-700">
              {tempPasswordModal.pass}
            </div>
            <p className="text-[11px] text-slate-400">
              این رمز به صورت هش‌شده در سرور ذخیره شده و تمام نشست‌های قبلی کاربر ابطال گردیدند.
            </p>
            <button
              onClick={() => setTempPasswordModal(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
