import type { Product } from '../types';

export type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'rating-desc';

export function useProductFilter(
  products: Product[],
  searchQuery: string,
  category: string,
  sortBy: SortOption
): Product[] {
  // 1. Filter by category
  let filtered = category === 'all'
    ? products
    : products.filter(p => p.category === category);

  // 2. Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  // 3. Sort
  const sorted = [...filtered];
  switch (sortBy) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'rating-desc':
      sorted.sort((a, b) => b.rating.rate - a.rating.rate);
      break;
    default:
      break;
  }

  return sorted;
}
