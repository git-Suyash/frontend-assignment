/**
 * useCart
 *
 * Convenience hook that reads from CartContext and provides a guard against
 * accidental use outside the provider tree.
 *
 * Usage:
 *   const { state, dispatch } = useCart();
 *
 * Throws if called outside <CartProvider>.
 */

import { useContext } from 'react';
import { CartContext, type CartContextValue } from '../contexts/CartContext';

/**
 * Returns the current cart state and its dispatch function.
 *
 * @throws {Error} When used outside of <CartProvider>.
 */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
