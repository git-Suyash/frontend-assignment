import type { Product } from '../types';
import { logger } from './logger';

const DB_NAME = 'opencart_catalog';
const DB_VERSION = 2; // Bumped: added price_baseline store
const STORE_NAME = 'cache';
const CATALOG_KEY = 'catalog';

const BASELINE_STORE = 'price_baseline';
const BASELINE_KEY = 'baseline';

export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CatalogCacheEntry {
  products: Product[];
  categories: string[];
  cachedAt: number;
}

export interface PriceBaselineRecord {
  id: number;
  price: number;
}

/**
 * Immutable snapshot of product prices as returned by the API at catalog-load
 * time. Stored in IndexedDB separately from cart state so it cannot be altered
 * by mutating localStorage. The `integrity` field is a SHA-256 hex digest of
 * the canonical serialisation; it is recomputed at checkout to detect IDB
 * tampering before any price comparison is made.
 */
export interface PriceBaselineEntry {
  entries: PriceBaselineRecord[];
  savedAt: number;
  integrity: string; // SHA-256 hex of sorted "id:price.toFixed(4)" pairs
}

// ─── DB open ─────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      // Create catalog cache store (v1)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      // Create price baseline store (v2)
      if (!db.objectStoreNames.contains(BASELINE_STORE)) {
        db.createObjectStore(BASELINE_STORE);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IDB blocked'));
  });
}

// ─── Integrity helpers ────────────────────────────────────────────────────────

/**
 * Produces a SHA-256 hex digest over the canonical form of the baseline
 * entries. Entries are sorted by id so insertion order cannot affect the hash.
 * Each entry is serialised as `<id>:<price.toFixed(4)>` and joined with `|`.
 */
async function computeBaselineIntegrity(entries: PriceBaselineRecord[]): Promise<string> {
  const sorted = [...entries].sort((a, b) => a.id - b.id);
  const canonical = sorted.map(e => `${e.id}:${e.price.toFixed(4)}`).join('|');
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Re-derives the integrity hash from a stored baseline entry and returns
 * whether it matches the stored `integrity` field.
 * A mismatch means the IDB record was modified after it was written.
 */
export async function verifyBaselineIntegrity(entry: PriceBaselineEntry): Promise<boolean> {
  const recomputed = await computeBaselineIntegrity(entry.entries);
  return recomputed === entry.integrity;
}

// ─── Catalog cache (public) ───────────────────────────────────────────────────

export async function getCachedCatalog(): Promise<CatalogCacheEntry | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(CATALOG_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as CatalogCacheEntry) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    logger.warn('pwa', 'IDB getCachedCatalog failed', err);
    return null;
  }
}

export async function setCachedCatalog(
  products: Product[],
  categories: string[]
): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const entry: CatalogCacheEntry = { products, categories, cachedAt: Date.now() };
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(entry, CATALOG_KEY);
      req.onsuccess = () => {
        db.close();
        logger.info('pwa', 'Catalog written to IDB', {
          productCount: products.length,
          categoryCount: categories.length,
        });
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    logger.warn('pwa', 'IDB setCachedCatalog failed', err);
  }
}

export async function clearCatalogCache(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(CATALOG_KEY);
      req.onsuccess = () => {
        db.close();
        logger.info('pwa', 'Catalog IDB cache cleared');
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    logger.warn('pwa', 'IDB clearCatalogCache failed', err);
  }
}

export function isCatalogStale(cachedAt: number): boolean {
  return Date.now() - cachedAt > CATALOG_TTL_MS;
}

// ─── Price baseline (public) ──────────────────────────────────────────────────

/**
 * Writes a tamper-evident price baseline to IndexedDB.
 *
 * Called once each time fresh product data arrives from the API (initial
 * network fetch or background revalidation). Overwrites any previous baseline
 * so the record always reflects the most recently trusted catalog prices.
 *
 * Security properties:
 *   - Stored in IndexedDB (separate storage partition from localStorage).
 *   - Includes a SHA-256 integrity digest so checkout validation can detect
 *     any post-write modification to the IDB record.
 */
export async function setPriceBaseline(products: Product[]): Promise<void> {
  try {
    const entries: PriceBaselineRecord[] = products.map(p => ({ id: p.id, price: p.price }));
    const integrity = await computeBaselineIntegrity(entries);
    const entry: PriceBaselineEntry = { entries, savedAt: Date.now(), integrity };

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BASELINE_STORE, 'readwrite');
      const req = tx.objectStore(BASELINE_STORE).put(entry, BASELINE_KEY);
      req.onsuccess = () => {
        db.close();
        logger.info('pwa', 'Price baseline written to IDB', { productCount: entries.length });
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    logger.warn('pwa', 'IDB setPriceBaseline failed', err);
  }
}

/**
 * Reads the stored price baseline from IndexedDB.
 * Returns null if no baseline has been written yet (e.g. first load, cleared IDB).
 * The caller is responsible for verifying integrity via `verifyBaselineIntegrity`.
 */
export async function getPriceBaseline(): Promise<PriceBaselineEntry | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BASELINE_STORE, 'readonly');
      const req = tx.objectStore(BASELINE_STORE).get(BASELINE_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as PriceBaselineEntry) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    logger.warn('pwa', 'IDB getPriceBaseline failed', err);
    return null;
  }
}
