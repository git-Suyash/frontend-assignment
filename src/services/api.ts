import type { Product } from '../types';
import { sleep } from '../utils/sleep';

export const INJECTED_DELAY_MS = 800;

async function apiFetch<T>(url: string): Promise<T> {
  await sleep(INJECTED_DELAY_MS);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API_ERROR: ${res.status} ${url}`);
  }
  return res.json() as Promise<T>;
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
