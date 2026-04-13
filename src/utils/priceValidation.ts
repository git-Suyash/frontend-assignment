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
