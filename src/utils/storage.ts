/**
 * storage
 *
 * Thin localStorage wrappers for persisting cart and order state across
 * page refreshes and browser restarts.
 *
 * Why separate keys?
 *   - CART_STORAGE_KEY is also watched by the cross-tab sync listener in
 *     CartProvider, so it must not be conflated with order state.
 *   - ORDER_STORAGE_KEY lets OrderProvider independently restore an in-flight
 *     checkout without touching cart state.
 *
 * All read/write operations are wrapped in try/catch because:
 *   - localStorage can throw in private browsing mode (QuotaExceededError).
 *   - JSON.parse can throw on corrupted values written by other extensions.
 *
 * `clearPersistedSession` is called after a successful order or rollback to
 * prevent a restored session from re-entering a completed checkout flow.
 */

import type { CartState, OrderState } from '../types';
import { auditLog } from './auditLog';

export const CART_STORAGE_KEY = 'checkout_cart';
export const ORDER_STORAGE_KEY = 'checkout_order';

export function persistCart(state: CartState): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch {
    auditLog('ORDER_INCONSISTENT', { reason: 'storage_write_failed' });
  }
}

export function loadCart(): CartState | null {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CartState;
  } catch {
    // ignore
  }
  return null;
}

export function persistOrder(state: OrderState): void {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    auditLog('ORDER_INCONSISTENT', { reason: 'storage_write_failed' });
  }
}

export function loadOrder(): OrderState | null {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as OrderState;
  } catch {
    // ignore
  }
  return null;
}

export function clearPersistedSession(): void {
  localStorage.removeItem(CART_STORAGE_KEY);
  localStorage.removeItem(ORDER_STORAGE_KEY);
}
