import React, { useEffect, useState } from 'react';
import { useAuth } from '../common/AuthContext';
import { useSync } from '../common/useSync';
import { api } from '../../client/api';
import { MyEventsPage } from './MyEventsPage';
import { OnboardingPage } from './OnboardingPage';
import { ActiveActivityPage } from './ActiveActivityPage';
import { ObserveParticipantPage } from './ObserveParticipantPage';
import { MyRecentEntriesPage } from './MyRecentEntriesPage';
import { SyncStatusPage } from './SyncStatusPage';
import { toPersianDigits } from '../../domain/dateUtils';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  ListTodo,
  RefreshCw,
  Users,
} from 'lucide-react';

export const FacilitatorLayout: React.FC = () => {
  const { user, activeEventId, setActiveEventId } = useAuth();
  const { pendingCount } = useSync();

  const [activeTab, setActiveTab] = useState<'activity' | 'entries' | 'sync' | 'events'>('activity');
  const [onboardingRequiredEventId, setOnboardingRequiredEventId] = useState<string | null>(null);
  const [observingParticipant, setObservingParticipant] = useState<{
    activityId: string;
    participantId: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-select first active event if none selected
  useEffect(() => {
    if (!activeEventId) {
      api.getActiveEvents().then((events) => {
        if (events.length > 0) {
          handleSelectEvent(events[0].id);
        }
      });
    }
  }, [activeEventId]);

  const handleSelectEvent = async (eventId: string) => {
    try {
      const acked = await api.getOnboardingStatus(eventId);
      if (!acked) {
        setOnboardingRequiredEventId(eventId);
      } else {
        setOnboardingRequiredEventId(null);
        setActiveEventId(eventId);
        setActiveTab('activity');
        setObservingParticipant(null);
      }
    } catch {
      setActiveEventId(eventId);
      setActiveTab('activity');
    }
  };

  const handleOnboardingComplete = () => {
    if (onboardingRequiredEventId) {
      setActiveEventId(onboardingRequiredEventId);
      setOnboardingRequiredEventId(null);
      setActiveTab('activity');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleObservationSuccess = (msg: string) => {
    showToast(msg);
    setObservingParticipant(null);
    setActiveTab('activity');
  };

  // If onboarding is mandatory for selected event
  if (onboardingRequiredEventId) {
    return (
      <OnboardingPage
        eventId={onboardingRequiredEventId}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // If observing a participant
  if (observingParticipant && activeEventId) {
    return (
      <>
        {toastMessage && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg animate-fade-in">
            {toastMessage}
          </div>
        )}
        <ObserveParticipantPage
          eventId={activeEventId}
          activityId={observingParticipant.activityId}
          participantId={observingParticipant.participantId}
          onBack={() => setObservingParticipant(null)}
          onSuccess={handleObservationSuccess}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 pb-20">
        {activeTab === 'events' && (
          <MyEventsPage onSelectEvent={handleSelectEvent} />
        )}

        {activeTab === 'activity' && (
          activeEventId ? (
            <ActiveActivityPage
              eventId={activeEventId}
              onSelectParticipant={(actId, pId) =>
                setObservingParticipant({ activityId: actId, participantId: pId })
              }
              onBackToEvents={() => setActiveTab('events')}
            />
          ) : (
            <MyEventsPage onSelectEvent={handleSelectEvent} />
          )
        )}

        {activeTab === 'entries' && (
          <MyRecentEntriesPage onBack={() => setActiveTab('activity')} />
        )}

        {activeTab === 'sync' && <SyncStatusPage />}
      </div>

      {/* Facilitator Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-xl">
        <div className="max-w-md mx-auto grid grid-cols-4 py-1.5 px-2">
          {/* Tab 1: Active Activity */}
          <button
            onClick={() => {
              setObservingParticipant(null);
              setActiveTab('activity');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition cursor-pointer touch-target ${
              activeTab === 'activity' && !observingParticipant
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-1">افراد دوره</span>
          </button>

          {/* Tab 2: My Entries */}
          <button
            onClick={() => {
              setObservingParticipant(null);
              setActiveTab('entries');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition cursor-pointer touch-target ${
              activeTab === 'entries'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTodo className="w-5 h-5" />
            <span className="text-[10px] mt-1">ثبت‌های من</span>
          </button>

          {/* Tab 3: Sync Status */}
          <button
            onClick={() => {
              setObservingParticipant(null);
              setActiveTab('sync');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition relative cursor-pointer touch-target ${
              activeTab === 'sync'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <RefreshCw className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center font-mono">
                  {toPersianDigits(pendingCount)}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1">همگام‌سازی</span>
          </button>

          {/* Tab 4: My Events */}
          <button
            onClick={() => {
              setObservingParticipant(null);
              setActiveTab('events');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition cursor-pointer touch-target ${
              activeTab === 'events'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-1">دوره‌ها</span>
          </button>
        </div>
      </div>
    </div>
  );
};
