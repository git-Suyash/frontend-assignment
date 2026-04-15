/**
 * cartReducer
 *
 * Pure reducer for the shopping cart. All mutations go through here so that
 * the state transition history is predictable and testable.
 *
 * Checksum invariant:
 *   Every action that touches `items` MUST recompute the FNV-1a checksum.
 *   The checksum is later verified by validateCheckout to detect client-side
 *   tampering between "add to cart" and "place order".
 *
 * Version counter:
 *   `version` increments on every item mutation. CartProvider's cross-tab
 *   sync effect uses it to detect whether a storage event carries a newer
 *   or duplicate state.
 */

import type { CartState, CartAction } from '../types';
import { computeCartChecksum } from '../utils/fnv1a';
import { generateIdempotencyKey } from '../utils/idempotency';
import { logger } from '../utils/logger';

export const initialCartState: CartState = {
  items: [],
  version: 0,
  checksum: computeCartChecksum([]),
  idempotencyKey: generateIdempotencyKey(),
  status: 'idle',
};

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.product.id === action.payload.id);
      const newItems = existing
        ? state.items.map(i =>
            i.product.id === action.payload.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        : [
            ...state.items,
            {
              product: action.payload,
              quantity: 1,
              snapshotPrice: action.payload.price,
            },
          ];
      const newChecksum = computeCartChecksum(newItems);
      logger.info('cart', `ADD_ITEM: ${action.payload.title}`, { productId: action.payload.id, newVersion: state.version + 1, checksum: newChecksum });
      return {
        ...state,
        items: newItems,
        version: state.version + 1,
        checksum: newChecksum,
      };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(
        i => i.product.id !== action.payload.productId
      );
      const newChecksum = computeCartChecksum(newItems);
      logger.info('cart', `REMOVE_ITEM: productId=${action.payload.productId}`, { newVersion: state.version + 1, checksum: newChecksum });
      return {
        ...state,
        items: newItems,
        version: state.version + 1,
        checksum: newChecksum,
      };
    }

    case 'UPDATE_QUANTITY': {
      const { productId, quantity } = action.payload;
      const newItems =
        quantity <= 0
          ? state.items.filter(i => i.product.id !== productId)
          : state.items.map(i =>
              i.product.id === productId ? { ...i, quantity } : i
            );
      const newChecksum = computeCartChecksum(newItems);
      logger.debug('cart', `UPDATE_QUANTITY: productId=${productId} qty=${quantity}`, { newVersion: state.version + 1, checksum: newChecksum });
      return {
        ...state,
        items: newItems,
        version: state.version + 1,
        checksum: newChecksum,
      };
    }

    case 'CLEAR_CART': {
      const newItems: CartState['items'] = [];
      const newChecksum = computeCartChecksum(newItems);
      logger.info('cart', 'CLEAR_CART', { newVersion: state.version + 1 });
      return {
        ...state,
        items: newItems,
        version: state.version + 1,
        checksum: newChecksum,
      };
    }

    case 'SET_LOCK':
      logger.debug('cart', `SET_LOCK: ${action.payload.locked}`);
      return {
        ...state,
        status: action.payload.locked ? 'locked' : 'idle',
      };

    case 'SET_STATUS':
      logger.debug('cart', `SET_STATUS: ${action.payload.status}`);
      return { ...state, status: action.payload.status };

    case 'SYNC_FROM_STORAGE':
      logger.info('cart', 'SYNC_FROM_STORAGE', { version: action.payload.version });
      return { ...action.payload };

    case 'RESET_IDEMPOTENCY_KEY':
      logger.info('cart', 'RESET_IDEMPOTENCY_KEY — new checkout session');
      return { ...state, idempotencyKey: generateIdempotencyKey() };

    default:
      return state;
  }
}
