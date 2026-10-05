import type {
  Activity,
  Assignment,
  AuditLog,
  BehaviorCatalog,
  CoverageMark,
  Event,
  EventMember,
  Group,
  Observation,
  OnboardingAck,
  Participant,
  Session,
  SyncBatchResponse,
  User,
} from '../src/domain/types.js';
import { getISOStringWithOffset } from '../src/domain/dateUtils.js';
import { isParticipantEffectiveForFacilitator } from '../src/domain/assignmentResolution.js';
import { CONFIG } from '../src/domain/config.js';
import { type Store, getStore } from './store.js';
import { hashPassword, hashToken, newSessionToken, randomTempPassword, verifyPassword } from './security.js';
import { seedDemo } from './bootstrap.js';

const LOGIN_LOCK_MS = 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const devToolsEnabled = () => process.env.ENABLE_DEV_TOOLS === 'true';

// ---------------- Helper to create Audit Log ----------------
async function recordAuditLog(
  db: Store,
  actor: User,
  action: string,
  entityType: string,
  entityId: string,
  before?: any,
  after?: any
) {
  const audit: AuditLog = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    actor_id: actor.id,
    actor_name: actor.full_name,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_json: before ? JSON.stringify(before) : undefined,
    after_json: after ? JSON.stringify(after) : undefined,
    created_at: getISOStringWithOffset(),
  };
  await db.put('audit_logs', audit);
}

// ---------------- Helper to authenticate from session token ----------------
export async function authenticateToken(token?: string): Promise<{ user: User; session: Session } | null> {
  if (!token) return null;
  const db = getStore();
  const tokenHash = hashToken(token);
  const session = (await db.get<Session>('sessions', tokenHash)) as Session | undefined;
  if (!session) return null;

  if (Date.now() > session.expires_at) {
    await db.delete('sessions', tokenHash);
    return null;
  }

  const user = (await db.get<User>('users', session.user_id)) as User | undefined;
  if (!user || user.status === 'Inactive') return null;

  // Touch last active in a side document (at most once a minute) so it can never overwrite a concurrent user edit
  const lastKey = `last_active:${user.id}`;
  const lastDoc = (await db.get<any>('meta', lastKey)) as { at?: string } | undefined;
  if (!lastDoc?.at || Date.now() - new Date(lastDoc.at).getTime() > 60 * 1000) {
    user.last_active_at = getISOStringWithOffset();
    await db.put('meta', { key: lastKey, at: user.last_active_at });
  } else {
    user.last_active_at = lastDoc.at;
  }

  return { user, session };
}

// Helper to verify event membership for EVENT_ADMIN
async function checkEventAdminAccess(db: Store, user: User, eventId: string): Promise<boolean> {
  if (user.role === 'SYSTEM_ADMIN') return true;
  if (user.role !== 'EVENT_ADMIN') return false;

  const event = (await db.get('events', eventId)) as Event | undefined;
  if (!event) return false;
  if (event.created_by === user.id) return true;

  const allMembers = (await db.getAll('event_members')) as EventMember[];
  return allMembers.some((m) => m.event_id === eventId && m.user_id === user.id && m.role === 'EVENT_ADMIN');
}

// ---------------- Route Handlers ----------------

