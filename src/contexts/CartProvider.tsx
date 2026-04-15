/**
 * CartProvider
 *
 * React context provider for the shopping cart. Owns the cart reducer,
 * drives localStorage persistence, and synchronises state across browser tabs.
 *
 * Responsibilities:
 *   1. Hydrate cart state from localStorage on first mount.
 *   2. Persist every state change back to localStorage.
 *   3. Listen for `storage` events so that cart edits in a second tab are
 *      reflected here without a page reload.
 *
 * Fast Refresh note:
 *   This file exports ONLY a React component, satisfying Vite's requirement
 *   that component files contain no mixed non-component exports.
 */

import { useReducer, useEffect, type ReactNode } from 'react';
import { CartContext } from './CartContext';
import { cartReducer, initialCartState } from '../reducers/cartReducer';
import { persistCart, loadCart, CART_STORAGE_KEY } from '../utils/storage';
import type { CartState } from '../types';

/** Wraps the application (or a subtree) with cart state and dispatch. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  // ── Effect 1: Hydrate from localStorage on mount ──────────────────────────
  // Runs once. Reads any previously persisted cart state from localStorage.
  // Price baseline validation is handled via IndexedDB (see catalogDb.ts) and
  // is performed at checkout time, not at hydration time.
  useEffect(() => {
    const persisted = loadCart();
    if (persisted) {
      dispatch({ type: 'SYNC_FROM_STORAGE', payload: persisted });
    }
  }, []);

  // ── Effect 2: Persist on every state change ───────────────────────────────
  // Serialises the full cart state to localStorage after each dispatch so the
  // cart survives page refreshes and tab restores.
  useEffect(() => {
    persistCart(state);
  }, [state]);

  // ── Effect 3: Cross-tab synchronisation ───────────────────────────────────
  // The `storage` event fires in all tabs EXCEPT the one that wrote the value.
  // We compare version numbers before applying the incoming state so that a
  // stale echo (same version, different tab) is silently ignored.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as CartState;
          if (parsed.version !== state.version) {
            dispatch({ type: 'SYNC_FROM_STORAGE', payload: parsed });
          }
        } catch {
          // Ignore malformed storage values written by other extensions or tabs.
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [state.version]);

  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}
