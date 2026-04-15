/**
 * useProducts
 *
 * Manages the product catalog with a stale-while-revalidate caching strategy
 * backed by IndexedDB (via catalogDb.ts).
 *
 * Load sequence:
 *   1. Check IDB cache on mount.
 *      - If fresh (< 24 h old): serve from cache, skip network.
 *      - If stale: serve from cache immediately (instant render), then
 *        revalidate from network in the background.
 *      - If no cache AND offline: surface an error message.
 *      - If no cache AND online: fetch from network, write to IDB.
 *   2. When `isOnline` transitions false→true after a stale-cache load,
 *      trigger a background revalidation if the cache is still stale.
 *
 * `applyProducts` is an internal helper that:
 *   - Updates displayed products and categories.
 *   - Dispatches SET_BASELINE_SNAPSHOT to cart state so the price-tampering
 *     check at checkout has a trusted reference of prices at page-load time.
 *
 * `catalogSource` tells the UI whether it is showing live, cached, or
 * stale-cached data so it can render the appropriate staleness banner.
 */

import { useState, useEffect, useRef } from 'react';
import type { Product } from '../types';
import { fetchProducts, fetchCategories } from '../services/api';
import { expandProducts } from '../utils/expandProducts';
import { useCart } from './useCart';
import { useOnlineStatus } from './useOnlineStatus';
import {
  getCachedCatalog,
  setCachedCatalog,
  isCatalogStale,
  CATALOG_TTL_MS,
} from '../utils/catalogDb';
import { logger } from '../utils/logger';

export type CatalogSource = 'network' | 'cache' | 'stale-cache';

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  categories: string[];
  catalogSource: CatalogSource;
  revalidating: boolean;
}

export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('network');
  const [revalidating, setRevalidating] = useState(false);

  const { dispatch } = useCart();
  const { isOnline } = useOnlineStatus();

  // Track whether we've already loaded an initial catalog this session so that
  // the online→offline→online transition doesn't trigger a redundant refetch.
  const loadedAtRef = useRef<number | null>(null);

  function applyProducts(expanded: Product[], cats: string[], source: CatalogSource) {
    const priceMap: Record<number, number> = {};
    for (const p of expanded) {
      priceMap[p.id] = p.price;
    }
    dispatch({ type: 'SET_BASELINE_SNAPSHOT', payload: priceMap });
    setProducts(expanded);
    setCategories(cats);
    setCatalogSource(source);
  }

  // ── Background network revalidation ──────────────────────────────────────
  // Fetches fresh data, writes to IDB, and silently updates UI state.
  // Called when: cache is stale AND we are online.
  async function revalidateFromNetwork(cancelled: () => boolean) {
    setRevalidating(true);
    logger.info('pwa', 'Revalidating catalog from network…');
    try {
      const [raw, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      if (cancelled()) return;

      const expanded = expandProducts(raw, 500);
      await setCachedCatalog(expanded, cats);
      if (cancelled()) return;

      applyProducts(expanded, cats, 'network');
      loadedAtRef.current = Date.now();
      logger.info('pwa', 'Catalog revalidated and IDB cache updated', {
        productCount: expanded.length,
      });
    } catch (err) {
      // Revalidation failure is non-fatal — we're already showing cached data
      logger.warn('pwa', 'Background revalidation failed', err);
    } finally {
      if (!cancelled()) setRevalidating(false);
    }
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false;
    const cancelled = () => isCancelled;

    async function load() {
      setLoading(true);
      setError(null);

      // ── Step 1: Try IDB cache ───────────────────────────────────────────
      const cached = await getCachedCatalog();

      if (cached) {
        const stale = isCatalogStale(cached.cachedAt);
        const ageMin = Math.round((Date.now() - cached.cachedAt) / 60_000);

        if (stale) {
          logger.info('pwa', `IDB cache found but stale (${ageMin} min old, TTL ${CATALOG_TTL_MS / 60_000} min)`);
        } else {
          logger.info('pwa', `Serving catalog from IDB cache (${ageMin} min old)`);
        }

        // Serve cached data immediately — UI renders instantly
        if (!isCancelled) {
          applyProducts(cached.products, cached.categories, stale ? 'stale-cache' : 'cache');
          loadedAtRef.current = cached.cachedAt;
          setLoading(false);
        }

        // If stale and online → revalidate in background
        if (stale && isOnline && !isCancelled) {
          revalidateFromNetwork(cancelled);
        }

        return;
      }

      // ── Step 2: No IDB cache — must go to network ───────────────────────
      if (!isOnline) {
        if (!isCancelled) {
          setError('You are offline and no cached catalog is available. Connect to the internet to load products.');
          setLoading(false);
        }
        return;
      }

      logger.info('pwa', 'No IDB cache found — fetching from network…');
      try {
        const [raw, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
        if (isCancelled) return;

        const expanded = expandProducts(raw, 500);
        // Write to IDB (fire-and-forget — failure is non-fatal)
        setCachedCatalog(expanded, cats);

        applyProducts(expanded, cats, 'network');
        loadedAtRef.current = Date.now();
      } catch (err) {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    load();
    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once on mount; the online→stale revalidation path is handled below

  // ── Re-check staleness when coming back online ────────────────────────────
  // If the app was loaded offline with a stale cache and the user reconnects,
  // trigger a background revalidation.
  useEffect(() => {
    if (!isOnline || loadedAtRef.current === null) return;
    if (!isCatalogStale(loadedAtRef.current)) return;
    if (revalidating) return;

    let isCancelled = false;
    revalidateFromNetwork(() => isCancelled);
    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return { products, loading, error, categories, catalogSource, revalidating };
}
