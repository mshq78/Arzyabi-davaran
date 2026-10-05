import React, { useEffect, useState } from 'react';
import { useAuth } from '../common/AuthContext';
import { adminApi } from '../../client/api';
import { Event } from '../../domain/types';
import { EventsView } from './EventsView';
import { LiveCoverageView } from './LiveCoverageView';
import { ParticipantsView } from './ParticipantsView';
import { ActivitiesView } from './ActivitiesView';
import { AssignmentsView } from './AssignmentsView';
import { CoverageReportView } from './CoverageReportView';
import { ExportsView } from './ExportsView';
import { AuditLogsView } from './AuditLogsView';
import { FacilitatorsView } from './FacilitatorsView';
import { CatalogView } from './CatalogView';
import {
  Activity,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeTab, setActiveTab] = useState<string>('live-coverage');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const list = await adminApi.getEvents();
      setEvents(list);
      if (list.length > 0 && !selectedEvent) {
        // Prefer active event or first
        const active = list.find((e) => e.status === 'Active') || list[0];
        setSelectedEvent(active);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';

  const tabs = [
    { id: 'live-coverage', label: 'پوشش زنده', icon: BarChart2, requiresEvent: true },
    { id: 'participants', label: 'شرکت‌کنندگان', icon: Users, requiresEvent: true },
    { id: 'activities', label: 'فعالیت‌ها', icon: Layers, requiresEvent: true },
    { id: 'assignments', label: 'تخصیص‌ها', icon: UserCheck, requiresEvent: true },
    { id: 'coverage-report', label: 'گزارش پوشش', icon: FileSpreadsheet, requiresEvent: true },
    { id: 'exports', label: 'خروجی‌ها', icon: Download, requiresEvent: true },
    { id: 'events', label: 'دوره‌ها', icon: Calendar, requiresEvent: false },
    { id: 'audit', label: 'ردپای ممیزی (Audit)', icon: FileText, requiresEvent: false },
    { id: 'users', label: 'کاربران', icon: Settings, requiresEvent: false },
    ...(isSystemAdmin ? [{ id: 'catalog', label: 'کتابخانه رفتار', icon: BookOpen, requiresEvent: false }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24">
      {/* Subheader with Event Switcher */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">دوره در حال مدیریت:</span>
            <select
              value={selectedEvent?.id || ''}
              onChange={(e) => {
                const found = events.find((ev) => ev.id === e.target.value);
                if (found) setSelectedEvent(found);
              }}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-hidden focus:border-indigo-500"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title} ({evt.status === 'Active' ? 'فعال' : evt.status === 'Closed' ? 'بسته' : 'پیش‌نویس'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>نقش شما:</span>
            <span className="font-bold text-teal-300">
              {user?.role === 'SYSTEM_ADMIN' ? 'مدیر ارشد سامانه' : 'مدیر دوره'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation Navigation Bar */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-10 z-20 overflow-x-auto scrollbar-none shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 py-1.5 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer touch-target ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {activeTab === 'events' && (
          <EventsView
            onSelectEvent={(evt) => {
              setSelectedEvent(evt);
              setActiveTab('live-coverage');
            }}
            selectedEventId={selectedEvent?.id}
          />
        )}

        {selectedEvent && (
          <>
            {activeTab === 'live-coverage' && <LiveCoverageView eventId={selectedEvent.id} />}
            {activeTab === 'participants' && <ParticipantsView eventId={selectedEvent.id} />}
            {activeTab === 'activities' && <ActivitiesView eventId={selectedEvent.id} />}
            {activeTab === 'assignments' && <AssignmentsView eventId={selectedEvent.id} />}
            {activeTab === 'coverage-report' && <CoverageReportView eventId={selectedEvent.id} />}
            {activeTab === 'exports' && <ExportsView event={selectedEvent} />}
          </>
        )}

        {activeTab === 'audit' && <AuditLogsView />}
        {activeTab === 'users' && <FacilitatorsView />}
        {activeTab === 'catalog' && isSystemAdmin && <CatalogView />}
      </div>
    </div>
  );
};
