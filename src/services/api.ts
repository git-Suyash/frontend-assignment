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
