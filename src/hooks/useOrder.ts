/**
 * useOrder
 *
 * Convenience hook that reads from OrderContext and provides a guard against
 * accidental use outside the provider tree.
 *
 * Usage:
 *   const { state, dispatch } = useOrder();
 *
 * Throws if called outside <OrderProvider>.
 */

import { useContext } from 'react';
import { OrderContext, type OrderContextValue } from '../contexts/OrderContext';

/**
 * Returns the current order state and its dispatch function.
 *
 * @throws {Error} When used outside of <OrderProvider>.
 */
export function useOrder(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within OrderProvider');
  return ctx;
}
