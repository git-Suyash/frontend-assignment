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
