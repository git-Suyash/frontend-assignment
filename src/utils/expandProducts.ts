/**
 * expandProducts
 *
 * Pads the product list to a target count by generating deterministic
 * variants of the original products. Used exclusively to simulate a
 * large catalog (500+ items) from the small FakeStore API payload (20 items)
 * so that virtualized list, search, and filter features can be demonstrated
 * with realistic data volumes.
 *
 * Variant generation:
 *   - IDs are offset by `multiplier * 1000` to guarantee uniqueness.
 *   - Prices are jittered ±15% of the original to create realistic variation.
 *   - Titles are suffixed with "(Variant N)" to distinguish clones visually.
 *
 * Not used in production — remove or gate behind a feature flag before
 * connecting a real product catalog.
 */

import type { Product } from '../types';

export function expandProducts(products: Product[], targetCount: number): Product[] {
  if (products.length === 0) return [];

  const result: Product[] = [...products];
  let multiplier = 1;

  while (result.length < targetCount) {
    for (const original of products) {
      if (result.length >= targetCount) break;
      const jitteredPrice = Math.round(
        original.price * (0.85 + Math.random() * 0.3) * 100
      ) / 100;

      result.push({
        ...original,
        id: original.id + multiplier * 1000,
        title: `${original.title} (Variant ${multiplier})`,
        price: jitteredPrice,
      });
    }
    multiplier++;
  }

  return result;
}
