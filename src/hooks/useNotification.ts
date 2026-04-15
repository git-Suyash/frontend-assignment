/**
 * useNotification
 *
 * Convenience hook that reads from NotificationContext and provides a guard
 * against accidental use outside the provider tree.
 *
 * Usage:
 *   const { notify, state, dispatch } = useNotification();
 *
 * Most consumers only need `notify`:
 *   notify('success', 'Order placed', 'Your order #123 is confirmed.');
 *
 * Throws if called outside <NotificationProvider>.
 */

import { useContext } from 'react';
import { NotificationContext, type NotificationContextValue } from '../contexts/NotificationContext';

/**
 * Returns the notification state, raw dispatch, and the `notify` helper.
 *
 * @throws {Error} When used outside of <NotificationProvider>.
 */
export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
