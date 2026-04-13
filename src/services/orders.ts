import type { CartItem } from '../types';
import { sleep } from '../utils/sleep';

export function simulatePartialFailure(): boolean {
  return Math.random() < 0.15;
}

export async function submitOrder(
  cartItems: CartItem[],
  idempotencyKey: string
): Promise<{ id: number }> {
  await sleep(1500);

  const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      title: 'Order submission',
      body: JSON.stringify({ itemCount: cartItems.length, idempotencyKey }),
      userId: 1,
    }),
  });

  if (res.status !== 201) {
    throw new Error('ORDER_SUBMIT_FAILED');
  }

  const data = (await res.json()) as { id: number };

  if (simulatePartialFailure()) {
    throw new Error('PARTIAL_FAILURE');
  }

  return { id: data.id };
}
