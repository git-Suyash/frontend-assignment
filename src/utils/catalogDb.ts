import type { Product } from '../types';
import { logger } from './logger';

const DB_NAME = 'opencart_catalog';
const DB_VERSION = 1;
const STORE_NAME = 'cache';
const CATALOG_KEY = 'catalog';

export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CatalogCacheEntry {
  products: Product[];
  categories: string[];
  cachedAt: number;
}

// ─── DB open ─────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      // Create the store on first open / version bump
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IDB blocked'));
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

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
