/**
 * notifReducer
 *
 * Pure reducer for the notification system. Manages an active queue (toasts
 * visible on screen) and a permanent history (the notification center log).
 *
 * Key design decisions:
 *   - PUSH deduplicates: a notification with the same dedupKey is suppressed
 *     if an identical one was pushed within the last 3 seconds.
 *   - DISMISS removes from the queue only; history is append-only.
 *   - History is capped at 200 entries (oldest trimmed) to bound memory use.
 */

import type { Notification, NotificationAction } from '../types';

/** State shape shared between the reducer and NotificationContext. */
export interface NotifState {
  /** Active toasts awaiting dismissal. */
  queue: Notification[];
  /** Permanent audit trail of all notifications, capped at 200 entries. */
  history: Notification[];
}

export const initialNotifState: NotifState = {
  queue: [],
  history: [],
};

export function notifReducer(state: NotifState, action: NotificationAction): NotifState {
  switch (action.type) {
    case 'PUSH': {
      const dedupKey = action.payload.dedupKey;
      const now = Date.now();
      const isDuplicate = state.queue.some(
        n => !n.dismissed && n.dedupKey === dedupKey && now - n.timestamp < 3000
      );
      if (isDuplicate) return state;

      const notification: Notification = {
        ...action.payload,
        id: crypto.randomUUID(),
        timestamp: now,
        dismissed: false,
      };

      const newHistory = [...state.history, notification];
      // Cap history at 200
      const trimmedHistory =
        newHistory.length > 200 ? newHistory.slice(newHistory.length - 200) : newHistory;

      return {
        queue: [...state.queue, notification],
        history: trimmedHistory,
      };
    }

    case 'DISMISS':
      // Remove from active queue; history already holds the permanent record
      return {
        ...state,
        queue: state.queue.filter(n => n.id !== action.payload.id),
      };

    case 'DISMISS_ALL':
      return { ...state, queue: [] };

    case 'CLEAR_HISTORY':
      return { ...state, history: [], queue: [] };

    default:
      return state;
  }
}
