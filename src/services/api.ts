/**
 * api
 *
 * HTTP client layer for the FakeStore API. All requests are routed through
 * the `apiFetch` helper, which adds a simulated network delay and structured
 * request/response logging.
 *
 * INJECTED_DELAY_MS:
 *   An artificial delay added before every request. This is intentional —
 *   it makes loading states and skeleton UIs visible during development and
 *   demos. Set to 0 to remove for performance testing.
 *
 * Error handling:
 *   Non-2xx responses throw an Error with the format `"API_ERROR: <status> <url>"`.
 *   Callers (useProducts, checkoutValidation) are responsible for catching
 *   and surfacing these errors appropriately.
 */

import type { Product } from '../types';
import { sleep } from '../utils/sleep';
import { logger } from '../utils/logger';

export const INJECTED_DELAY_MS = 800;

async function apiFetch<T>(url: string): Promise<T> {
  await sleep(INJECTED_DELAY_MS);
  const start = Date.now();
  logger.info('cart', `→ GET ${url}`);

  const res = await fetch(url);
  const durationMs = Date.now() - start;

  if (!res.ok) {
    logger.error('cart', `← ${res.status} ${url}`, { durationMs });
    throw new Error(`API_ERROR: ${res.status} ${url}`);
  }

  const data = await res.json() as T;
  logger.info('cart', `← ${res.status} ${url}`, { durationMs, resultCount: Array.isArray(data) ? (data as unknown[]).length : 1 });
  return data;
}

export async function fetchProducts(): Promise<Product[]> {
  return apiFetch<Product[]>('https://fakestoreapi.com/products');
}

export async function fetchProductById(id: number): Promise<Product> {
  return apiFetch<Product>(`https://fakestoreapi.com/products/${id}`);
}

export async function fetchCategories(): Promise<string[]> {
  return apiFetch<string[]>('https://fakestoreapi.com/products/categories');
}

export async function fetchProductsByCategory(category: string): Promise<Product[]> {
  return apiFetch<Product[]>(
    `https://fakestoreapi.com/products/category/${encodeURIComponent(category)}`
  );
}
