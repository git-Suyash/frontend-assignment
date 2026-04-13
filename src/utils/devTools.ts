// These functions are ONLY for development and the screen recording demo.
// Call them from the browser console to simulate attacks.
// Usage: window.__devTools.simulatePriceTampering(1, 999.99)

import { CART_STORAGE_KEY } from './storage';
import type { CartState } from '../types';

export function simulatePriceTampering(productId: number, newPrice: number): void {
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) {
    console.warn('[devTools] No cart found in localStorage');
    return;
  }
  const cart = JSON.parse(raw) as CartState;
  const item = cart.items.find(i => i.product.id === productId);
  if (!item) {
    console.warn(`[devTools] Product ${productId} not found in cart`);
    return;
  }
  // Change product.price but NOT snapshotPrice — triggers detectPriceTampering()
  item.product.price = newPrice;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  console.log(`[devTools] Tampered product ${productId} price to ${newPrice}. snapshotPrice unchanged at ${item.snapshotPrice}`);
}

export function simulateChecksumTampering(): void {
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) {
    console.warn('[devTools] No cart found in localStorage');
    return;
  }
  const cart = JSON.parse(raw) as CartState;
  cart.checksum = 'TAMPERED_HASH';
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  console.log('[devTools] Cart checksum tampered to "TAMPERED_HASH". Reload the page to trigger detection.');
}
