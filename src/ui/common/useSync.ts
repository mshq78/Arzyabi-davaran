import { useEffect, useState } from 'react';
import { getReviewItems, dismissReviewItem, getPendingOutboxItems } from '../../client/offline/outbox';
import { ReviewItem } from '../../client/offline/db';
import {
  getIsSyncing,
  getLastSyncTime,
  runSync,
  subscribeSyncEvents,
} from '../../client/offline/syncEngine';
import { getSimulatedOffline, subscribeTransportStatus } from '../../client/transport';
import { getStoredAuthToken } from '../../client/api';
import { formatShamsiTime } from '../../domain/dateUtils';

export function useSync() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return (
      (typeof navigator !== 'undefined' ? navigator.onLine : true) &&
      !getSimulatedOffline()
    );
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(getIsSyncing);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [lastSyncStr, setLastSyncStr] = useState<string | null>(null);

  const refreshState = async () => {
    setIsSyncing(getIsSyncing());
    const online =
      (typeof navigator !== 'undefined' ? navigator.onLine : true) &&
      !getSimulatedOffline();
    setIsOnline(online);

    try {
      const items = await getPendingOutboxItems();
      setPendingCount(items.length);

      const reviews = await getReviewItems();
      setReviewItems(reviews.filter((r) => !r.dismissed));

      const last = getLastSyncTime();
      setLastSyncStr(last ? formatShamsiTime(last) : null);
    } catch (e) {
      console.warn('Could not read pending counts:', e);
    }
  };

  useEffect(() => {
    refreshState();

    const unsubSync = subscribeSyncEvents(refreshState);
    const unsubTransport = subscribeTransportStatus(refreshState);

    const onOnline = () => refreshState();
    const onOffline = () => refreshState();

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const interval = setInterval(refreshState, 2000);

    return () => {
      unsubSync();
      unsubTransport();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerManualSync = async () => {
    const token = getStoredAuthToken();
    if (token) {
      await runSync(token);
      await refreshState();
    }
  };

  const handleDismiss = async (offlineUuid: string) => {
    await dismissReviewItem(offlineUuid);
    await refreshState();
  };

  return {
    isOnline,
    isSyncing,
    pendingCount,
    reviewItems,
    lastSyncTime: lastSyncStr,
    triggerManualSync,
    dismissReview: handleDismiss,
  };
}
