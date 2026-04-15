/**
 * orders
 *
 * Simulated order submission service. Posts a cart payload to
 * jsonplaceholder.typicode.com/posts as a stand-in for a real order API.
 *
 * simulatePartialFailure:
 *   Randomly returns `true` ~15% of the time. When `true`, `submitOrder`
 *   throws PARTIAL_FAILURE *after* a successful HTTP 201 response, simulating
 *   the real-world scenario where the order was accepted by the server but
 *   client-side persistence (e.g. writing the orderId to state) failed.
 *   CheckoutPage handles this with the ORDER_INCONSISTENT state and offers
 *   the user a choice to retry or roll back.
 *
 * Idempotency:
 *   The `X-Idempotency-Key` header is forwarded on every request so a real
 *   backend could safely de-duplicate retries without double-charging.
 */

import type { CartItem } from '../types';
import { sleep } from '../utils/sleep';
import { logger } from '../utils/logger';

export function simulatePartialFailure(): boolean {
  return Math.random() < 0.15;
}

export async function submitOrder(
  cartItems: CartItem[],
  idempotencyKey: string
): Promise<{ id: number }> {
  await sleep(1500);

  const url = 'https://jsonplaceholder.typicode.com/posts';
  const body = {
    title: 'Order submission',
    body: JSON.stringify({ itemCount: cartItems.length, idempotencyKey }),
    userId: 1,
  };

  logger.info('order', `→ POST ${url}`, { itemCount: cartItems.length, idempotencyKey });
  const start = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const durationMs = Date.now() - start;

  if (res.status !== 201) {
    logger.error('order', `← ${res.status} ${url}`, { durationMs });
    throw new Error('ORDER_SUBMIT_FAILED');
  }

  const data = (await res.json()) as { id: number };
  logger.info('order', `← ${res.status} ${url}`, { durationMs, orderId: data.id });

  if (simulatePartialFailure()) {
    logger.warn('order', 'Simulated partial failure after successful API call');
    throw new Error('PARTIAL_FAILURE');
  }

  return { id: data.id };
}
