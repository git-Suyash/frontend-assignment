/**
 * priceValidation
 *
 * Two complementary price integrity checks run at checkout time:
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
 * Neither function mutates state — they return results for the caller
 * (validateCheckout) to decide how to respond.
 */

import type { CartItem } from '../types';

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
