import type { Notification, NotificationAction } from '../types';

interface NotifState {
  queue: Notification[];
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
