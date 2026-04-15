/**
 * CartContext
 *
 * Creates and exports the React context object for the shopping cart.
 * This file is intentionally kept to a single responsibility: context creation.
 *
 * Separation rationale:
 *   - Keeping the context object in its own file lets both CartProvider and
 *     useCart import it without circular dependencies.
 *   - Vite Fast Refresh requires that every .tsx file export ONLY React
 *     components. Isolating the context object here (no JSX, no component
 *     export) satisfies that constraint.
 *
 * Consumers:
 *   - CartProvider  (src/contexts/CartProvider.tsx) — wraps the app tree
 *   - useCart       (src/hooks/useCart.ts)           — reads the context
 */

import { createContext, type Dispatch } from 'react';
import type { CartState, CartAction } from '../types';

/** Shape of the value held in CartContext. */
export interface CartContextValue {
  /** Full cart state (items, version, checksum, status, …). */
  state: CartState;
  /** Reducer dispatch — send CartAction messages to mutate state. */
  dispatch: Dispatch<CartAction>;
}

/**
 * The cart context itself. Initialised to `null` so that `useCart` can
 * throw a helpful error when consumed outside its provider, rather than
 * silently operating on a default value.
 */
export const CartContext = createContext<CartContextValue | null>(null);
