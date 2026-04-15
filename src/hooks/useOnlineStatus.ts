/**
 * useOnlineStatus
 *
 * Subscribes to the browser's online/offline events and exposes the current
 * network status as a reactive boolean.
 *
 * Initialises from `navigator.onLine` so the value is correct on first render
 * without waiting for an event.
 *
 * Used by:
 *   - useProducts   — skips network fetch and surfaces an error when offline
 *   - App (OfflineBanner) — shows the sticky offline banner
 */

import { useState, useEffect } from 'react';

export function useOnlineStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
