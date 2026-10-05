import { getClientDB, ReviewItem } from './db';
import { Observation, OutboxItem } from '../../domain/types';
import { getISOStringWithOffset } from '../../domain/dateUtils';

/**
 * Enqueue a new operation in Outbox and write/update local observation.
 */
export async function enqueueObservationCreation(observation: Observation): Promise<void> {
  const db = await getClientDB();
  const tx = db.transaction(['local_observations', 'outbox'], 'readwrite');

  // Ensure local observation is stored
  await tx.objectStore('local_observations').put(observation);

  const outboxItem: OutboxItem = {
    client_op_id: `op-obs-${observation.offline_uuid}`,
    type: 'CREATE_OBSERVATION',
    payload: observation,
    created_at: observation.client_created_at || getISOStringWithOffset(),
    retry_count: 0,
    status: 'pending',
  };

  await tx.objectStore('outbox').put(outboxItem);
  await tx.done;
}

/**
 * Enqueue a coverage mark (NO_OPPORTUNITY).
 */
export async function enqueueCoverageMark(mark: {
  offline_uuid: string;
  event_id: string;
  activity_id: string;
  participant_id: string;
  client_created_at: string;
}): Promise<void> {
  const db = await getClientDB();
  const tx = db.transaction(['local_coverage_marks', 'outbox'], 'readwrite');

  await tx.objectStore('local_coverage_marks').put(mark);

  const outboxItem: OutboxItem = {
    client_op_id: `op-cov-${mark.offline_uuid}`,
    type: 'CREATE_NO_OPPORTUNITY',
    payload: mark,
    created_at: mark.client_created_at || getISOStringWithOffset(),
    retry_count: 0,
    status: 'pending',
  };

  await tx.objectStore('outbox').put(outboxItem);
  await tx.done;
}

/**
 * Update an existing observation.
 * If still PendingLocal: update local record directly and update outbox creation payload.
 * If already Synced: enqueue PATCH_OBSERVATION outbox item.
 */
export async function updateLocalObservation(
  offlineUuid: string,
  updates: { behavior_codes: string[]; note?: string }
): Promise<void> {
  const db = await getClientDB();
  const obs = (await db.get('local_observations', offlineUuid)) as Observation | undefined;
  if (!obs) throw new Error('مشاهده در حافظه دستگاه یافت نشد.');

  obs.behavior_codes = updates.behavior_codes;
  obs.note = updates.note;

  if (obs.status === 'PendingLocal') {
    // Modify existing pending outbox item
    const tx = db.transaction(['local_observations', 'outbox'], 'readwrite');
    await tx.objectStore('local_observations').put(obs);

    const outboxItem = (await tx.objectStore('outbox').get(`op-obs-${offlineUuid}`)) as OutboxItem | undefined;
    if (outboxItem) {
      outboxItem.payload = obs;
      await tx.objectStore('outbox').put(outboxItem);
    }
    await tx.done;
  } else {
    // Already synced: queue PATCH operation
    obs.status = 'Corrected';
    const tx = db.transaction(['local_observations', 'outbox'], 'readwrite');
    await tx.objectStore('local_observations').put(obs);

    const patchOp: OutboxItem = {
      client_op_id: `op-patch-${offlineUuid}-${Date.now()}`,
      type: 'PATCH_OBSERVATION',
      payload: {
        id: obs.id,
        offline_uuid: offlineUuid,
        behavior_codes: updates.behavior_codes,
        note: updates.note,
      },
      created_at: getISOStringWithOffset(),
      retry_count: 0,
      status: 'pending',
    };
    await tx.objectStore('outbox').put(patchOp);
    await tx.done;
  }
}

/**
 * Void an observation.
 * If still PendingLocal: update status to Voided and remove from outbox creation.
 * If already Synced: enqueue VOID_OBSERVATION outbox item.
 */
export async function voidLocalObservation(offlineUuid: string): Promise<void> {
  const db = await getClientDB();
  const obs = (await db.get('local_observations', offlineUuid)) as Observation | undefined;
  if (!obs) throw new Error('مشاهده یافت نشد.');

  if (obs.status === 'PendingLocal') {
    obs.status = 'Voided';
    const tx = db.transaction(['local_observations', 'outbox'], 'readwrite');
    await tx.objectStore('local_observations').put(obs);
    await tx.objectStore('outbox').delete(`op-obs-${offlineUuid}`);
    await tx.done;
  } else {
    obs.status = 'Voided';
    const tx = db.transaction(['local_observations', 'outbox'], 'readwrite');
    await tx.objectStore('local_observations').put(obs);

    const voidOp: OutboxItem = {
      client_op_id: `op-void-${offlineUuid}-${Date.now()}`,
      type: 'VOID_OBSERVATION',
      payload: { id: obs.id, offline_uuid: offlineUuid },
      created_at: getISOStringWithOffset(),
      retry_count: 0,
      status: 'pending',
    };
    await tx.objectStore('outbox').put(voidOp);
    await tx.done;
  }
}

/**
 * Gets all outbox items ordered by FIFO.
 */
export async function getPendingOutboxItems(): Promise<OutboxItem[]> {
  const db = await getClientDB();
  const all = (await db.getAll('outbox')) as OutboxItem[];
  return all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/**
 * Save rejected item for review.
 */
export async function addReviewItem(item: ReviewItem): Promise<void> {
  const db = await getClientDB();
  await db.put('review_items', item);
}

export async function getReviewItems(): Promise<ReviewItem[]> {
  const db = await getClientDB();
  const all = (await db.getAll('review_items')) as ReviewItem[];
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function dismissReviewItem(offlineUuid: string): Promise<void> {
  const db = await getClientDB();
  const item = (await db.get('review_items', offlineUuid)) as ReviewItem | undefined;
  if (item) {
    item.dismissed = true;
    await db.put('review_items', item);
  }
}
