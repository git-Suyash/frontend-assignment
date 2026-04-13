import type { CartItem } from '../types';

export function computeCartChecksum(items: CartItem[]): string {
  const sorted = [...items].sort((a, b) => a.product.id - b.product.id);
  const serialized = sorted
    .map(item => `${item.product.id}:${item.quantity}:${item.snapshotPrice.toFixed(2)}`)
    .join('|');

  // FNV-1a 32-bit
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}
