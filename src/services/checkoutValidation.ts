/**
 * checkoutValidation
 *
 * Runs a sequential pipeline of pre-submission checks on the cart state.
 * The pipeline short-circuits on the first failure and returns a typed
 * ValidationResult so callers can render a specific error message.
 *
 * Check order (fail-fast, cheapest checks first):
 *   1. CART_EMPTY        — trivial guard, no I/O
 *   2. CART_LOCKED       — prevent double-submission
 *   3. CART_CONFLICT     — cross-tab edit detected
 *   4. CHECKSUM_MISMATCH — FNV-1a hash mismatch (in-memory tampering)
 *   5. PRICE_TAMPERING   — product.price vs snapshotPrice (in-memory)
 *   6. STALE_PRICE       — re-fetch from API, compare snapshotPrice (network)
 *   7. IDEMPOTENCY_REUSE — duplicate submission guard (localStorage)
 *
 * The stale-price check (step 6) is the only async step. If the API call
 * fails, the check is skipped to avoid blocking a legitimate checkout due
 * to a transient network error. All security-relevant checks (4, 5) are
 * synchronous and cannot be bypassed this way.
 */

import type { CartState } from '../types';
import { computeCartChecksum } from '../utils/fnv1a';
import { detectPriceTampering, detectStalePrice } from '../utils/priceValidation';
import { consumeIdempotencyKey } from '../utils/idempotency';
import { auditLog } from '../utils/auditLog';
import { fetchProducts } from './api';

export type ValidationFailureReason =
  | 'CART_EMPTY'
  | 'CART_LOCKED'
  | 'CHECKSUM_MISMATCH'
  | 'PRICE_TAMPERING'
  | 'STALE_PRICE'
  | 'IDEMPOTENCY_REUSE'
  | 'CART_CONFLICT';

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: ValidationFailureReason; detail: string };

export async function validateCheckout(cartState: CartState): Promise<ValidationResult> {
  const { items } = cartState;

  // Check 1 — Empty cart
  if (items.length === 0) {
    return { valid: false, reason: 'CART_EMPTY', detail: 'Your cart is empty.' };
  }

  // Check 2 — Cart locked
  if (cartState.status === 'locked') {
    return { valid: false, reason: 'CART_LOCKED', detail: 'A checkout is already in progress.' };
  }

  // Check 3 — Cart conflict (cross-tab)
  if (cartState.status === 'conflict') {
    return {
      valid: false,
      reason: 'CART_CONFLICT',
      detail: 'Your cart was modified in another tab. Please review before checking out.',
    };
  }

  // Check 4 — Checksum integrity
  const recomputed = computeCartChecksum(items);
  if (recomputed !== cartState.checksum) {
    auditLog('CHECKSUM_MISMATCH', { cartVersion: cartState.version });
    return {
      valid: false,
      reason: 'CHECKSUM_MISMATCH',
      detail: 'Cart integrity check failed. Your cart may have been tampered with.',
    };
  }

  // Check 5 — Price tampering (in-memory)
  if (detectPriceTampering(items)) {
    auditLog('PRICE_TAMPERING_DETECTED', {
      cartVersion: cartState.version,
      cartItemCount: items.length,
    });
    return {
      valid: false,
      reason: 'PRICE_TAMPERING',
      detail: 'Price tampering detected. Item prices do not match their locked values.',
    };
  }

  // Check 6 — Stale price (re-fetch from API)
  try {
    const freshProducts = await fetchProducts();
    const freshPrices: Record<number, number> = {};
    for (const p of freshProducts) {
      freshPrices[p.id] = p.price;
    }

    const { stale, changedItems } = detectStalePrice(items, freshPrices);
    if (stale) {
      auditLog('STALE_PRICE_DETECTED', {
        cartVersion: cartState.version,
        cartItemCount: items.length,
        reason: `Changed product IDs: ${changedItems.join(', ')}`,
      });
      return {
        valid: false,
        reason: 'STALE_PRICE',
        detail: `Prices have changed for ${changedItems.length} item(s) since you added them. Please review your cart.`,
      };
    }
  } catch {
    // If the fresh-price fetch fails, skip the stale-price check and continue
  }

  // Check 7 — Idempotency
  if (!consumeIdempotencyKey(cartState.idempotencyKey)) {
    auditLog('IDEMPOTENCY_BLOCK', {
      cartVersion: cartState.version,
      reason: 'Duplicate idempotency key',
    });
    return {
      valid: false,
      reason: 'IDEMPOTENCY_REUSE',
      detail: 'This order has already been submitted. Please refresh and try again.',
    };
  }

  // All checks passed
  auditLog('CHECKOUT_VALIDATED', {
    cartVersion: cartState.version,
    cartItemCount: items.length,
  });
  return { valid: true };
}
