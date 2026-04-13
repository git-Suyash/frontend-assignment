import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { CartState, CartAction } from '../types';
import { cartReducer, initialCartState } from '../reducers/cartReducer';
import { persistCart, loadCart, CART_STORAGE_KEY } from '../utils/storage';

interface CartContextValue {
  state: CartState;
  dispatch: Dispatch<CartAction>;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const persisted = loadCart();
    if (persisted) {
      dispatch({ type: 'SYNC_FROM_STORAGE', payload: persisted });
    }

    const baselineRaw = localStorage.getItem('baseline_snapshot');
    if (baselineRaw) {
      try {
        const baseline = JSON.parse(baselineRaw) as Record<number, number>;
        dispatch({ type: 'SET_BASELINE_SNAPSHOT', payload: baseline });
      } catch {
        dispatch({ type: 'SET_BASELINE_SNAPSHOT', payload: {} });
      }
    }
  }, []);

  // Persist on every state change
  useEffect(() => {
    persistCart(state);
  }, [state]);

  // Cross-tab sync
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as CartState;
          if (parsed.version > state.version) {
            dispatch({ type: 'SYNC_FROM_STORAGE', payload: parsed });
            dispatch({
              type: 'SET_STATUS',
              payload: { status: 'conflict' },
            });
          }
        } catch {
          // ignore malformed storage values
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [state.version]);

  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
