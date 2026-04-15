/**
 * orderStateMachine
 *
 * Defines the valid transitions for the order lifecycle as an adjacency list.
 * All state changes in the app MUST be validated through `transition()` before
 * being applied — this is enforced by orderReducer.
 *
 * Design decisions:
 *   - Terminal states have an empty allowed-transitions array. `isTerminal()`
 *     uses this to decide whether a persisted order should be restored on refresh.
 *   - ORDER_SUCCESS is terminal: once an order succeeds, it can't be retried.
 *   - ORDER_FAILED and ORDER_INCONSISTENT are NOT terminal: the user may retry
 *     or roll back.
 *   - ROLLED_BACK → CART_READY allows the user to re-enter the checkout flow
 *     after cancelling a failed order.
 *
 * STATE_LABELS provides human-readable strings for UI rendering without
 * coupling the machine definition to presentation concerns.
 */

import type { OrderStateName } from '../types';

const VALID_TRANSITIONS: Record<OrderStateName, OrderStateName[]> = {
  CART_READY:           ['CHECKOUT_VALIDATED'],
  CHECKOUT_VALIDATED:   ['ORDER_SUBMITTED', 'CART_READY'],
  ORDER_SUBMITTED:      ['ORDER_SUCCESS', 'ORDER_FAILED', 'ORDER_INCONSISTENT'],
  ORDER_SUCCESS:        [],
  ORDER_FAILED:         ['ORDER_SUBMITTED', 'ROLLED_BACK'],
  ORDER_INCONSISTENT:   ['ORDER_SUBMITTED', 'ROLLED_BACK'],
  ROLLED_BACK:          ['CART_READY'],
};

export function transition(
  from: OrderStateName,
  to: OrderStateName
): { valid: boolean; reason?: string } {
  const allowed = VALID_TRANSITIONS[from];
  if (allowed.includes(to)) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: `Invalid transition: ${from} → ${to}. Allowed: [${allowed.join(', ') || 'none'}]`,
  };
}

export function getValidTransitions(from: OrderStateName): OrderStateName[] {
  return VALID_TRANSITIONS[from];
}

export const STATE_LABELS: Record<OrderStateName, string> = {
  CART_READY:           'Cart ready',
  CHECKOUT_VALIDATED:   'Checkout validated',
  ORDER_SUBMITTED:      'Order submitted',
  ORDER_SUCCESS:        'Order successful',
  ORDER_FAILED:         'Order failed',
  ORDER_INCONSISTENT:   'Order inconsistent',
  ROLLED_BACK:          'Rolled back',
};

export function isTerminal(state: OrderStateName): boolean {
  return VALID_TRANSITIONS[state].length === 0;
}
