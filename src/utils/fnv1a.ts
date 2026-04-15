/**
 * fnv1a
 *
 * Implements a 32-bit FNV-1a (Fowler–Noll–Vo) hash over the cart item list.
 * The hash is used as a tamper-detection checksum: it is computed on every
 * cart mutation and re-verified at checkout time.
 *
 * Why FNV-1a?
 *   - Extremely fast for short strings (no crypto overhead).
 *   - Deterministic and order-independent (items are sorted by product ID
 *     before serialisation) so the same logical cart always produces the
 *     same hash regardless of insertion order.
 *   - Not a security primitive — it only detects naive client-side mutations
 *     (e.g., editing localStorage). The server must always revalidate prices.
 *
 * Serialisation format per item: `"<id>:<qty>:<price>"` separated by `|`.
 * Including snapshotPrice means a price change between "add" and "checkout"
 * will produce a different hash, triggering CHECKSUM_MISMATCH.
 */

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
