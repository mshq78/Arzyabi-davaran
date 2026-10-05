import { getClientDB, ReviewItem, saveCachedData } from './db';
import { addReviewItem, getPendingOutboxItems } from './outbox';
import { Observation, OutboxItem, SyncBatchResponse } from '../../domain/types';
import { request } from '../../client/transport';

type SyncListener = () => void;
const syncListeners: Set<SyncListener> = new Set();

let isSyncRunning = false;
let lastSyncTime: string | null = null;
let syncIntervalId: any = null;

export function subscribeSyncEvents(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncListeners() {
  syncListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

export function getLastSyncTime(): string | null {
  return lastSyncTime;
}

export function getIsSyncing(): boolean {
  return isSyncRunning;
}

/**
 * Perform a full synchronization pass.
 */
export async function runSync(token?: string): Promise<{ success: boolean; syncedCount: number; errors: number }> {
  if (isSyncRunning) return { success: false, syncedCount: 0, errors: 0 };
  if (!token) return { success: false, syncedCount: 0, errors: 0 };

  isSyncRunning = true;
  notifySyncListeners();

  let syncedCount = 0;
  let errors = 0;

  try {
    const db = await getClientDB();
    const outboxItems = await getPendingOutboxItems();

    if (outboxItems.length > 0) {
      // 1. Group CREATE_OBSERVATION items for batch submission
      const createOps = outboxItems.filter((op) => op.type === 'CREATE_OBSERVATION');
      const otherOps = outboxItems.filter((op) => op.type !== 'CREATE_OBSERVATION');

      if (createOps.length > 0) {
        const payloadObservations = createOps.map((op) => op.payload as Observation);
        const batchRes = await request<SyncBatchResponse>(
          'POST',
          '/observations/batch',
          { observations: payloadObservations },
          token
        );

        if (batchRes.ok && batchRes.data?.results) {
          const resultsMap = new Map(batchRes.data.results.map((r) => [r.offline_uuid, r]));

          for (const op of createOps) {
            const obs = op.payload as Observation;
            const resItem = resultsMap.get(obs.offline_uuid);

            if (resItem?.status === 'synced') {
              // Successfully synced
              obs.status = 'Synced';
              obs.id = resItem.observation_id || obs.id;
              obs.server_created_at = resItem.server_created_at;

              await db.put('local_observations', obs);
              await db.delete('outbox', op.client_op_id);
              syncedCount++;
            } else if (resItem?.status === 'error') {
              // Server rejected this item - NEVER DELETE!
              errors++;
              const persianMessage = getPersianErrorMessage(resItem.code, resItem.message);

              const review: ReviewItem = {
                offline_uuid: obs.offline_uuid,
                type: 'Observation',
                payload: obs,
                error_code: resItem.code || 'UNKNOWN',
                error_message: persianMessage,
                dismissed: false,
                created_at: obs.client_created_at,
              };

              await addReviewItem(review);
              // Remove from active outbox queue so it doesn't block future syncs
              await db.delete('outbox', op.client_op_id);
            }
          }
        } else if (!batchRes.ok && batchRes.status === 0) {
          // Network error - keep in outbox
        }
      }

      // 2. Process other individual operations in FIFO order
      for (const op of otherOps) {
        if (op.type === 'PATCH_OBSERVATION') {
          const res = await request('PATCH', `/observations/${op.payload.id}`, op.payload, token);
          if (res.ok) {
            await db.delete('outbox', op.client_op_id);
            syncedCount++;
          } else if (res.status === 400 || res.status === 403 || res.status === 404) {
            errors++;
            await addReviewItem({
              offline_uuid: op.payload.offline_uuid,
              type: 'Edit',
              payload: op.payload,
              error_code: res.error?.code || 'ERROR',
              error_message: res.error?.message || 'خطا در ویرایش مشاهده.',
              dismissed: false,
              created_at: op.created_at,
            });
            await db.delete('outbox', op.client_op_id);
          }
        } else if (op.type === 'VOID_OBSERVATION') {
          const res = await request('POST', `/observations/${op.payload.id}/void`, {}, token);
          if (res.ok) {
            await db.delete('outbox', op.client_op_id);
            syncedCount++;
          } else if (res.status === 400 || res.status === 403 || res.status === 404) {
            errors++;
            await db.delete('outbox', op.client_op_id);
          }
        } else if (op.type === 'CREATE_NO_OPPORTUNITY') {
          const res = await request('POST', '/coverage/no-opportunity', op.payload, token);
          if (res.ok) {
            await db.delete('outbox', op.client_op_id);
            syncedCount++;
          } else if (res.status === 400 || res.status === 403) {
            errors++;
            await addReviewItem({
              offline_uuid: op.payload.offline_uuid,
              type: 'NoOpportunity',
              payload: op.payload,
              error_code: res.error?.code || 'ERROR',
              error_message: res.error?.message || 'خطا در ثبت عدم فرصت مشاهده.',
              dismissed: false,
              created_at: op.created_at,
            });
            await db.delete('outbox', op.client_op_id);
          }
        }
      }
    }

    // 3. Refresh active events & assignments from server if connected
    const activeEventsRes = await request('GET', '/events/active', undefined, token);
    if (activeEventsRes.ok && activeEventsRes.data) {
      await saveCachedData({ events: activeEventsRes.data });

      // Refresh for first active event
      const firstEvent = activeEventsRes.data[0];
      if (firstEvent) {
        const asgRes = await request('GET', `/events/${firstEvent.id}/assignments`, undefined, token);
        if (asgRes.ok && asgRes.data) {
          await saveCachedData({
            activities: asgRes.data.activities,
            assignments: asgRes.data.assignments,
            participants: asgRes.data.participants,
          });
        }
      }
    }

    lastSyncTime = new Date().toISOString();
    return { success: true, syncedCount, errors };
  } catch (err) {
    console.error('Sync failed:', err);
    return { success: false, syncedCount, errors };
  } finally {
    isSyncRunning = false;
    notifySyncListeners();
  }
}

function getPersianErrorMessage(code?: string, rawMsg?: string): string {
  if (code === 'FORBIDDEN') return 'به این فرد یا فعالیت دسترسی ندارید.';
  if (code === 'ACTIVITY_CLOSED') return 'این فعالیت بسته شده و ثبت جدید امکان‌پذیر نیست.';
  if (code === 'EVENT_NOT_ACTIVE') return 'دوره در وضعیت فعال قرار ندارد.';
  if (code === 'VALIDATION') return rawMsg || 'اطلاعات مشاهده معتبر نیست.';
  return rawMsg || 'خطای ناشناخته در تأیید سرور.';
}

/**
 * Initializes listeners for:
 * - online event
 * - visibility change (foreground)
 * - 30-second interval
 */
export function initSyncEngine(getToken: () => string | null): () => void {
  const trigger = () => {
    const token = getToken();
    if (token) runSync(token);
  };

  // Browser online listener
  const onOnline = () => trigger();
  window.addEventListener('online', onOnline);

  // Visibility change
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') trigger();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // 30 seconds interval
  syncIntervalId = setInterval(() => {
    trigger();
  }, 30000);

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (syncIntervalId) clearInterval(syncIntervalId);
  };
}
