import type { OrderState, OrderAction } from '../types';
import { transition } from '../machines/orderStateMachine';
import { logger } from '../utils/logger';

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
        logger.error('order', `Invalid transition rejected: ${result.reason}`);
        return state;
      }
      logger.info('order', `TRANSITION: ${state.current} → ${action.payload.to}`, {
        reason: action.payload.reason,
        retryCount: state.retryCount,
      });
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
      logger.info('order', `SET_ORDER_ID: ${action.payload.orderId}`);
      return { ...state, orderId: action.payload.orderId };

    case 'INCREMENT_RETRY':
      logger.info('order', `INCREMENT_RETRY: attempt #${state.retryCount + 1}`);
      return { ...state, retryCount: state.retryCount + 1 };

    case 'RESET_ORDER':
      logger.info('order', 'RESET_ORDER');
      return { ...initialOrderState, retryCount: state.retryCount };

    default:
      return state;
  }
}
