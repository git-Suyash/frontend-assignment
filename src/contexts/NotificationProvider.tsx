/**
 * NotificationProvider
 *
 * React context provider for the notification system. Owns the notification
 * reducer and renders two ARIA live regions so screen readers announce
 * toasts without the user having to focus them.
 *
 * Responsibilities:
 *   1. Expose the `notify` helper so consumers never construct raw PUSH
 *      actions or dedupKeys themselves.
 *   2. Render a `polite` live region for success/info toasts (announced at
 *      the next idle moment, not interrupting the user).
 *   3. Render an `assertive` live region for error toasts (announced
 *      immediately, even mid-sentence).
 *
 * Fast Refresh note:
 *   This file exports ONLY a React component, satisfying Vite's requirement
 *   that component files contain no mixed non-component exports.
 */

import { useReducer, type ReactNode } from 'react';
import { NotificationContext } from './NotificationContext';
import { notifReducer, initialNotifState } from '../reducers/notifReducer';
import type { NotificationType } from '../types';

/** Wraps the application (or a subtree) with notification state and helpers. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notifReducer, initialNotifState);

  /**
   * Builds a PUSH action with an auto-generated dedupKey and dispatches it.
   * The dedupKey format is `"${type}:${title}"` — duplicate notifications
   * within a 3-second window are silently dropped by the reducer.
   */
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

  // ── ARIA live region targets ───────────────────────────────────────────────
  // We pick the most-recent undismissed notification of each severity class
  // and render its title into a visually-hidden element. Screen readers
  // announce changes to live regions automatically.

  /** Most-recent undismissed success or info notification (polite). */
  const lastPolite = [...state.queue]
    .reverse()
    .find(n => !n.dismissed && (n.type === 'info' || n.type === 'success'));

  /** Most-recent undismissed error notification (assertive). */
  const lastError = [...state.queue]
    .reverse()
    .find(n => !n.dismissed && n.type === 'error');

  return (
    <NotificationContext.Provider value={{ state, dispatch, notify }}>
      {/* Polite region: announced at the next idle moment */}
      <div aria-live="polite" aria-atomic="false" className="sr-only" id="notif-live-region">
        {lastPolite?.title}
      </div>
      {/* Assertive region: announced immediately, used for errors */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only" id="notif-assertive-region">
        {lastError?.title}
      </div>
      {children}
    </NotificationContext.Provider>
  );
}
