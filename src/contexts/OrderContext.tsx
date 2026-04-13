import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { OrderState, OrderAction } from '../types';
import { orderReducer, initialOrderState } from '../reducers/orderReducer';
import { persistOrder, loadOrder } from '../utils/storage';
import { isTerminal } from '../machines/orderStateMachine';

interface OrderContextValue {
  state: OrderState;
  dispatch: Dispatch<OrderAction>;
}

export const OrderContext = createContext<OrderContextValue | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(orderReducer, initialOrderState);

  // Restore persisted order on mount (handles refresh-during-checkout)
  useEffect(() => {
    const persisted = loadOrder();
    if (persisted && !isTerminal(persisted.current)) {
      dispatch({ type: 'TRANSITION', payload: { to: persisted.current } });
    }
  }, []);

  // Persist on every state change
  useEffect(() => {
    persistOrder(state);
  }, [state]);

  return (
    <OrderContext.Provider value={{ state, dispatch }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within OrderProvider');
  return ctx;
}
