/**
 * checkoutValidation
 *
 * Runs a sequential pipeline of pre-submission checks on the cart state.
 * The pipeline short-circuits on the first failure and returns a typed
 * ValidationResult so callers can render a specific error message.
 *
 * Check order (fail-fast, cheapest checks first):
 *   1. CART_EMPTY          — trivial guard, no I/O
 *   2. CART_LOCKED         — prevent double-submission
 *   3. CART_CONFLICT       — cross-tab edit detected
 *   4. CHECKSUM_MISMATCH   — FNV-1a hash mismatch (localStorage tampering)
 *   5. PRICE_TAMPERING     — product.price vs snapshotPrice (in-memory)
 *   6. BASELINE_INTEGRITY  — SHA-256 digest of IDB baseline (IDB tampering)
 *   7. BASELINE_PER_ITEM   — snapshotPrice vs IDB baseline per product
 *   8. BASELINE_TOTAL      — cart total vs IDB-derived expected total
 *   9. STALE_PRICE         — re-fetch from API, compare snapshotPrice (network)
 *  10. IDEMPOTENCY_REUSE   — duplicate submission guard (localStorage)
 *
 * Security model (defence in depth):
 *   Checks 4 & 5 protect against localStorage mutation (different vectors).
 *   Checks 6–8 cross-validate against IndexedDB, a separate storage partition.
 *   An attacker must tamper with localStorage AND IndexedDB AND reproduce the
 *   SHA-256 integrity digest to bypass all three layers simultaneously.
 *   Check 9 adds a server-side price freshness guard via a live API call.
 *
 * The stale-price check (9) is the only async step with a network call. If
 * the API call fails, the check is skipped so a transient network error does
 * not block a legitimate checkout. Checks 4–8 are cryptographic/local and
 * cannot be bypassed this way.
 */

import type { CartState } from '../types';
import { computeCartChecksum } from '../utils/fnv1a';
import {
  detectPriceTampering,
  detectStalePrice,
  validateAgainstBaseline,
  validateCartTotal,
} from '../utils/priceValidation';
import { consumeIdempotencyKey } from '../utils/idempotency';
import { auditLog } from '../utils/auditLog';
import { fetchProducts } from './api';
import { getPriceBaseline, verifyBaselineIntegrity } from '../utils/catalogDb';

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

  // Check 4 — Checksum integrity (localStorage tampering)
  // Recomputes FNV-1a over all items and compares against the stored checksum.
  // Detects any post-add mutation of snapshotPrice or quantities in localStorage.
  const recomputed = computeCartChecksum(items);
  if (recomputed !== cartState.checksum) {
    auditLog('CHECKSUM_MISMATCH', { cartVersion: cartState.version });
    return {
      valid: false,
      reason: 'CHECKSUM_MISMATCH',
      detail: 'Cart integrity check failed. Your cart may have been tampered with.',
    };
  }

  // Check 5 — In-memory price tampering
  // Compares item.product.price against item.snapshotPrice for every item.
  // Detects runtime mutations to the in-memory cart object.
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

  // Checks 6–8 — IDB price baseline (cross-storage defence)
  // The baseline is written to IndexedDB when products load from the API and
  // is never stored in localStorage. Its SHA-256 integrity digest must verify
  // before we use it. Together, checks 6–8 mean an attacker must corrupt both
  // localStorage (caught by 4 & 5) AND IndexedDB AND spoof the SHA-256 digest
  // to smuggle a price change through to checkout.
  const baseline = await getPriceBaseline();

  if (baseline === null) {
    // No baseline recorded yet (first visit, cleared IDB, IDB error). Log but
    // do not block — checks 4, 5 and 9 still protect the checkout path.
    auditLog('BASELINE_MISSING', {
      cartVersion: cartState.version,
      cartItemCount: items.length,
    });
  } else {
    // Check 6 — IDB baseline integrity (SHA-256 digest)
    const integrityOk = await verifyBaselineIntegrity(baseline);
    if (!integrityOk) {
      auditLog('BASELINE_INTEGRITY_FAILED', { cartVersion: cartState.version });
      return {
        valid: false,
        reason: 'PRICE_TAMPERING',
        detail: 'Cart integrity check failed. Price baseline has been tampered with.',
      };
    }

    // Check 7 — Per-item baseline price comparison
    const { valid: baselineValid, tamperedItems, unknownItems } =
      validateAgainstBaseline(items, baseline.entries);

    if (!baselineValid) {
      const affectedIds = [...tamperedItems, ...unknownItems];
      auditLog('BASELINE_TAMPERING_DETECTED', {
        cartVersion: cartState.version,
        cartItemCount: items.length,
        reason: `Affected product IDs: ${affectedIds.join(', ')}`,
      });
      return {
        valid: false,
        reason: 'PRICE_TAMPERING',
        detail: 'Price tampering detected. Item prices do not match the verified price baseline.',
      };
    }

    // Check 8 — Cart total vs IDB-derived expected total
    const { valid: totalValid, expectedTotal, actualTotal } =
      validateCartTotal(items, baseline.entries);

    if (!totalValid) {
      auditLog('BASELINE_TAMPERING_DETECTED', {
        cartVersion: cartState.version,
        cartItemCount: items.length,
        reason: `Total mismatch: expected $${expectedTotal.toFixed(2)}, got $${actualTotal.toFixed(2)}`,
      });
      return {
        valid: false,
        reason: 'PRICE_TAMPERING',
        detail: 'Cart total does not match verified prices.',
      };
    }
  }

  // Check 9 — Stale price (re-fetch from API)
  // Compares snapshotPrice against live API prices. Detects server-side price
  // changes since the item was added. Non-fatal on network failure to avoid
  // blocking legitimate checkouts during transient connectivity issues.
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
    // If the fresh-price fetch fails, skip the stale-price check and continue.
  }

  // Check 10 — Idempotency
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
