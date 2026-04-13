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
