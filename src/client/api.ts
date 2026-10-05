import { request, TransportResponse } from './transport';
import {
  Activity,
  Assignment,
  AuditLog,
  BehaviorCatalog,
  EffectiveParticipant,
  Event,
  Observation,
  Participant,
  User,
} from '../domain/types';
import {
  getCachedActivities,
  getCachedAssignments,
  getCachedBehaviors,
  getCachedEvents,
  getCachedParticipants,
  getClientDB,
  saveCachedData,
} from './offline/db';
import {
  enqueueCoverageMark,
  enqueueObservationCreation,
  updateLocalObservation,
  voidLocalObservation,
} from './offline/outbox';
import { runSync } from './offline/syncEngine';
import { getISOStringWithOffset } from '../domain/dateUtils';
import { isParticipantEffectiveForFacilitator } from '../domain/assignmentResolution';

let currentToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentToken = token;
  if (token) {
    localStorage.setItem('gera_auth_token', token);
  } else {
    localStorage.removeItem('gera_auth_token');
  }
}

export function getStoredAuthToken(): string | null {
  if (!currentToken) {
    currentToken = localStorage.getItem('gera_auth_token');
  }
  return currentToken;
}

// ----------------- Client API Methods -----------------

export const api = {
  async login(mobile_or_username: string, password: string, remember_me: boolean = true) {
    const res = await request('POST', '/auth/login', { mobile_or_username, password, remember_me });
    if (res.ok && res.data) {
      setAuthToken(res.data.token);
      return res.data;
    }
    throw new Error(res.error?.message || 'ورود ناموفق بود.');
  },

  async logout() {
    const token = getStoredAuthToken();
    try {
      if (token) await request('POST', '/auth/logout', {}, token);
    } finally {
      setAuthToken(null);
    }
  },

  async getMe() {
    const token = getStoredAuthToken();
    if (!token) return null;
    const res = await request('GET', '/me', undefined, token);
    if (res.ok && res.data) return res.data.user as User;
    return null;
  },

  async getActiveEvents(): Promise<Event[]> {
    const token = getStoredAuthToken();
    const res = await request<Event[]>('GET', '/events/active', undefined, token || undefined);
    if (res.ok && res.data) {
      await saveCachedData({ events: res.data });
      return res.data;
    }
    // Offline fallback to cached events
    return await getCachedEvents();
  },

  async getBehaviors(): Promise<{ version: number; behaviors: BehaviorCatalog[] }> {
    const token = getStoredAuthToken();
    const res = await request<{ version: number; behaviors: BehaviorCatalog[] }>(
      'GET',
      '/behaviors',
      undefined,
      token || undefined
    );
    if (res.ok && res.data) {
      await saveCachedData({ behaviors: res.data.behaviors });
      return res.data;
    }
    const cached = await getCachedBehaviors();
    return { version: 1, behaviors: cached };
  },

  async getEventAssignments(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request('GET', `/events/${eventId}/assignments`, undefined, token || undefined);
    if (res.ok && res.data) {
      await saveCachedData({
        activities: res.data.activities,
        assignments: res.data.assignments,
        participants: res.data.participants,
      });
      return res.data;
    }
    // Offline fallback
    const activities = await getCachedActivities(eventId);
    const assignments = await getCachedAssignments(eventId);
    const participants = await getCachedParticipants(eventId);
    const events = await getCachedEvents();
    const event = events.find((e) => e.id === eventId);
    return { event, activities, assignments, participants };
  },

  async getActivityParticipants(
    activityId: string,
    currentUserId: string
  ): Promise<EffectiveParticipant[]> {
    const token = getStoredAuthToken();
    const res = await request<EffectiveParticipant[]>(
      'GET',
      `/activities/${activityId}/participants`,
      undefined,
      token || undefined
    );

    let list: EffectiveParticipant[] = [];

    if (res.ok && res.data) {
      list = res.data;
    } else {
      // Offline resolution from client IndexedDB cache
      const db = await getClientDB();
      const allActivities = await getCachedActivities();
      const activity = allActivities.find((a) => a.id === activityId);
      if (!activity) return [];

      const allEvents = await getCachedEvents();
      const event = allEvents.find((e) => e.id === activity.event_id);
      if (!event) return [];

      const allAssignments = await getCachedAssignments(event.id);
      const allParticipants = await getCachedParticipants(event.id);

      const effective = allParticipants.filter((p) =>
        isParticipantEffectiveForFacilitator(currentUserId, p, activity, event, allAssignments)
      );

      const localObs = (await db.getAll('local_observations')) as Observation[];
      const localCov = (await db.getAll('local_coverage_marks')) as any[];

      list = effective.map((p) => {
        const hasObs = localObs.some(
          (o) => o.activity_id === activityId && o.participant_id === p.id && o.status !== 'Voided'
        );
        const hasCov = localCov.some((c) => c.activity_id === activityId && c.participant_id === p.id);

        return {
          ...p,
          has_observation: hasObs || hasCov,
        };
      });
    }

    // Merge with any local pending entries created offline
    const db = await getClientDB();
    const localObs = (await db.getAll('local_observations')) as Observation[];
    const localCov = (await db.getAll('local_coverage_marks')) as any[];

    const observedSet = new Set<string>();
    localObs
      .filter((o) => o.activity_id === activityId && o.status !== 'Voided')
      .forEach((o) => observedSet.add(o.participant_id));
    localCov
      .filter((c) => c.activity_id === activityId)
      .forEach((c) => observedSet.add(c.participant_id));

    return list.map((p) => ({
      ...p,
      has_observation: p.has_observation || observedSet.has(p.id),
    }));
  },

  async recordObservation(params: {
    event_id: string;
    activity_id: string;
    participant_id: string;
    facilitator_id: string;
    behavior_codes: string[];
    note?: string;
  }): Promise<Observation> {
    const offline_uuid = crypto.randomUUID();
    const client_created_at = getISOStringWithOffset();

    const observation: Observation = {
      id: `local-${offline_uuid.substring(0, 8)}`,
      offline_uuid,
      event_id: params.event_id,
      activity_id: params.activity_id,
      participant_id: params.participant_id,
      facilitator_id: params.facilitator_id,
      note: params.note ? params.note.trim() : undefined,
      client_created_at,
      status: 'PendingLocal',
      device_id: 'web-pwa',
      behavior_codes: params.behavior_codes,
    };

    // 1. Write to IndexedDB & Outbox first (Strict Offline First)
    await enqueueObservationCreation(observation);

    // 2. Trigger async background sync immediately
    const token = getStoredAuthToken();
    if (token) {
      runSync(token).catch(console.error);
    }

    return observation;
  },

  async recordNoOpportunity(params: {
    event_id: string;
    activity_id: string;
    participant_id: string;
    facilitator_id: string;
  }): Promise<void> {
    const offline_uuid = crypto.randomUUID();
    const client_created_at = getISOStringWithOffset();

    await enqueueCoverageMark({
      offline_uuid,
      event_id: params.event_id,
      activity_id: params.activity_id,
      participant_id: params.participant_id,
      client_created_at,
    });

    const token = getStoredAuthToken();
    if (token) {
      runSync(token).catch(console.error);
    }
  },

  async editObservation(
    offlineUuid: string,
    updates: { behavior_codes: string[]; note?: string }
  ): Promise<void> {
    await updateLocalObservation(offlineUuid, updates);
    const token = getStoredAuthToken();
    if (token) runSync(token).catch(console.error);
  },

  async voidObservation(offlineUuid: string): Promise<void> {
    await voidLocalObservation(offlineUuid);
    const token = getStoredAuthToken();
    if (token) runSync(token).catch(console.error);
  },

  async getRecentObservations(): Promise<any[]> {
    const token = getStoredAuthToken();
    const db = await getClientDB();
    const localObs = (await db.getAll('local_observations')) as Observation[];

    // Fetch server observations if online
    let serverObs: any[] = [];
    if (token) {
      const res = await request('GET', '/my/recent-observations', undefined, token);
      if (res.ok && res.data) {
        serverObs = res.data;
      }
    }

    // Merge: local pending observations take precedence if matching offline_uuid
    const map = new Map<string, any>();
    for (const item of serverObs) {
      map.set(item.offline_uuid, item);
    }

    const allBehaviors = await getCachedBehaviors();
    const bMap = new Map(allBehaviors.map((b) => [b.code, b]));
    const allParticipants = await getCachedParticipants();
    const pMap = new Map(allParticipants.map((p) => [p.id, p]));
    const allActivities = await getCachedActivities();
    const aMap = new Map(allActivities.map((a) => [a.id, a]));

    for (const item of localObs) {
      const existing = map.get(item.offline_uuid);
      if (!existing || item.status === 'PendingLocal') {
        const p = pMap.get(item.participant_id);
        const a = aMap.get(item.activity_id);
        map.set(item.offline_uuid, {
          ...item,
          participant_name: p?.full_name || 'نامشخص',
          participant_code: p?.participant_code || '',
          activity_title: a?.title || 'نامشخص',
          activity_status: a?.status || 'Draft',
          behaviors: item.behavior_codes.map((c) => ({
            code: c,
            label: bMap.get(c)?.label_fa || c,
            polarity: bMap.get(c)?.polarity || 'positive',
          })),
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => new Date(b.client_created_at).getTime() - new Date(a.client_created_at).getTime())
      .slice(0, 20);
  },

  async getOnboardingStatus(eventId: string): Promise<boolean> {
    const token = getStoredAuthToken();
    if (!token) return true;
    const res = await request<{ acked: boolean }>(
      'GET',
      `/onboarding/status/${eventId}`,
      undefined,
      token
    );
    if (res.ok && res.data) return res.data.acked;
    return false;
  },

  async ackOnboarding(eventId: string): Promise<void> {
    const token = getStoredAuthToken();
    if (token) {
      await request('POST', '/onboarding/ack', { event_id: eventId }, token);
    }
  },
};

// ----------------- Admin API Methods -----------------

export const adminApi = {
  async getEvents(): Promise<Event[]> {
    const token = getStoredAuthToken();
    const res = await request<Event[]>('GET', '/admin/events', undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بارگذاری دوره‌ها.');
  },

  async createEvent(data: { title: string; event_date: string; location?: string; description?: string }) {
    const token = getStoredAuthToken();
    const res = await request<Event>('POST', '/admin/events', data, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در ایجاد دوره.');
  },

  async copyEvent(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request<Event>('POST', `/admin/events/${eventId}/copy`, {}, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در کپی دوره.');
  },

  async updateEventStatus(eventId: string, status: string) {
    const token = getStoredAuthToken();
    const res = await request<Event>('PATCH', `/admin/events/${eventId}/status`, { status }, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در تغییر وضعیت دوره.');
  },

  async checkUnassigned(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request('GET', `/admin/events/${eventId}/unassigned-check`, undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بررسی پوشش تخصیص.');
  },

  async getParticipants(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request('GET', `/admin/events/${eventId}/participants`, undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در دریافت شرکت‌کنندگان.');
  },

  async createParticipant(eventId: string, data: any) {
    const token = getStoredAuthToken();
    const res = await request('POST', `/admin/events/${eventId}/participants`, data, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در افزودن شرکت‌کننده.');
  },

  async updateParticipant(participantId: string, data: any) {
    const token = getStoredAuthToken();
    const res = await request('PATCH', `/admin/participants/${participantId}`, data, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در ویرایش شرکت‌کننده.');
  },

  async importParticipants(eventId: string, rows: any[]) {
    const token = getStoredAuthToken();
    const res = await request('POST', `/admin/events/${eventId}/participants/import`, { rows }, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در وارد کردن شرکت‌کنندگان.');
  },

  async getActivities(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request<Activity[]>('GET', `/admin/events/${eventId}/activities`, undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بارگذاری فعالیت‌ها.');
  },

  async createActivity(eventId: string, data: { title: string; order_no?: number }) {
    const token = getStoredAuthToken();
    const res = await request<Activity>('POST', `/admin/events/${eventId}/activities`, data, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در ساخت فعالیت.');
  },

  async updateActivityStatus(activityId: string, status: string) {
    const token = getStoredAuthToken();
    const res = await request<Activity>('PATCH', `/admin/activities/${activityId}/status`, { status }, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در تغییر وضعیت فعالیت.');
  },

  async getUsers() {
    const token = getStoredAuthToken();
    const res = await request<User[]>('GET', '/admin/users', undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بارگذاری کاربران.');
  },

  async createUser(data: any) {
    const token = getStoredAuthToken();
    const res = await request('POST', '/admin/users', data, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در ساخت کاربر.');
  },

  async resetPassword(userId: string) {
    const token = getStoredAuthToken();
    const res = await request<{ success: boolean; temp_password: string }>(
      'POST',
      `/admin/users/${userId}/reset-password`,
      {},
      token || undefined
    );
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بازنشانی رمز عبور.');
  },

  async revokeSessions(userId: string) {
    const token = getStoredAuthToken();
    const res = await request('POST', `/admin/users/${userId}/revoke-sessions`, {}, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در ابطال نشست‌ها.');
  },

  async getAssignments(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request<Assignment[]>('GET', `/admin/events/${eventId}/assignments`, undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بارگذاری تخصیص‌ها.');
  },

  async createAssignment(eventId: string, data: any) {
    const token = getStoredAuthToken();
    const res = await request('POST', `/admin/events/${eventId}/assignments`, data, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در ثبت تخصیص.');
  },

  async revokeAssignment(assignmentId: string) {
    const token = getStoredAuthToken();
    const res = await request('POST', `/admin/assignments/${assignmentId}/revoke`, {}, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در ابطال تخصیص.');
  },

  async rotateAssignments(eventId: string, from_activity_id: string, to_activity_id: string, commit: boolean) {
    const token = getStoredAuthToken();
    const res = await request(
      'POST',
      `/admin/events/${eventId}/rotate-assignments`,
      { from_activity_id, to_activity_id, commit },
      token || undefined
    );
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در چرخش تخصیص‌ها.');
  },

  async getLiveCoverage(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request('GET', `/admin/events/${eventId}/live-coverage`, undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در دریافت وضعیت پوشش زنده.');
  },

  async getCoverageReport(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request('GET', `/admin/events/${eventId}/coverage-report`, undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در دریافت گزارش پوشش.');
  },

  async exportLongCsv(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request<{ csv: string; filename: string }>(
      'GET',
      `/admin/events/${eventId}/export/long-csv`,
      undefined,
      token || undefined
    );
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در دریافت فایل Long CSV.');
  },

  async exportCoverageCsv(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request<{ csv: string; filename: string }>(
      'GET',
      `/admin/events/${eventId}/export/coverage-csv`,
      undefined,
      token || undefined
    );
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در دریافت فایل Coverage CSV.');
  },

  async exportAnalysisBundle(eventId: string) {
    const token = getStoredAuthToken();
    const res = await request<{ bundle: any; filename: string }>(
      'GET',
      `/admin/events/${eventId}/export/analysis-bundle`,
      undefined,
      token || undefined
    );
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در دریافت بسته تحلیلی JSON.');
  },

  async getAuditLogs() {
    const token = getStoredAuthToken();
    const res = await request<AuditLog[]>('GET', '/admin/audit-logs', undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بارگذاری گزارش لاگ‌ها.');
  },

  async getBehaviors() {
    const token = getStoredAuthToken();
    const res = await request<BehaviorCatalog[]>('GET', '/admin/behaviors', undefined, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بارگذاری کتابخانه رفتارها.');
  },

  async updateBehavior(behaviorId: string, data: { label_fa?: string; guide_fa?: string }) {
    const token = getStoredAuthToken();
    const res = await request<BehaviorCatalog>(
      'PATCH',
      `/admin/behaviors/${behaviorId}`,
      data,
      token || undefined
    );
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در ویرایش رفتار.');
  },

  async seed500Observations() {
    const token = getStoredAuthToken();
    const res = await request('POST', '/dev/seed-500-observations', {}, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در تولید ۵۰۰ مشاهده نمونه.');
  },

  async resetDatabase() {
    const token = getStoredAuthToken();
    const res = await request('POST', '/dev/reset-database', {}, token || undefined);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'خطا در بازنشانی پایگاه داده.');
  },
};
