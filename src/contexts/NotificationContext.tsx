/**
 * NotificationContext
 *
 * Creates and exports the React context object for the notification system.
 * This file is intentionally kept to a single responsibility: context creation.
 *
 * Separation rationale:
 *   - Isolating the context object prevents Fast Refresh warnings that fire
 *     when a .tsx file exports both React components and non-component values.
 *   - Both NotificationProvider and useNotification can import from here
 *     without creating circular dependencies.
 *
 * Consumers:
 *   - NotificationProvider  (src/contexts/NotificationProvider.tsx) — wraps the app tree
 *   - useNotification       (src/hooks/useNotification.ts)           — reads the context
 */

import { createContext, type Dispatch } from 'react';
import type { NotificationAction, NotificationType } from '../types';
import type { NotifState } from '../reducers/notifReducer';

/** Shape of the value held in NotificationContext. */
export interface NotificationContextValue {
  /** Notification queue (active toasts) and history (notification center). */
  state: NotifState;
  /** Low-level reducer dispatch for DISMISS / DISMISS_ALL / CLEAR_HISTORY. */
  dispatch: Dispatch<NotificationAction>;
  /**
   * High-level helper — builds and enqueues a notification.
   * Prefer this over dispatching PUSH directly; it handles dedupKey construction.
   *
   * @param type    Visual severity: 'success' | 'warning' | 'error' | 'info'
   * @param title   Short heading shown in the toast.
   * @param message Supporting detail shown below the title.
   */
  notify: (type: NotificationType, title: string, message: string) => void;
}

/**
 * The notification context itself. Initialised to `null` so that
 * `useNotification` can throw a descriptive error when consumed outside
 * its provider.
 */
export const NotificationContext = createContext<NotificationContextValue | null>(null);
