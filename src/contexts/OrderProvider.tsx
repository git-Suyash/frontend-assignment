/**
 * OrderProvider
 *
 * React context provider for order state. Owns the order reducer, handles
 * localStorage persistence, and restores interrupted checkouts after a
 * page refresh.
 *
 * Responsibilities:
 *   1. On mount, check if an in-progress (non-terminal) order was persisted
 *      from a previous session and replay its last known state.
 *   2. Persist every state change back to localStorage.
 *
 * Fast Refresh note:
 *   This file exports ONLY a React component, satisfying Vite's requirement
 *   that component files contain no mixed non-component exports.
 */

import { useReducer, useEffect, type ReactNode } from 'react';
import { OrderContext } from './OrderContext';
import { orderReducer, initialOrderState } from '../reducers/orderReducer';
import { persistOrder, loadOrder } from '../utils/storage';
import { isTerminal } from '../machines/orderStateMachine';

/** Wraps the application (or a subtree) with order state and dispatch. */
export function OrderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(orderReducer, initialOrderState);

  // ── Effect 1: Restore persisted order on mount ────────────────────────────
  // If the user refreshed mid-checkout, we pick up where they left off.
  // Terminal states (ORDER_SUCCESS, ROLLED_BACK) are NOT restored because
  // those represent completed flows that shouldn't be re-entered.
  useEffect(() => {
    const persisted = loadOrder();
    if (persisted && !isTerminal(persisted.current)) {
      dispatch({ type: 'TRANSITION', payload: { to: persisted.current } });
    }
  }, []);

  // ── Effect 2: Persist on every state change ───────────────────────────────
  // Serialises the order state to localStorage so that a refresh during
  // checkout doesn't silently drop the in-flight order.
  useEffect(() => {
    persistOrder(state);
  }, [state]);

  return (
    <OrderContext.Provider value={{ state, dispatch }}>
      {children}
    </OrderContext.Provider>
  );
}
