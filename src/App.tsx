/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './ui/common/AuthContext';
import { HeaderStatus } from './ui/common/HeaderStatus';
import { DevPanel } from './ui/common/DevPanel';
import { LoginPage } from './ui/facilitator/LoginPage';
import { FacilitatorLayout } from './ui/facilitator/FacilitatorLayout';
import { AdminLayout } from './ui/admin/AdminLayout';
import { CONFIG } from './domain/config';
import { Shield } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

const MainRouter: React.FC = () => {
  const { user, loading } = useAuth();
  // Allow admins in demo mode to switch between Admin Panel and Facilitator View to test both experiences seamlessly
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'facilitator'>('admin');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">در حال فراخوانی سامانه GERA...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  const isAdmin = user.role === 'SYSTEM_ADMIN' || user.role === 'EVENT_ADMIN';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      {/* Top Status Header */}
      <HeaderStatus />

      {/* Admin Demo View Mode Switcher */}
      {isAdmin && CONFIG.DEMO_MODE && (
        <div className="bg-indigo-950/60 border-b border-indigo-800/40 px-4 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-indigo-300">
            <Shield className="w-3.5 h-3.5 text-teal-400" />
            <span>حالت نمایشی مدیر:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-indigo-700/40">
            <button
              onClick={() => setAdminViewMode('admin')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                adminViewMode === 'admin'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              پنل مدیریت
            </button>
            <button
              onClick={() => setAdminViewMode('facilitator')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                adminViewMode === 'facilitator'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              نمای تسهیلگر
            </button>
          </div>
        </div>
      )}

      {/* Main View Router */}
      <div className="flex-1">
        {isAdmin && adminViewMode === 'admin' ? (
          <AdminLayout />
        ) : (
          <FacilitatorLayout />
        )}
      </div>

      {/* DevPanel (Only visible in DEMO_MODE) */}
      <DevPanel />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
