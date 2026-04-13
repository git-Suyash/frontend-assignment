import { useState, useEffect } from 'react';
import type { Product } from '../types';
import { fetchProducts, fetchCategories } from '../services/api';
import { expandProducts } from '../utils/expandProducts';
import { useCart } from '../contexts/CartContext';

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  categories: string[];
}

export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const { dispatch } = useCart();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [raw, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
        if (cancelled) return;

        const expanded = expandProducts(raw, 600);

        // Build baseline price map from ALL expanded products keyed by synthetic ID
        const priceMap: Record<number, number> = {};
        for (const p of expanded) {
          priceMap[p.id] = p.price;
        }

        dispatch({ type: 'SET_BASELINE_SNAPSHOT', payload: priceMap });
        setProducts(expanded);
        setCategories(cats);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [dispatch]);

  return { products, loading, error, categories };
}
