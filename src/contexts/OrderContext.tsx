/**
 * OrderContext
 *
 * Creates and exports the React context object for order state.
 * This file is intentionally kept to a single responsibility: context creation.
 *
 * Separation rationale:
 *   - Isolating the context object prevents Fast Refresh warnings that fire
 *     when a .tsx file exports both React components and non-component values.
 *   - Both OrderProvider and useOrder can import from here without creating
 *     circular dependencies.
 *
 * Consumers:
 *   - OrderProvider  (src/contexts/OrderProvider.tsx) — wraps the app tree
 *   - useOrder       (src/hooks/useOrder.ts)           — reads the context
 */

import { createContext, type Dispatch } from 'react';
import type { OrderState, OrderAction } from '../types';

/** Shape of the value held in OrderContext. */
export interface OrderContextValue {
  /** Current order state machine state plus metadata (orderId, retryCount, …). */
  state: OrderState;
  /** Reducer dispatch — send OrderAction messages to drive state transitions. */
  dispatch: Dispatch<OrderAction>;
}

/**
 * The order context itself. Initialised to `null` so that `useOrder` can
 * throw a descriptive error when consumed outside its provider.
 */
export const OrderContext = createContext<OrderContextValue | null>(null);
