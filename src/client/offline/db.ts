import { openDB, IDBPDatabase } from 'idb';
import {
  Activity,
  Assignment,
  BehaviorCatalog,
  CoverageMark,
  Event,
  Observation,
  OutboxItem,
  Participant,
} from '../../domain/types';

const CLIENT_DB_NAME = 'gera_client_db';
const CLIENT_DB_VERSION = 1;

let clientDbPromise: Promise<IDBPDatabase> | null = null;

export async function getClientDB(): Promise<IDBPDatabase> {
  if (!clientDbPromise) {
    clientDbPromise = openDB(CLIENT_DB_NAME, CLIENT_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cached_events')) {
          db.createObjectStore('cached_events', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cached_activities')) {
          db.createObjectStore('cached_activities', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cached_participants')) {
          db.createObjectStore('cached_participants', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cached_behaviors')) {
          db.createObjectStore('cached_behaviors', { keyPath: 'code' });
        }
        if (!db.objectStoreNames.contains('cached_assignments')) {
          db.createObjectStore('cached_assignments', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('local_observations')) {
          const obs = db.createObjectStore('local_observations', { keyPath: 'offline_uuid' });
          obs.createIndex('by_status', 'status');
          obs.createIndex('by_activity', 'activity_id');
        }
        if (!db.objectStoreNames.contains('local_coverage_marks')) {
          db.createObjectStore('local_coverage_marks', { keyPath: 'offline_uuid' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outbox = db.createObjectStore('outbox', { keyPath: 'client_op_id' });
          outbox.createIndex('by_created_at', 'created_at');
        }
        if (!db.objectStoreNames.contains('review_items')) {
          db.createObjectStore('review_items', { keyPath: 'offline_uuid' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return clientDbPromise;
}

export interface ReviewItem {
  offline_uuid: string;
  type: string;
  payload: any;
  error_code: string;
  error_message: string;
  dismissed: boolean;
  created_at: string;
}

// ---------------- Cache Access Helpers ----------------

export async function saveCachedData(data: {
  events?: Event[];
  activities?: Activity[];
  participants?: Participant[];
  behaviors?: BehaviorCatalog[];
  assignments?: Assignment[];
}) {
  const db = await getClientDB();
  const tx = db.transaction(
    ['cached_events', 'cached_activities', 'cached_participants', 'cached_behaviors', 'cached_assignments'],
    'readwrite'
  );

  if (data.events) {
    for (const item of data.events) await tx.objectStore('cached_events').put(item);
  }
  if (data.activities) {
    for (const item of data.activities) await tx.objectStore('cached_activities').put(item);
  }
  if (data.participants) {
    for (const item of data.participants) await tx.objectStore('cached_participants').put(item);
  }
  if (data.behaviors) {
    for (const item of data.behaviors) await tx.objectStore('cached_behaviors').put(item);
  }
  if (data.assignments) {
    for (const item of data.assignments) await tx.objectStore('cached_assignments').put(item);
  }

  await tx.done;
}

export async function getCachedEvents(): Promise<Event[]> {
  const db = await getClientDB();
  return (await db.getAll('cached_events')) as Event[];
}

export async function getCachedActivities(eventId?: string): Promise<Activity[]> {
  const db = await getClientDB();
  const all = (await db.getAll('cached_activities')) as Activity[];
  return eventId ? all.filter((a) => a.event_id === eventId) : all;
}

export async function getCachedParticipants(eventId?: string): Promise<Participant[]> {
  const db = await getClientDB();
  const all = (await db.getAll('cached_participants')) as Participant[];
  return eventId ? all.filter((p) => p.event_id === eventId) : all;
}

export async function getCachedBehaviors(): Promise<BehaviorCatalog[]> {
  const db = await getClientDB();
  return (await db.getAll('cached_behaviors')) as BehaviorCatalog[];
}

export async function getCachedAssignments(eventId?: string): Promise<Assignment[]> {
  const db = await getClientDB();
  const all = (await db.getAll('cached_assignments')) as Assignment[];
  return eventId ? all.filter((a) => a.event_id === eventId) : all;
}
