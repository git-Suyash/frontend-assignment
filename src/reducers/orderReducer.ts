import type { OrderState, OrderAction } from '../types';
import { transition } from '../machines/orderStateMachine';

export const initialOrderState: OrderState = {
  current: 'CART_READY',
  orderId: null,
  timestamps: {},
  retryCount: 0,
  failureReason: null,
};

export function orderReducer(state: OrderState, action: OrderAction): OrderState {
  switch (action.type) {
    case 'TRANSITION': {
      const result = transition(state.current, action.payload.to);
      if (!result.valid) {
        console.error(`[OrderReducer] ${result.reason}`);
        return state;
      }
      return {
        ...state,
        current: action.payload.to,
        timestamps: {
          ...state.timestamps,
          [action.payload.to]: Date.now(),
        },
        failureReason: action.payload.reason ?? null,
      };
    }

    case 'SET_ORDER_ID':
      return { ...state, orderId: action.payload.orderId };

    case 'INCREMENT_RETRY':
      return { ...state, retryCount: state.retryCount + 1 };

    case 'RESET_ORDER':
      return { ...initialOrderState, retryCount: state.retryCount };

    default:
      return state;
  }
}
