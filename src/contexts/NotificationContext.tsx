import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Notification, NotificationAction, NotificationType } from '../types';
import { notifReducer, initialNotifState } from '../reducers/notifReducer';

interface NotifState {
  queue: Notification[];
  history: Notification[];
}

interface NotificationContextValue {
  state: NotifState;
  dispatch: Dispatch<NotificationAction>;
  notify: (type: NotificationType, title: string, message: string) => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notifReducer, initialNotifState);

  function notify(type: NotificationType, title: string, message: string) {
    dispatch({
      type: 'PUSH',
      payload: {
        type,
        title,
        message,
        dedupKey: `${type}:${title}`,
      },
    });
  }

  // Last non-dismissed info/success notification for polite live region
  const lastPolite = [...state.queue]
    .reverse()
    .find(n => !n.dismissed && (n.type === 'info' || n.type === 'success'));

  // Last non-dismissed error notification for assertive live region
  const lastError = [...state.queue]
    .reverse()
    .find(n => !n.dismissed && n.type === 'error');

  return (
    <NotificationContext.Provider value={{ state, dispatch, notify }}>
      <div aria-live="polite" aria-atomic="false" className="sr-only" id="notif-live-region">
        {lastPolite?.title}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" id="notif-assertive-region">
        {lastError?.title}
      </div>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