let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password'));

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function handleRequest(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<any> {
  const db = getStore();
  const cleanPath = path.split('?')[0];

  // 1. POST /auth/login
  if (method === 'POST' && cleanPath === '/auth/login') {
    const { mobile_or_username, password, remember_me } = body || {};
    if (!mobile_or_username || !password) {
      throw new ApiError(400, 'VALIDATION', 'نام کاربری و رمز عبور الزامی است.');
    }

    // Rate limiting: failed attempts per username within the last minute (persisted: serverless has no shared memory)
    const now = Date.now();
    const loginKey = String(mobile_or_username).trim().toLowerCase().slice(0, 120);
    const attemptKey = `login_attempts:${loginKey}`;
    const attemptDoc = (await db.get<any>('meta', attemptKey)) as { attempts?: number[] } | undefined;
    const recentAttempts = (attemptDoc?.attempts || []).filter((t) => now - t < LOGIN_LOCK_MS);
    if (recentAttempts.length >= CONFIG.MAX_LOGIN_FAILURES_PER_MINUTE) {
      throw new ApiError(429, 'RATE_LIMITED', 'تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً یک دقیقه صبر کنید.');
    }

    const found = await db.find<User>('users', 'mobile_or_username', [String(mobile_or_username).trim()]);
    const user = found[0];
    // Always run one scrypt verification so unknown usernames cost the same as wrong passwords
    const passwordOk = await verifyPassword(String(password), user?.password_hash || (await getDummyHash()));

    if (!user || !passwordOk || user.status === 'Inactive') {
      recentAttempts.push(now);
      await db.put('meta', { key: attemptKey, attempts: recentAttempts });
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور اشتباه است.');
    }

    // Clear failed attempts
    if (attemptDoc) await db.delete('meta', attemptKey);

    // Create session (only the token hash is stored)
    const { token: sessionToken, tokenHash } = newSessionToken();
    const expiresAt = now + (remember_me ? CONFIG.SESSION_DURATION_MS : 4 * 60 * 60 * 1000);
    const session: Session = {
      token: tokenHash,
      user_id: user.id,
      expires_at: expiresAt,
      remember_me: !!remember_me,
    };
    await db.put('sessions', session);

    // Audit managerial logins
    if (user.role === 'SYSTEM_ADMIN' || user.role === 'EVENT_ADMIN') {
      await recordAuditLog(db, user, 'LOGIN', 'User', user.id, undefined, { role: user.role, time: getISOStringWithOffset() });
    }

    return {
      token: sessionToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        mobile_or_username: user.mobile_or_username,
        role: user.role,
        status: user.status,
      },
      expires_at: expiresAt,
    };
  }

  // Auth requirement for all remaining endpoints
  const auth = await authenticateToken(token);
  if (!auth) {
    throw new ApiError(401, 'UNAUTHORIZED', 'نشست کاربری نامعتبر است یا منقضی شده است.');
  }
  const { user } = auth;

  // 2. POST /auth/logout
  if (method === 'POST' && cleanPath === '/auth/logout') {
    if (token) await db.delete('sessions', hashToken(token));
    return { success: true };
  }

  // 3. GET /me
  if (method === 'GET' && cleanPath === '/me') {
    return {
      user: {
        id: user.id,
        full_name: user.full_name,
        mobile_or_username: user.mobile_or_username,
        role: user.role,
        status: user.status,
      },
    };
  }

  // 4. GET /events/active (Events accessible to this user)
  if (method === 'GET' && cleanPath === '/events/active') {
    const allEvents = (await db.getAll('events')) as Event[];
    const activeEvents = allEvents.filter((e) => e.status === 'Active');

    if (user.role === 'SYSTEM_ADMIN') {
      return activeEvents;
    }

    const allMembers = (await db.getAll('event_members')) as EventMember[];
    const myEventIds = new Set(allMembers.filter((m) => m.user_id === user.id).map((m) => m.event_id));

    // Also include if user has assignments
    const allAssignments = (await db.getAll('assignments')) as Assignment[];
    allAssignments.filter((a) => a.facilitator_id === user.id && a.status === 'Active').forEach((a) => myEventIds.add(a.event_id));

    return activeEvents.filter((e) => myEventIds.has(e.id));
  }

  // 5. GET /behaviors (Active behavior catalog + version)
  if (method === 'GET' && cleanPath === '/behaviors') {
    const allBehaviors = (await db.getAll('behaviors')) as BehaviorCatalog[];
    const activeBehaviors = allBehaviors
      .filter((b) => b.active)
      .sort((a, b) => a.display_order - b.display_order)
      .map((b) => ({
        id: b.id,
        code: b.code,
        label_fa: b.label_fa,
        polarity: b.polarity,
        version: b.version,
        // Notice: guide_fa is omitted for facilitators! (Strict non-leakage rule)
      }));

    return {
      version: CONFIG.CATALOG_VERSION,
      behaviors: activeBehaviors,
    };
  }

  // 6. GET /events/:id/assignments
  const eventAssignmentsMatch = cleanPath.match(/^\/events\/([^\/]+)\/assignments$/);
  if (method === 'GET' && eventAssignmentsMatch) {
    const eventId = eventAssignmentsMatch[1];
    const event = (await db.get('events', eventId)) as Event | undefined;
    if (!event) throw new ApiError(404, 'NOT_FOUND', 'دوره یافت نشد.');

    // Fetch activities of this event
    const allActivities = (await db.getAll('activities')) as Activity[];
    const activities = allActivities.filter((a) => a.event_id === eventId).sort((a, b) => a.order_no - b.order_no);

    // Fetch effective assignments for this facilitator
    const allAssignments = (await db.getAll('assignments')) as Assignment[];
    const allParticipants = (await db.getAll('participants')) as Participant[];
    const eventParticipants = allParticipants.filter((p) => p.event_id === eventId && p.status === 'Active');

    return {
      event,
      activities,
      assignments: allAssignments.filter((a) => a.event_id === eventId && a.facilitator_id === user.id),
      participants: eventParticipants,
    };
  }

  // 7. GET /activities/:id/participants (Strict effective participants for facilitator)
  const actParticipantsMatch = cleanPath.match(/^\/activities\/([^\/]+)\/participants$/);
  if (method === 'GET' && actParticipantsMatch) {
    const activityId = actParticipantsMatch[1];
    const activity = (await db.get('activities', activityId)) as Activity | undefined;
    if (!activity) throw new ApiError(404, 'NOT_FOUND', 'فعالیت یافت نشد.');

    const event = (await db.get('events', activity.event_id)) as Event | undefined;
    if (!event) throw new ApiError(404, 'NOT_FOUND', 'دوره مرتبط یافت نشد.');

    const allAssignments = (await db.getAll('assignments')) as Assignment[];
    const allParticipants = (await db.getAll('participants')) as Participant[];
    const allGroups = (await db.getAll('groups')) as Group[];
    const groupMap = new Map(allGroups.map((g) => [g.id, g]));

    // Check effective participants
    const effectiveList = allParticipants.filter((p) =>
      isParticipantEffectiveForFacilitator(user.id, p, activity, event, allAssignments)
    );

    // Check if each has any observation (positive/warning distinction is strictly hidden!)
    const allObservations = await db.find<Observation>('observations', 'event_id', [activity.event_id]);
    const allCoverageMarks = await db.find<CoverageMark>('coverage_marks', 'event_id', [activity.event_id]);

    const effectiveResult = effectiveList.map((p) => {
      const grp = groupMap.get(p.group_id);
      const hasObs = allObservations.some(
        (o) => o.activity_id === activityId && o.participant_id === p.id && o.status !== 'Voided'
      );
      const hasCov = allCoverageMarks.some(
        (c) => c.activity_id === activityId && c.participant_id === p.id
      );

      return {
        ...p,
        group_code: grp?.code || '',
        group_title: grp?.title || '',
        has_observation: hasObs || hasCov, // Neutral: has at least one entry or no-opportunity
      };
    });

    return effectiveResult;
  }

  // 8. POST /observations/batch (Idempotent submission with offline rule support)
  if (method === 'POST' && cleanPath === '/observations/batch') {
    const { observations } = body || {};
    if (!Array.isArray(observations)) {
      throw new ApiError(400, 'VALIDATION', 'فهرست مشاهدات نامعتبر است.');
    }

    const allEvents = (await db.getAll('events')) as Event[];
    const eventMap = new Map(allEvents.map((e) => [e.id, e]));

    const allActivities = (await db.getAll('activities')) as Activity[];
    const activityMap = new Map(allActivities.map((a) => [a.id, a]));

    const allParticipants = (await db.getAll('participants')) as Participant[];
    const participantMap = new Map(allParticipants.map((p) => [p.id, p]));

    const allAssignments = (await db.getAll('assignments')) as Assignment[];
    const allBehaviors = (await db.getAll('behaviors')) as BehaviorCatalog[];
    const activeBehaviorCodes = new Set(allBehaviors.filter((b) => b.active).map((b) => b.code));

    const existingByUuid = new Map(
      (
        await db.find<Observation>(
          'observations',
          'offline_uuid',
          observations.map((o: any) => String(o?.offline_uuid || '')).filter(Boolean)
        )
      ).map((o) => [o.offline_uuid, o])
    );

    const results: any[] = [];

    for (const item of observations) {
      const {
        offline_uuid,
        event_id,
        activity_id,
        participant_id,
        client_created_at,
        behavior_codes,
        note,
        device_id,
      } = item;

      if (!offline_uuid) {
        results.push({ offline_uuid: '', status: 'error', code: 'VALIDATION', message: 'شناسه آفلاین الزامی است.' });
        continue;
      }

      // Check idempotency
      const existing = existingByUuid.get(offline_uuid);
      if (existing) {
        results.push({
          observation_id: existing.id,
          offline_uuid: existing.offline_uuid,
          status: 'synced',
          server_created_at: existing.server_created_at,
        });
        continue;
      }

      // Validation
      const event = eventMap.get(event_id);
      if (!event || event.status !== 'Active') {
        results.push({ offline_uuid, status: 'error', code: 'EVENT_NOT_ACTIVE', message: 'دوره فعال نیست.' });
        continue;
      }

      const activity = activityMap.get(activity_id);
      if (!activity) {
        results.push({ offline_uuid, status: 'error', code: 'NOT_FOUND', message: 'فعالیت یافت نشد.' });
        continue;
      }

      // OFFLINE RULE FOR CLOSED ACTIVITIES
      if (activity.status === 'Closed') {
        const clientTime = new Date(client_created_at).getTime();
        const closedTime = activity.closed_at ? new Date(activity.closed_at).getTime() : 0;
        if (!activity.closed_at || clientTime >= closedTime) {
          results.push({
            offline_uuid,
            status: 'error',
            code: 'ACTIVITY_CLOSED',
            message: 'این فعالیت بسته شده و ثبت جدید امکان‌پذیر نیست.',
          });
          continue;
        }
      } else if (activity.status !== 'Open') {
        results.push({
          offline_uuid,
          status: 'error',
          code: 'ACTIVITY_NOT_OPEN',
          message: 'فعالیت برای ثبت باز نیست.',
        });
        continue;
      }

      const participant = participantMap.get(participant_id);
      if (!participant || participant.status === 'Inactive') {
        results.push({ offline_uuid, status: 'error', code: 'VALIDATION', message: 'شرکت‌کننده نامعتبر است.' });
        continue;
      }

      // Strict Assignment check
      const isAuthorized = isParticipantEffectiveForFacilitator(
        user.id,
        participant,
        activity,
        event,
        allAssignments,
        { allowClosedActivity: true }
      );
      if (!isAuthorized) {
        results.push({
          offline_uuid,
          status: 'error',
          code: 'FORBIDDEN',
          message: 'به این فرد یا فعالیت دسترسی ندارید.',
        });
        continue;
      }

      // Validate behaviors
      if (!Array.isArray(behavior_codes) || behavior_codes.length === 0) {
        results.push({ offline_uuid, status: 'error', code: 'VALIDATION', message: 'حداقل یک رفتار باید انتخاب شود.' });
        continue;
      }
      const invalidCodes = behavior_codes.filter((c) => !activeBehaviorCodes.has(c));
      if (invalidCodes.length > 0) {
        results.push({ offline_uuid, status: 'error', code: 'VALIDATION', message: 'کد رفتار نامعتبر است.' });
        continue;
      }

      if (note && note.length > CONFIG.MAX_NOTE_LENGTH) {
        results.push({ offline_uuid, status: 'error', code: 'VALIDATION', message: 'یادداشت حداکثر ۱۶۰ نویسه است.' });
        continue;
      }

      const serverCreatedAt = getISOStringWithOffset();
      const newObs: Observation = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        offline_uuid,
        event_id,
        activity_id,
        participant_id,
        facilitator_id: user.id,
        note: note ? note.trim() : undefined,
        client_created_at,
        server_created_at: serverCreatedAt,
        status: 'Synced',
        device_id: device_id || 'unknown',
        behavior_codes,
      };

      if (!(await db.insertIfAbsent('observations', newObs))) {
        // A concurrent request stored the same offline_uuid first: report the stored record (idempotent)
        const stored = (await db.find<Observation>('observations', 'offline_uuid', [offline_uuid]))[0];
        results.push({
          observation_id: stored?.id,
          offline_uuid,
          status: 'synced',
          server_created_at: stored?.server_created_at,
        });
        continue;
      }
      existingByUuid.set(offline_uuid, newObs);

      results.push({
        observation_id: newObs.id,
        offline_uuid: newObs.offline_uuid,
        status: 'synced',
        server_created_at: serverCreatedAt,
      });
    }

    const response: SyncBatchResponse = { results };
    return response;
  }

  // 9. PATCH /observations/:id (Edit observation)
  const patchObsMatch = cleanPath.match(/^\/observations\/([^\/]+)$/);
  if (method === 'PATCH' && patchObsMatch) {
    const obsId = patchObsMatch[1];
    const obs = (await db.get('observations', obsId)) as Observation | undefined;
    if (!obs) throw new ApiError(404, 'NOT_FOUND', 'مشاهده یافت نشد.');

    if (obs.facilitator_id !== user.id && user.role !== 'SYSTEM_ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'فقط ثبت‌کننده می‌تواند این مشاهده را اصلاح کند.');
    }

    const activity = (await db.get('activities', obs.activity_id)) as Activity | undefined;
    if (!activity || activity.status !== 'Open') {
      throw new ApiError(400, 'ACTIVITY_CLOSED', 'امکان ویرایش پس از بسته شدن فعالیت وجود ندارد.');
    }

    const { behavior_codes, note } = body || {};
    if (!Array.isArray(behavior_codes) || behavior_codes.length === 0) {
      throw new ApiError(400, 'VALIDATION', 'حداقل یک رفتار باید انتخاب شود.');
    }
    if (note && note.length > CONFIG.MAX_NOTE_LENGTH) {
      throw new ApiError(400, 'VALIDATION', 'یادداشت حداکثر ۱۶۰ نویسه است.');
    }

    const before = { ...obs };
    obs.behavior_codes = behavior_codes;
    obs.note = note ? note.trim() : undefined;
    obs.status = 'Corrected';

    await db.put('observations', obs);
    await recordAuditLog(db, user, 'UPDATE_OBSERVATION', 'Observation', obs.id, before, obs);

    return obs;
  }

  // 10. POST /observations/:id/void
  const voidObsMatch = cleanPath.match(/^\/observations\/([^\/]+)\/void$/);
  if (method === 'POST' && voidObsMatch) {
    const obsId = voidObsMatch[1];
    const obs = (await db.get('observations', obsId)) as Observation | undefined;
    if (!obs) throw new ApiError(404, 'NOT_FOUND', 'مشاهده یافت نشد.');

    if (obs.facilitator_id !== user.id && user.role !== 'SYSTEM_ADMIN' && user.role !== 'EVENT_ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'فقط ثبت‌کننده می‌تواند این مشاهده را ابطال کند.');
    }

    const activity = (await db.get('activities', obs.activity_id)) as Activity | undefined;
    if (user.role === 'FACILITATOR' && (!activity || activity.status !== 'Open')) {
      throw new ApiError(400, 'ACTIVITY_CLOSED', 'امکان ابطال پس از بسته شدن فعالیت وجود ندارد.');
    }

    const before = { ...obs };
    obs.status = 'Voided';

    await db.put('observations', obs);
    await recordAuditLog(db, user, 'VOID_OBSERVATION', 'Observation', obs.id, before, obs);

    return { success: true, observation: obs };
  }

  // 11. POST /coverage/no-opportunity (Idempotent coverage mark)
  if (method === 'POST' && cleanPath === '/coverage/no-opportunity') {
    const { offline_uuid, event_id, activity_id, participant_id, client_created_at } = body || {};
    if (!offline_uuid || !event_id || !activity_id || !participant_id) {
      throw new ApiError(400, 'VALIDATION', 'اطلاعات علامت عدم فرصت ناقص است.');
    }

    const existing = (await db.find<CoverageMark>('coverage_marks', 'offline_uuid', [String(offline_uuid)]))[0];
    if (existing) {
      return { id: existing.id, offline_uuid: existing.offline_uuid, status: 'synced' };
    }

    const event = (await db.get('events', event_id)) as Event | undefined;
    const activity = (await db.get('activities', activity_id)) as Activity | undefined;
    const participant = (await db.get('participants', participant_id)) as Participant | undefined;
    const allAssignments = (await db.getAll('assignments')) as Assignment[];

    if (!event || !activity || !participant) {
      throw new ApiError(404, 'NOT_FOUND', 'داده‌های مرتبط یافت نشدند.');
    }

    const isAuthorized = isParticipantEffectiveForFacilitator(user.id, participant, activity, event, allAssignments);
    if (!isAuthorized) {
      throw new ApiError(403, 'FORBIDDEN', 'به این فرد یا فعالیت دسترسی ندارید.');
    }

    const newMark: CoverageMark = {
      id: `cov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      offline_uuid,
      event_id,
      activity_id,
      participant_id,
      facilitator_id: user.id,
      type: 'NO_OPPORTUNITY',
      client_created_at: client_created_at || getISOStringWithOffset(),
      created_at: getISOStringWithOffset(),
    };

    if (!(await db.insertIfAbsent('coverage_marks', newMark))) {
      const stored = (await db.find<CoverageMark>('coverage_marks', 'offline_uuid', [String(offline_uuid)]))[0];
      return { id: stored?.id, offline_uuid, status: 'synced' };
    }
    return { id: newMark.id, offline_uuid: newMark.offline_uuid, status: 'synced' };
  }

  // 12. POST /onboarding/ack
  if (method === 'POST' && cleanPath === '/onboarding/ack') {
    const { event_id } = body || {};
    if (!event_id) throw new ApiError(400, 'VALIDATION', 'شناسه دوره الزامی است.');

    const ack: OnboardingAck = {
      user_id: user.id,
      event_id,
      acked_at: getISOStringWithOffset(),
    };
    await db.put('onboarding_acks', ack);
    return { success: true, ack };
  }

  // 13. GET /onboarding/status/:eventId
  const onboardingStatusMatch = cleanPath.match(/^\/onboarding\/status\/([^\/]+)$/);
  if (method === 'GET' && onboardingStatusMatch) {
    const eventId = onboardingStatusMatch[1];
    const ack = (await db.get('onboarding_acks', [user.id, eventId])) as OnboardingAck | undefined;
    return { acked: !!ack, acked_at: ack?.acked_at };
  }

  // 14. GET /my/recent-observations (Up to 20 recent observations of the current user)
  if (method === 'GET' && cleanPath === '/my/recent-observations') {
    const myObs = (await db.find<Observation>('observations', 'facilitator_id', [user.id]))
      .sort((a, b) => new Date(b.client_created_at).getTime() - new Date(a.client_created_at).getTime())
      .slice(0, 20);

    const allParticipants = (await db.getAll('participants')) as Participant[];
    const pMap = new Map(allParticipants.map((p) => [p.id, p]));

    const allActivities = (await db.getAll('activities')) as Activity[];
    const aMap = new Map(allActivities.map((a) => [a.id, a]));

    const allBehaviors = (await db.getAll('behaviors')) as BehaviorCatalog[];
    const bMap = new Map(allBehaviors.map((b) => [b.code, b]));

    return myObs.map((o) => {
      const p = pMap.get(o.participant_id);
      const a = aMap.get(o.activity_id);
      const behaviors = o.behavior_codes.map((c) => ({
        code: c,
        label: bMap.get(c)?.label_fa || c,
        polarity: bMap.get(c)?.polarity || 'positive',
      }));

      return {
        ...o,
        participant_name: p?.full_name || 'نامشخص',
        participant_code: p?.participant_code || '',
        activity_title: a?.title || 'نامشخص',
        activity_status: a?.status || 'Draft',
        behaviors,
      };
    });
  }

  // =========================================================================
  // ADMIN ENDPOINTS (Strictly forbidden for FACILITATOR)
  // =========================================================================
  if (cleanPath.startsWith('/admin/')) {
    if (user.role === 'FACILITATOR') {
      throw new ApiError(403, 'FORBIDDEN', 'شما به بخش مدیریت دسترسی ندارید.');
    }

    // ---------------- System Admin behaviors catalog management ----------------
    if (cleanPath === '/admin/behaviors' && method === 'GET') {
      const allBehaviors = (await db.getAll('behaviors')) as BehaviorCatalog[];
      return allBehaviors.sort((a, b) => a.display_order - b.display_order);
    }

    // Edit behavior text -> increments catalog version, keeps code unchanged
    const editBehaviorMatch = cleanPath.match(/^\/admin\/behaviors\/([^\/]+)$/);
    if (method === 'PATCH' && editBehaviorMatch) {
      if (user.role !== 'SYSTEM_ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'فقط مدیر سیستم می‌تواند کاتالوگ را تغییر دهد.');
      }
      const behaviorId = editBehaviorMatch[1];
      const behavior = (await db.get('behaviors', behaviorId)) as BehaviorCatalog | undefined;
      if (!behavior) throw new ApiError(404, 'NOT_FOUND', 'رفتار یافت نشد.');

      const { label_fa, guide_fa } = body || {};
      const before = { ...behavior };
      if (label_fa) behavior.label_fa = label_fa;
      if (guide_fa !== undefined) behavior.guide_fa = guide_fa;
      behavior.version += 1;

      await db.put('behaviors', behavior);
      await recordAuditLog(db, user, 'UPDATE_BEHAVIOR_CATALOG', 'BehaviorCatalog', behavior.id, before, behavior);
      return behavior;
    }

    // ---------------- User Management ----------------
    if (cleanPath === '/admin/users' && method === 'GET') {
      const allUsers = (await db.getAll('users')) as User[];
      const activity = new Map(
        ((await db.getAll('meta')) as any[]).filter((m) => String(m.key).startsWith('last_active:')).map((m) => [String(m.key).slice(12), m.at])
      );
      return allUsers.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        mobile_or_username: u.mobile_or_username,
        role: u.role,
        status: u.status,
        last_active_at: activity.get(u.id) || u.last_active_at,
      }));
    }

    if (cleanPath === '/admin/users' && method === 'POST') {
      if (user.role !== 'SYSTEM_ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'فقط مدیر سیستم می‌تواند کاربر بسازد.');
      }
      const { full_name, mobile_or_username, password, role } = body || {};
      if (!full_name || !mobile_or_username || !password || !role) {
        throw new ApiError(400, 'VALIDATION', 'اطلاعات کاربر ناقص است.');
      }

      if (!['SYSTEM_ADMIN', 'EVENT_ADMIN', 'FACILITATOR'].includes(role)) {
        throw new ApiError(400, 'VALIDATION', 'نقش کاربر نامعتبر است.');
      }
      if (String(password).length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(400, 'VALIDATION', `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} نویسه باشد.`);
      }
      if ((await db.find<User>('users', 'mobile_or_username', [String(mobile_or_username).trim()])).length > 0) {
        throw new ApiError(400, 'VALIDATION', 'این نام کاربری از قبل وجود دارد.');
      }

      const newUser: User = {
        id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        full_name,
        mobile_or_username: String(mobile_or_username).trim(),
        password_hash: await hashPassword(String(password)),
        role,
        status: 'Active',
      };
      await db.put('users', newUser);
      await recordAuditLog(db, user, 'CREATE_USER', 'User', newUser.id, undefined, {
        id: newUser.id,
        full_name,
        role,
      });

      return {
        id: newUser.id,
        full_name: newUser.full_name,
        mobile_or_username: newUser.mobile_or_username,
        role: newUser.role,
        status: newUser.status,
      };
    }

    // Reset password
    const resetPwMatch = cleanPath.match(/^\/admin\/users\/([^\/]+)\/reset-password$/);
    if (method === 'POST' && resetPwMatch) {
      if (user.role !== 'SYSTEM_ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'فقط مدیر سیستم مجاز به تغییر رمز است.');
      }
      const targetUserId = resetPwMatch[1];
      const targetUser = (await db.get('users', targetUserId)) as User | undefined;
      if (!targetUser) throw new ApiError(404, 'NOT_FOUND', 'کاربر یافت نشد.');

      // The temporary password is shown to the admin once and never stored in clear text
      const tempPassword = randomTempPassword();
      targetUser.password_hash = await hashPassword(tempPassword);
      await db.put('users', targetUser);

      // Invalidate existing sessions of this user
      for (const s of await db.find<Session>('sessions', 'user_id', [targetUserId])) {
        await db.delete('sessions', s.token);
      }

      await recordAuditLog(db, user, 'RESET_PASSWORD', 'User', targetUserId);
      return { success: true, temp_password: tempPassword };
    }

    // Revoke user sessions
    const revokeSessionsMatch = cleanPath.match(/^\/admin\/users\/([^\/]+)\/revoke-sessions$/);
    if (method === 'POST' && revokeSessionsMatch) {
      if (user.role !== 'SYSTEM_ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'فقط مدیر سیستم مجاز به ابطال نشست است.');
      }
      const targetUserId = revokeSessionsMatch[1];
      for (const s of await db.find<Session>('sessions', 'user_id', [targetUserId])) {
        await db.delete('sessions', s.token);
      }
      await recordAuditLog(db, user, 'REVOKE_SESSIONS', 'User', targetUserId);
      return { success: true };
    }

    // ---------------- Event Management ----------------
    if (cleanPath === '/admin/events' && method === 'GET') {
      const allEvents = (await db.getAll('events')) as Event[];
      if (user.role === 'SYSTEM_ADMIN') return allEvents;

      const allMembers = (await db.getAll('event_members')) as EventMember[];
      const myIds = new Set(allMembers.filter((m) => m.user_id === user.id).map((m) => m.event_id));
      return allEvents.filter((e) => e.created_by === user.id || myIds.has(e.id));
    }

    if (cleanPath === '/admin/events' && method === 'POST') {
      const { title, event_date, location, description } = body || {};
      if (!title) throw new ApiError(400, 'VALIDATION', 'عنوان دوره الزامی است.');

      const newEvent: Event = {
        id: `EVT-${Date.now()}`,
        title,
        event_date: event_date || getISOStringWithOffset().split('T')[0],
        location: location || '',
        description: description || '',
        status: 'Draft',
        created_by: user.id,
      };

      await db.put('events', newEvent);

      // Add user as member
      await db.put('event_members', {
        id: `em-${Date.now()}`,
        event_id: newEvent.id,
        user_id: user.id,
        role: user.role,
      });

      await recordAuditLog(db, user, 'CREATE_EVENT', 'Event', newEvent.id, undefined, newEvent);
      return newEvent;
    }

    // Copy event
    const copyEventMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/copy$/);
    if (method === 'POST' && copyEventMatch) {
      const srcEventId = copyEventMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, srcEventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const srcEvent = (await db.get('events', srcEventId)) as Event | undefined;
      if (!srcEvent) throw new ApiError(404, 'NOT_FOUND', 'دوره مبدأ یافت نشد.');

      const newEventId = `EVT-${Date.now()}`;
      const newEvent: Event = {
        ...srcEvent,
        id: newEventId,
        title: `${srcEvent.title} (نسخه رونوشت)`,
        status: 'Draft',
        created_by: user.id,
      };
      await db.put('events', newEvent);

      // Copy activities
      const allActs = (await db.getAll('activities')) as Activity[];
      const srcActs = allActs.filter((a) => a.event_id === srcEventId);
      for (const act of srcActs) {
        await db.put('activities', {
          ...act,
          id: `ACT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          event_id: newEventId,
          status: 'Draft',
          opened_at: undefined,
          closed_at: undefined,
        });
      }

      await recordAuditLog(db, user, 'COPY_EVENT', 'Event', newEventId, { srcEventId }, newEvent);
      return newEvent;
    }

    // Change event status
    const eventStatusMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/status$/);
    if (method === 'PATCH' && eventStatusMatch) {
      const eventId = eventStatusMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const event = (await db.get('events', eventId)) as Event | undefined;
      if (!event) throw new ApiError(404, 'NOT_FOUND', 'دوره یافت نشد.');

      const { status } = body || {};
      if (!['Draft', 'Active', 'Closed', 'Archived'].includes(status)) {
        throw new ApiError(400, 'VALIDATION', 'وضعیت دوره نامعتبر است.');
      }

      const before = { ...event };
      event.status = status;
      await db.put('events', event);
      await recordAuditLog(db, user, 'UPDATE_EVENT_STATUS', 'Event', event.id, before, event);
      return event;
    }

    // Unassigned check before activation
    const unassignedCheckMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/unassigned-check$/);
    if (method === 'GET' && unassignedCheckMatch) {
      const eventId = unassignedCheckMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const allActs = (await db.getAll('activities')) as Activity[];
      const eventActs = allActs.filter((a) => a.event_id === eventId);

      const allParticipants = (await db.getAll('participants')) as Participant[];
      const eventParticipants = allParticipants.filter((p) => p.event_id === eventId && p.status === 'Active');

      const allGroups = (await db.getAll('groups')) as Group[];
      const eventGroups = allGroups.filter((g) => g.event_id === eventId);

      const allAssignments = (await db.getAll('assignments')) as Assignment[];
      const activeAssignments = allAssignments.filter((a) => a.event_id === eventId && a.status === 'Active');

      const checkResults = eventActs.map((act) => {
        const actAssignments = activeAssignments.filter((a) => a.activity_id === act.id);
        const coveredGroupIds = new Set(
          actAssignments.filter((a) => a.kind === 'group' && a.group_id).map((a) => a.group_id)
        );
        const unassignedGroups = eventGroups.filter((g) => !coveredGroupIds.has(g.id));

        const coveredParticipantIds = new Set<string>();
        for (const p of eventParticipants) {
          const hasOverride = actAssignments.some((a) => a.kind === 'override' && a.participant_id === p.id);
          const hasIndiv = actAssignments.some((a) => a.kind === 'individual' && a.participant_id === p.id);
          const hasGrp = actAssignments.some((a) => a.kind === 'group' && a.group_id === p.group_id);
          if (hasOverride || hasIndiv || hasGrp) coveredParticipantIds.add(p.id);
        }

        const unassignedParticipants = eventParticipants.filter((p) => !coveredParticipantIds.has(p.id));

        return {
          activity_id: act.id,
          activity_title: act.title,
          unassigned_groups: unassignedGroups,
          unassigned_participants_count: unassignedParticipants.length,
          unassigned_participants: unassignedParticipants.slice(0, 10),
          is_fully_assigned: unassignedParticipants.length === 0,
        };
      });

      return checkResults;
    }

    // ---------------- Participants & Import ----------------
    const getParticipantsMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/participants$/);
    if (method === 'GET' && getParticipantsMatch) {
      const eventId = getParticipantsMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const allParticipants = (await db.getAll('participants')) as Participant[];
      const allGroups = (await db.getAll('groups')) as Group[];
      const gMap = new Map(allGroups.map((g) => [g.id, g]));

      const eventParticipants = allParticipants
        .filter((p) => p.event_id === eventId)
        .map((p) => ({
          ...p,
          group_code: gMap.get(p.group_id)?.code || '',
          group_title: gMap.get(p.group_id)?.title || '',
        }));

      return eventParticipants;
    }

    // Add single participant manually
    if (method === 'POST' && getParticipantsMatch) {
      const eventId = getParticipantsMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const { full_name, participant_code, group_code, personnel_code, organization, job_title } = body || {};
      if (!full_name) throw new ApiError(400, 'VALIDATION', 'نام و نام‌خانوادگی الزامی است.');

      // Find or create group
      const allGroups = (await db.getAll('groups')) as Group[];
      let group = allGroups.find((g) => g.event_id === eventId && g.code === (group_code || '01G'));
      if (!group) {
        group = {
          id: `grp-${eventId}-${Date.now()}`,
          event_id: eventId,
          code: group_code || '01G',
          title: `گروه ${group_code || '01G'}`,
        };
        await db.put('groups', group);
      }

      const pCode = participant_code || `PT-${Math.floor(100 + Math.random() * 900)}`;
      const newParticipant: Participant = {
        id: `pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        event_id: eventId,
        participant_code: pCode,
        full_name,
        personnel_code,
        organization,
        job_title,
        group_id: group.id,
        status: 'Active',
      };

      await db.put('participants', newParticipant);
      await recordAuditLog(db, user, 'CREATE_PARTICIPANT', 'Participant', newParticipant.id, undefined, newParticipant);
      return newParticipant;
    }

    // Edit participant
    const editParticipantMatch = cleanPath.match(/^\/admin\/participants\/([^\/]+)$/);
    if (method === 'PATCH' && editParticipantMatch) {
      const pId = editParticipantMatch[1];
      const p = (await db.get('participants', pId)) as Participant | undefined;
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'شرکت‌کننده یافت نشد.');

      const hasAccess = await checkEventAdminAccess(db, user, p.event_id);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const before = { ...p };
      const { full_name, participant_code, group_id, personnel_code, organization, job_title, status } = body || {};

      if (full_name) p.full_name = full_name;
      if (participant_code) p.participant_code = participant_code;
      if (group_id) p.group_id = group_id;
      if (personnel_code !== undefined) p.personnel_code = personnel_code;
      if (organization !== undefined) p.organization = organization;
      if (job_title !== undefined) p.job_title = job_title;
      if (status) p.status = status;

      await db.put('participants', p);
      await recordAuditLog(db, user, 'UPDATE_PARTICIPANT', 'Participant', p.id, before, p);
      return p;
    }

    // Import participants from parsed rows
    const importParticipantsMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/participants\/import$/);
    if (method === 'POST' && importParticipantsMatch) {
      const eventId = importParticipantsMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const { rows } = body || {};
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new ApiError(400, 'VALIDATION', 'ردیف‌های فایل ورودی خالی است.');
      }

      const allGroups = (await db.getAll('groups')) as Group[];
      const eventGroups = allGroups.filter((g) => g.event_id === eventId);
      const groupMapByCode = new Map(eventGroups.map((g) => [g.code.toUpperCase(), g]));

      const allParticipants = (await db.getAll('participants')) as Participant[];
      const eventParticipants = allParticipants.filter((p) => p.event_id === eventId);
      const existingCodes = new Set(eventParticipants.map((p) => p.participant_code.toUpperCase()));

      let importedCount = 0;
      let newGroupsCreated = 0;
      const createdParticipants: Participant[] = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const fullName = (row.name_full || row.full_name || '').trim();
        if (!fullName) continue;

        let codeGroup = (row.code_group || row.group_code || 'DEFAULT').trim().toUpperCase();
        if (!codeGroup) codeGroup = '01G';

        let pCode = (row.participant_code || row.code_participant || '').trim().toUpperCase();
        if (!pCode) {
          pCode = `PT-${String(eventParticipants.length + importedCount + 1).padStart(3, '0')}`;
        }

        // Avoid duplicate codes
        if (existingCodes.has(pCode)) {
          pCode = `${pCode}-${Math.floor(100 + Math.random() * 900)}`;
        }
        existingCodes.add(pCode);

        // Find or auto-create group
        let targetGroup = groupMapByCode.get(codeGroup);
        if (!targetGroup) {
          targetGroup = {
            id: `grp-${eventId}-${codeGroup}-${Date.now()}`,
            event_id: eventId,
            code: codeGroup,
            title: `گروه ${codeGroup}`,
          };
          await db.put('groups', targetGroup);
          groupMapByCode.set(codeGroup, targetGroup);
          newGroupsCreated++;
        }

        const newP: Participant = {
          id: `pt-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          event_id: eventId,
          participant_code: pCode,
          full_name: fullName,
          personnel_code: row.code_personnel || row.personnel_code || undefined,
          organization: row.organization || undefined,
          job_title: row.title_job || row.job_title || undefined,
          group_id: targetGroup.id,
          status: 'Active',
        };

        await db.put('participants', newP);
        createdParticipants.push(newP);
        importedCount++;
      }

      await recordAuditLog(db, user, 'IMPORT_PARTICIPANTS', 'Event', eventId, undefined, {
        importedCount,
        newGroupsCreated,
      });

      return {
        success: true,
        imported_count: importedCount,
        new_groups_created: newGroupsCreated,
        participants: createdParticipants,
      };
    }

    // ---------------- Activities Management ----------------
    const getActivitiesMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/activities$/);
    if (method === 'GET' && getActivitiesMatch) {
      const eventId = getActivitiesMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const allActs = (await db.getAll('activities')) as Activity[];
      return allActs.filter((a) => a.event_id === eventId).sort((a, b) => a.order_no - b.order_no);
    }

    if (method === 'POST' && getActivitiesMatch) {
      const eventId = getActivitiesMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const { title, order_no } = body || {};
      if (!title) throw new ApiError(400, 'VALIDATION', 'عنوان فعالیت الزامی است.');

      const allActs = (await db.getAll('activities')) as Activity[];
      const eventActs = allActs.filter((a) => a.event_id === eventId);

      const newAct: Activity = {
        id: `ACT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        event_id: eventId,
        title,
        order_no: order_no || eventActs.length + 1,
        status: 'Draft',
      };

      await db.put('activities', newAct);
      await recordAuditLog(db, user, 'CREATE_ACTIVITY', 'Activity', newAct.id, undefined, newAct);
      return newAct;
    }

    // Activity Open / Close
    const actStatusMatch = cleanPath.match(/^\/admin\/activities\/([^\/]+)\/status$/);
    if (method === 'PATCH' && actStatusMatch) {
      const actId = actStatusMatch[1];
      const act = (await db.get('activities', actId)) as Activity | undefined;
      if (!act) throw new ApiError(404, 'NOT_FOUND', 'فعالیت یافت نشد.');

      const hasAccess = await checkEventAdminAccess(db, user, act.event_id);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const { status } = body || {};
      if (!['Draft', 'Open', 'Closed'].includes(status)) {
        throw new ApiError(400, 'VALIDATION', 'وضعیت فعالیت نامعتبر است.');
      }

      const before = { ...act };
      act.status = status;
      if (status === 'Open') {
        act.opened_at = getISOStringWithOffset();
      } else if (status === 'Closed') {
        act.closed_at = getISOStringWithOffset();
      }

      await db.put('activities', act);
      await recordAuditLog(db, user, 'UPDATE_ACTIVITY_STATUS', 'Activity', act.id, before, act);
      return act;
    }

    // ---------------- Assignments Management ----------------
    const getAssignmentsMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/assignments$/);
    if (method === 'GET' && getAssignmentsMatch) {
      const eventId = getAssignmentsMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const allAssignments = (await db.getAll('assignments')) as Assignment[];
      return allAssignments.filter((a) => a.event_id === eventId);
    }

    if (method === 'POST' && getAssignmentsMatch) {
      const eventId = getAssignmentsMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const { activity_id, facilitator_id, kind, group_id, participant_id } = body || {};
      if (!activity_id || !facilitator_id || !kind) {
        throw new ApiError(400, 'VALIDATION', 'اطلاعات تخصیص ناقص است.');
      }

      const newAssignment: Assignment = {
        id: `asg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        event_id: eventId,
        activity_id,
        facilitator_id,
        kind,
        group_id: kind === 'group' ? group_id : undefined,
        participant_id: kind !== 'group' ? participant_id : undefined,
        status: 'Active',
        created_at: getISOStringWithOffset(),
      };

      await db.put('assignments', newAssignment);
      await recordAuditLog(db, user, 'CREATE_ASSIGNMENT', 'Assignment', newAssignment.id, undefined, newAssignment);
      return newAssignment;
    }

    // Revoke assignment (Mid-event reassignment)
    const revokeAsgMatch = cleanPath.match(/^\/admin\/assignments\/([^\/]+)\/revoke$/);
    if (method === 'POST' && revokeAsgMatch) {
      const asgId = revokeAsgMatch[1];
      const asg = (await db.get('assignments', asgId)) as Assignment | undefined;
      if (!asg) throw new ApiError(404, 'NOT_FOUND', 'تخصیص یافت نشد.');

      const hasAccess = await checkEventAdminAccess(db, user, asg.event_id);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const before = { ...asg };
      asg.status = 'Revoked';
      asg.revoked_at = getISOStringWithOffset();

      await db.put('assignments', asg);
      await recordAuditLog(db, user, 'REVOKE_ASSIGNMENT', 'Assignment', asg.id, before, asg);
      return asg;
    }

    // Rotate assignments tool (Suggested rotation preview & apply)
    const rotateAsgMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/rotate-assignments$/);
    if (method === 'POST' && rotateAsgMatch) {
      const eventId = rotateAsgMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      const { from_activity_id, to_activity_id, commit } = body || {};
      if (!from_activity_id || !to_activity_id) {
        throw new ApiError(400, 'VALIDATION', 'فعالیت مبدأ و مقصد الزامی هستند.');
      }

      const allAssignments = (await db.getAll('assignments')) as Assignment[];
      const srcAssignments = allAssignments.filter(
        (a) => a.event_id === eventId && a.activity_id === from_activity_id && a.status === 'Active' && a.kind === 'group'
      );

      const allGroups = (await db.getAll('groups')) as Group[];
      const eventGroups = allGroups.filter((g) => g.event_id === eventId);

      const allMembers = (await db.getAll('event_members')) as EventMember[];
      const facUsers = allMembers.filter((m) => m.event_id === eventId && m.role === 'FACILITATOR');
      const facIds = facUsers.map((m) => m.user_id);

      // Perform rotation: group i assigned to facilitator (i+1) mod n
      const rotatedAssignments: Assignment[] = [];
      const n = Math.max(facIds.length, 1);

      srcAssignments.forEach((asg, idx) => {
        const nextFacId = facIds[(idx + 1) % n] || asg.facilitator_id;
        rotatedAssignments.push({
          id: `asg-${to_activity_id}-${asg.group_id}-${Date.now()}`,
          event_id: eventId,
          activity_id: to_activity_id,
          facilitator_id: nextFacId,
          kind: 'group',
          group_id: asg.group_id,
          status: 'Active',
          created_at: getISOStringWithOffset(),
        });
      });

      if (commit) {
        for (const asg of rotatedAssignments) {
          await db.put('assignments', asg);
        }
        await recordAuditLog(db, user, 'ROTATE_ASSIGNMENTS', 'Assignment', to_activity_id, { from_activity_id }, rotatedAssignments);
      }

      return {
        preview: !commit,
        count: rotatedAssignments.length,
        assignments: rotatedAssignments,
      };
    }

    // ---------------- Live Coverage Dashboard ----------------
    const liveCoverageMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/live-coverage$/);
    if (method === 'GET' && liveCoverageMatch) {
      const eventId = liveCoverageMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      // Audit viewing live coverage
      await recordAuditLog(db, user, 'VIEW_LIVE_COVERAGE', 'Event', eventId);

      const allParticipants = (await db.getAll('participants')) as Participant[];
      const eventParticipants = allParticipants.filter((p) => p.event_id === eventId && p.status === 'Active');

      const allGroups = (await db.getAll('groups')) as Group[];
      const eventGroups = allGroups.filter((g) => g.event_id === eventId);

      const allMembers = (await db.getAll('event_members')) as EventMember[];
      const allUsers = (await db.getAll('users')) as User[];
      const uMap = new Map(allUsers.map((u) => [u.id, u]));

      const facilitators = allMembers
        .filter((m) => m.event_id === eventId && m.role === 'FACILITATOR')
        .map((m) => {
          const u = uMap.get(m.user_id);
          return {
            id: m.user_id,
            full_name: u?.full_name || 'تسهیلگر',
            last_active_at: u?.last_active_at,
          };
        });

      const allActivities = (await db.getAll('activities')) as Activity[];
      const eventActivities = allActivities.filter((a) => a.event_id === eventId).sort((a, b) => a.order_no - b.order_no);
      const currentActivity = eventActivities.find((a) => a.status === 'Open') || eventActivities[0];
      const nextActivity = eventActivities.find((a) => a.status === 'Draft');

      const allObs = (await db.find<Observation>('observations', 'event_id', [eventId]));
      const eventObs = allObs.filter((o) => o.event_id === eventId && o.status !== 'Voided');

      const allCov = (await db.find<CoverageMark>('coverage_marks', 'event_id', [eventId]));
      const eventCov = allCov.filter((c) => c.event_id === eventId);

      // Current activity observations
      const currentActObs = currentActivity
        ? eventObs.filter((o) => o.activity_id === currentActivity.id)
        : [];
      const currentActObservedParticipantIds = new Set(currentActObs.map((o) => o.participant_id));

      const coveragePercent = eventParticipants.length > 0
        ? Math.round((currentActObservedParticipantIds.size / eventParticipants.length) * 100)
        : 0;

      // Low data participants across all activities
      // Criteria: less than 2 observations or less than 2 distinct observers
      const lowDataParticipants = eventParticipants
        .map((p) => {
          const pObs = eventObs.filter((o) => o.participant_id === p.id);
          const distinctObservers = new Set(pObs.map((o) => o.facilitator_id)).size;
          const pCov = eventCov.filter((c) => c.participant_id === p.id);

          return {
            participant_id: p.id,
            participant_code: p.participant_code,
            full_name: p.full_name,
            observation_count: pObs.length,
            observer_diversity: distinctObservers,
            no_opportunity_count: pCov.length,
            is_low_data: pObs.length < 2 || distinctObservers < 2,
          };
        })
        .filter((item) => item.is_low_data);

      return {
        event_id: eventId,
        participant_count: eventParticipants.length,
        group_count: eventGroups.length,
        facilitator_count: facilitators.length,
        current_activity: currentActivity || null,
        next_activity: nextActivity || null,
        coverage_percent: coveragePercent,
        observed_participants_count: currentActObservedParticipantIds.size,
        total_observations_count: eventObs.length,
        low_data_participants: lowDataParticipants,
        facilitators,
      };
    }

    // ---------------- Coverage Report ----------------
    const coverageReportMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/coverage-report$/);
    if (method === 'GET' && coverageReportMatch) {
      const eventId = coverageReportMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      await recordAuditLog(db, user, 'VIEW_COVERAGE_REPORT', 'Event', eventId);

      const allActs = (await db.getAll('activities')) as Activity[];
      const eventActs = allActs.filter((a) => a.event_id === eventId).sort((a, b) => a.order_no - b.order_no);

      const allParticipants = (await db.getAll('participants')) as Participant[];
      const eventParticipants = allParticipants.filter((p) => p.event_id === eventId && p.status === 'Active');

      const allAssignments = (await db.getAll('assignments')) as Assignment[];
      const activeAssignments = allAssignments.filter((a) => a.event_id === eventId && a.status === 'Active');

      const allObs = (await db.find<Observation>('observations', 'event_id', [eventId]));
      const eventObs = allObs.filter((o) => o.event_id === eventId && o.status !== 'Voided');

      const allCov = (await db.find<CoverageMark>('coverage_marks', 'event_id', [eventId]));
      const eventCov = allCov.filter((c) => c.event_id === eventId);

      const reportRows: any[] = [];

      for (const act of eventActs) {
        for (const p of eventParticipants) {
          // Check assigned observers
          const actAssignments = activeAssignments.filter((a) => a.activity_id === act.id);
          const assignedObservers = new Set<string>();

          const overrideAsgs = actAssignments.filter((a) => a.kind === 'override' && a.participant_id === p.id);
          if (overrideAsgs.length > 0) {
            overrideAsgs.forEach((a) => assignedObservers.add(a.facilitator_id));
          } else {
            actAssignments
              .filter((a) => a.kind === 'individual' && a.participant_id === p.id)
              .forEach((a) => assignedObservers.add(a.facilitator_id));
            actAssignments
              .filter((a) => a.kind === 'group' && a.group_id === p.group_id)
              .forEach((a) => assignedObservers.add(a.facilitator_id));
          }

          const pObsInAct = eventObs.filter((o) => o.activity_id === act.id && o.participant_id === p.id);
          const distinctObservers = new Set(pObsInAct.map((o) => o.facilitator_id)).size;
          const noOppMarks = eventCov.filter((c) => c.activity_id === act.id && c.participant_id === p.id);

          const isAssigned = assignedObservers.size > 0;
          const isMissingCoverage = isAssigned && pObsInAct.length === 0 && noOppMarks.length === 0;

          reportRows.push({
            activity_id: act.id,
            activity_title: act.title,
            participant_id: p.id,
            participant_code: p.participant_code,
            participant_name: p.full_name,
            assigned_observer_count: assignedObservers.size,
            observation_count: pObsInAct.length,
            distinct_observer_count: distinctObservers,
            no_opportunity_count: noOppMarks.length,
            missing_coverage: isMissingCoverage,
          });
        }
      }

      return reportRows;
    }

    // ---------------- Exports ----------------
    // 1) Long CSV
    const exportLongCsvMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/export\/long-csv$/);
    if (method === 'GET' && exportLongCsvMatch) {
      const eventId = exportLongCsvMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      await recordAuditLog(db, user, 'EXPORT_LONG_CSV', 'Event', eventId);

      const event = (await db.get('events', eventId)) as Event;
      const allActs = (await db.getAll('activities')) as Activity[];
      const aMap = new Map(allActs.map((a) => [a.id, a]));

      const allParticipants = (await db.getAll('participants')) as Participant[];
      const pMap = new Map(allParticipants.map((p) => [p.id, p]));

      const allGroups = (await db.getAll('groups')) as Group[];
      const gMap = new Map(allGroups.map((g) => [g.id, g]));

      const allUsers = (await db.getAll('users')) as User[];
      const uMap = new Map(allUsers.map((u) => [u.id, u]));

      const allBehaviors = (await db.getAll('behaviors')) as BehaviorCatalog[];
      const bMap = new Map(allBehaviors.map((b) => [b.code, b]));

      const allObs = (await db.find<Observation>('observations', 'event_id', [eventId]));
      const eventObs = allObs.filter((o) => o.event_id === eventId);

      // Build rows: exactly one row per behavior tag!
      const rows: string[] = [];
      // Header
      rows.push(
        [
          'id_event',
          'title_event',
          'event_date',
          'id_activity',
          'title_activity',
          'id_participant',
          'code_participant',
          'name_participant',
          'group_code',
          'id_facilitator',
          'name_facilitator',
          'id_observation',
          'behavior_code',
          'label_behavior',
          'polarity',
          'at_created_client',
          'at_created_server',
          'note',
          'observation_status',
        ].join(',')
      );

      for (const obs of eventObs) {
        const act = aMap.get(obs.activity_id);
        const p = pMap.get(obs.participant_id);
        const grp = p ? gMap.get(p.group_id) : undefined;
        const fac = uMap.get(obs.facilitator_id);

        for (const code of obs.behavior_codes) {
          const b = bMap.get(code);
          const row = [
            JSON.stringify(event.id),
            JSON.stringify(event.title),
            JSON.stringify(event.event_date),
            JSON.stringify(obs.activity_id),
            JSON.stringify(act?.title || ''),
            JSON.stringify(obs.participant_id),
            JSON.stringify(p?.participant_code || ''),
            JSON.stringify(p?.full_name || ''),
            JSON.stringify(grp?.code || ''),
            JSON.stringify(obs.facilitator_id),
            JSON.stringify(fac?.full_name || ''),
            JSON.stringify(obs.id),
            JSON.stringify(code),
            JSON.stringify(b?.label_fa || ''),
            JSON.stringify(b?.polarity || 'positive'),
            JSON.stringify(obs.client_created_at),
            JSON.stringify(obs.server_created_at || ''),
            JSON.stringify(obs.note || ''),
            JSON.stringify(obs.status.toLowerCase()),
          ].join(',');
          rows.push(row);
        }
      }

      // Add UTF-8 BOM
      const csvContent = '\uFEFF' + rows.join('\r\n');
      return { csv: csvContent, filename: `gera_long_obs_${eventId}_v${CONFIG.CATALOG_VERSION}.csv` };
    }

    // 2) Coverage CSV
    const exportCoverageCsvMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/export\/coverage-csv$/);
    if (method === 'GET' && exportCoverageCsvMatch) {
      const eventId = exportCoverageCsvMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      await recordAuditLog(db, user, 'EXPORT_COVERAGE_CSV', 'Event', eventId);

      const allActs = (await db.getAll('activities')) as Activity[];
      const eventActs = allActs.filter((a) => a.event_id === eventId);

      const allParticipants = (await db.getAll('participants')) as Participant[];
      const eventParticipants = allParticipants.filter((p) => p.event_id === eventId);

      const allAssignments = (await db.getAll('assignments')) as Assignment[];
      const activeAssignments = allAssignments.filter((a) => a.event_id === eventId && a.status === 'Active');

      const allObs = (await db.find<Observation>('observations', 'event_id', [eventId]));
      const eventObs = allObs.filter((o) => o.event_id === eventId && o.status !== 'Voided');

      const allCov = (await db.find<CoverageMark>('coverage_marks', 'event_id', [eventId]));
      const eventCov = allCov.filter((c) => c.event_id === eventId);

      const rows: string[] = [];
      rows.push(
        [
          'id_activity',
          'id_participant',
          'assigned_observer_count',
          'observation_count',
          'distinct_observer_count',
          'no_opportunity_count',
          'missing_coverage',
        ].join(',')
      );

      for (const act of eventActs) {
        for (const p of eventParticipants) {
          const actAssignments = activeAssignments.filter((a) => a.activity_id === act.id);
          const assignedObservers = new Set<string>();

          const overrideAsgs = actAssignments.filter((a) => a.kind === 'override' && a.participant_id === p.id);
          if (overrideAsgs.length > 0) {
            overrideAsgs.forEach((a) => assignedObservers.add(a.facilitator_id));
          } else {
            actAssignments
              .filter((a) => a.kind === 'individual' && a.participant_id === p.id)
              .forEach((a) => assignedObservers.add(a.facilitator_id));
            actAssignments
              .filter((a) => a.kind === 'group' && a.group_id === p.group_id)
              .forEach((a) => assignedObservers.add(a.facilitator_id));
          }

          const pObsInAct = eventObs.filter((o) => o.activity_id === act.id && o.participant_id === p.id);
          const distinctObservers = new Set(pObsInAct.map((o) => o.facilitator_id)).size;
          const noOppMarks = eventCov.filter((c) => c.activity_id === act.id && c.participant_id === p.id);

          const isAssigned = assignedObservers.size > 0;
          const isMissingCoverage = isAssigned && pObsInAct.length === 0 && noOppMarks.length === 0;

          rows.push(
            [
              JSON.stringify(act.id),
              JSON.stringify(p.id),
              assignedObservers.size,
              pObsInAct.length,
              distinctObservers,
              noOppMarks.length,
              isMissingCoverage ? 'true' : 'false',
            ].join(',')
          );
        }
      }

      const csvContent = '\uFEFF' + rows.join('\r\n');
      return { csv: csvContent, filename: `gera_coverage_${eventId}.csv` };
    }

    // 3) Analysis Bundle JSON
    const exportBundleMatch = cleanPath.match(/^\/admin\/events\/([^\/]+)\/export\/analysis-bundle$/);
    if (method === 'GET' && exportBundleMatch) {
      const eventId = exportBundleMatch[1];
      const hasAccess = await checkEventAdminAccess(db, user, eventId);
      if (!hasAccess) throw new ApiError(403, 'FORBIDDEN', 'شما به این دوره دسترسی ندارید.');

      await recordAuditLog(db, user, 'EXPORT_ANALYSIS_BUNDLE', 'Event', eventId);

      const event = (await db.get('events', eventId)) as Event;
      const allActs = (await db.getAll('activities')) as Activity[];
      const eventActs = allActs.filter((a) => a.event_id === eventId);

      const allParticipants = (await db.getAll('participants')) as Participant[];
      const eventParticipants = allParticipants.filter((p) => p.event_id === eventId);

      const allGroups = (await db.getAll('groups')) as Group[];
      const eventGroups = allGroups.filter((g) => g.event_id === eventId);

      const allMembers = (await db.getAll('event_members')) as EventMember[];
      const allUsers = (await db.getAll('users')) as User[];
      const uMap = new Map(allUsers.map((u) => [u.id, u]));

      // Facilitators: ONLY id and full_name, NEVER password or contact info
      const eventFacilitators = allMembers
        .filter((m) => m.event_id === eventId && m.role === 'FACILITATOR')
        .map((m) => ({
          id: m.user_id,
          name: uMap.get(m.user_id)?.full_name || '',
        }));

      const allAssignments = (await db.getAll('assignments')) as Assignment[];
      const eventAssignments = allAssignments.filter((a) => a.event_id === eventId);

      const allBehaviors = (await db.getAll('behaviors')) as BehaviorCatalog[];
      const allObs = (await db.find<Observation>('observations', 'event_id', [eventId]));
      const eventObs = allObs.filter((o) => o.event_id === eventId);

      const allCov = (await db.find<CoverageMark>('coverage_marks', 'event_id', [eventId]));
      const eventCov = allCov.filter((c) => c.event_id === eventId);

      const bundle = {
        metadata: {
          app: 'GERA',
          exported_at: getISOStringWithOffset(),
          event_id: event.id,
          event_title: event.title,
          event_date: event.event_date,
          status: event.status,
        },
        behavior_catalog: {
          version: CONFIG.CATALOG_VERSION,
          items: allBehaviors.map((b) => ({
            code: b.code,
            label_fa: b.label_fa,
            polarity: b.polarity,
          })),
        },
        participants: eventParticipants.map((p) => ({
          id: p.id,
          code: p.participant_code,
          full_name: p.full_name,
          group_id: p.group_id,
        })),
        groups: eventGroups,
        activities: eventActs,
        facilitators: eventFacilitators,
        assignments: eventAssignments,
        observations: eventObs,
        coverage_marks: eventCov,
        hidden_competency_mapping: null, // As explicitly specified: no mapping exists!
      };

      return { bundle, filename: `gera_bundle_${eventId}.json` };
    }

    // ---------------- Audit Logs ----------------
    if (cleanPath === '/admin/audit-logs' && method === 'GET') {
      const allLogs = (await db.getAll('audit_logs')) as AuditLog[];
      return allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  // ---------------- Dev Panel Endpoints (disabled unless ENABLE_DEV_TOOLS=true) ----------------
  if (cleanPath.startsWith('/dev/') && !devToolsEnabled()) {
    throw new ApiError(404, 'NOT_FOUND', `مسیر ${path} یافت نشد.`);
  }
  if (cleanPath === '/dev/seed-500-observations' && method === 'POST') {
    const event = (await db.get('events', 'EVT-BOOTCAMP-2026')) as Event | undefined;
    if (!event) throw new ApiError(404, 'NOT_FOUND', 'دوره نمونه یافت نشد.');

    const allActs = (await db.getAll('activities')) as Activity[];
    const openActs = allActs.filter((a) => a.event_id === event.id && a.status === 'Open');
    const actIds = openActs.map((a) => a.id);
    if (actIds.length === 0) actIds.push('ACT-01', 'ACT-02');

    const allParticipants = (await db.getAll('participants')) as Participant[];
    const eventParticipants = allParticipants.filter((p) => p.event_id === event.id);

    const facIds = ['u-fac1', 'u-fac2', 'u-fac3', 'u-fac4', 'u-fac5', 'u-fac6', 'u-fac7', 'u-fac8'];
    const pCodes = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11', 'P12', 'P13', 'P14'];
    const wCodes = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10'];


    for (let i = 0; i < 500; i++) {
      const p = eventParticipants[i % eventParticipants.length];
      const facId = facIds[i % facIds.length];
      const actId = actIds[i % actIds.length];
      const uuid = `uuid-dev-500-${i}-${Date.now()}`;

      // Occasionally add a coverage mark (no opportunity)
      if (i % 35 === 0) {
        await db.put('coverage_marks', {
          id: `cov-dev-${i}`,
          offline_uuid: uuid,
          event_id: event.id,
          activity_id: actId,
          participant_id: p.id,
          facilitator_id: facId,
          type: 'NO_OPPORTUNITY',
          client_created_at: getISOStringWithOffset(),
          created_at: getISOStringWithOffset(),
        });
        continue;
      }

      // 1-3 behavior tags
      const tagCount = (i % 3) + 1;
      const codes: string[] = [];
      for (let t = 0; t < tagCount; t++) {
        const isWarning = (i + t) % 7 === 0;
        const code = isWarning
          ? wCodes[(i + t) % wCodes.length]
          : pCodes[(i + t) % pCodes.length];
        if (!codes.includes(code)) codes.push(code);
      }

      const status = i % 40 === 0 ? 'Voided' : i % 25 === 0 ? 'Corrected' : 'Synced';

      await db.put('observations', {
        id: `obs-dev-${i}`,
        offline_uuid: uuid,
        event_id: event.id,
        activity_id: actId,
        participant_id: p.id,
        facilitator_id: facId,
        note: i % 5 === 0 ? 'مشاهده رفتار نمونه در جریان بازی تیمی' : undefined,
        client_created_at: getISOStringWithOffset(),
        server_created_at: getISOStringWithOffset(),
        status,
        device_id: 'dev-simulator',
        behavior_codes: codes,
      });
    }

    return { success: true, count: 500 };
  }

  if (cleanPath === '/dev/reset-database' && method === 'POST') {
    await seedDemo(db);
    return { success: true };
  }

  throw new ApiError(404, 'NOT_FOUND', `مسیر ${path} یافت نشد.`);
}
