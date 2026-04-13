import type { CartState, CartAction } from '../types';
import { computeCartChecksum } from '../utils/fnv1a';
import { generateIdempotencyKey } from '../utils/idempotency';

export const initialCartState: CartState = {
  items: [],
  version: 0,
  checksum: computeCartChecksum([]),
  baselineSnapshot: {},
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
      return {
        ...state,
        items: newItems,
        version: state.version + 1,
        checksum: computeCartChecksum(newItems),
      };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(
        i => i.product.id !== action.payload.productId
      );
      return {
        ...state,
        items: newItems,
        version: state.version + 1,
        checksum: computeCartChecksum(newItems),
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
      return {
        ...state,
        items: newItems,
        version: state.version + 1,
        checksum: computeCartChecksum(newItems),
      };
    }

    case 'CLEAR_CART': {
      const newItems: CartState['items'] = [];
      return {
        ...state,
        items: newItems,
        version: state.version + 1,
        checksum: computeCartChecksum(newItems),
      };
    }

    case 'SET_LOCK':
      return {
        ...state,
        status: action.payload.locked ? 'locked' : 'idle',
      };

    case 'SET_STATUS':
      return { ...state, status: action.payload.status };

    case 'SYNC_FROM_STORAGE':
      return { ...action.payload };

    case 'SET_BASELINE_SNAPSHOT':
      return { ...state, baselineSnapshot: action.payload };

    case 'RESET_IDEMPOTENCY_KEY':
      return { ...state, idempotencyKey: generateIdempotencyKey() };

    default:
      return state;
  }
}
