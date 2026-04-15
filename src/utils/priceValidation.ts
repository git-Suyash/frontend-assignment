/**
 * priceValidation
 *
 * Price integrity checks run at checkout time.
 *
 *   1. detectPriceTampering (in-memory, synchronous):
 *      Compares each item's `product.price` against its `snapshotPrice`.
 *      `snapshotPrice` is set once when the item is added and never mutated
 *      by the reducer. A mismatch indicates that someone edited the cart
 *      object in memory or localStorage after it was added.
 *
 *   2. detectStalePrice (network, asynchronous — called from checkoutValidation):
 *      Compares `snapshotPrice` against freshly fetched API prices. A delta
 *      greater than $0.01 means the product's price changed on the server
 *      since the customer added the item. The customer must review before
 *      we allow the order through.
 *
 *   3. validateAgainstBaseline (IDB, asynchronous — called from checkoutValidation):
 *      Compares each item's `snapshotPrice` against the IDB price baseline.
 *      The baseline is written to IndexedDB (separate storage from localStorage)
 *      when products first load from the API. Its SHA-256 integrity digest is
 *      verified before use. This cross-storage check catches attackers who
 *      modify both `snapshotPrice` AND the FNV-1a checksum in localStorage —
 *      they would also need to tamper with IDB and reproduce the SHA-256 hash.
 *
 *   4. validateCartTotal (synchronous — called from checkoutValidation):
 *      Recomputes the order total from baseline prices and compares it against
 *      the total derived from snapshotPrices. Provides a holistic sanity check
 *      in addition to the per-item comparisons.
 *
 * None of these functions mutate state — they return results for the caller
 * (validateCheckout) to decide how to respond.
 */

import type { CartItem } from '../types';
import type { PriceBaselineRecord } from './catalogDb';

export function detectPriceTampering(items: CartItem[]): boolean {
  return items.some(item => item.product.price !== item.snapshotPrice);
}

export function detectStalePrice(
  items: CartItem[],
  freshPrices: Record<number, number>
): { stale: boolean; changedItems: number[] } {
  const changedItems: number[] = [];

  for (const item of items) {
    const fresh = freshPrices[item.product.id];
    if (fresh !== undefined && Math.abs(fresh - item.snapshotPrice) > 0.01) {
      changedItems.push(item.product.id);
    }
  }

  return { stale: changedItems.length > 0, changedItems };
}

/**
 * Cross-storage baseline check.
 *
 * Compares each cart item's `snapshotPrice` against the IDB-stored baseline
 * price for that product. A mismatch means the snapshotPrice was altered after
 * the baseline was written — a stronger signal of tampering than the in-memory
 * check alone because it crosses storage boundaries (localStorage vs IDB).
 *
 * Items whose IDs are absent from the baseline are flagged separately. Products
 * must exist in the catalog to have a baseline entry; an unknown ID is
 * suspicious.
 */
export function validateAgainstBaseline(
  items: CartItem[],
  baseline: PriceBaselineRecord[]
): { valid: boolean; tamperedItems: number[]; unknownItems: number[] } {
  const baselineMap = new Map<number, number>(baseline.map(e => [e.id, e.price]));
  const tamperedItems: number[] = [];
  const unknownItems: number[] = [];

  for (const item of items) {
    const baselinePrice = baselineMap.get(item.product.id);
    if (baselinePrice === undefined) {
      unknownItems.push(item.product.id);
    } else if (Math.abs(baselinePrice - item.snapshotPrice) > 0.01) {
      tamperedItems.push(item.product.id);
    }
  }

  return {
    valid: tamperedItems.length === 0 && unknownItems.length === 0,
    tamperedItems,
    unknownItems,
  };
}

/**
 * Holistic total verification.
 *
 * Recomputes the expected cart total from IDB baseline prices and the actual
 * total from snapshotPrices. If all per-item checks pass, these will be equal.
 * This adds a final arithmetic cross-check that would catch any logic gap in
 * the per-item loop (e.g. a floating-point manipulation that slips past the
 * per-item $0.01 tolerance).
 *
 * Totals are rounded to 2 decimal places before comparison.
 */
export function validateCartTotal(
  items: CartItem[],
  baseline: PriceBaselineRecord[]
): { valid: boolean; expectedTotal: number; actualTotal: number } {
  const baselineMap = new Map<number, number>(baseline.map(e => [e.id, e.price]));

  let actualTotal = 0;
  let expectedTotal = 0;

  for (const item of items) {
    actualTotal += item.snapshotPrice * item.quantity;
    // For items not in baseline, fall back to snapshotPrice so the total
    // check is neutral on unknown items (unknownItems check handles those).
    const baselinePrice = baselineMap.get(item.product.id) ?? item.snapshotPrice;
    expectedTotal += baselinePrice * item.quantity;
  }

  const roundedActual = Math.round(actualTotal * 100) / 100;
  const roundedExpected = Math.round(expectedTotal * 100) / 100;

  return {
    valid: Math.abs(roundedActual - roundedExpected) < 0.01,
    expectedTotal: roundedExpected,
    actualTotal: roundedActual,
  };
}
