import React, { type CSSProperties, type ReactElement } from 'react';
import type { CartItem, CartAction } from '../types';
import type { Dispatch } from 'react';

// Extra props passed via react-window v2 `rowProps`
export interface CartRowExtraProps {
  items: CartItem[];
  dispatch: Dispatch<CartAction>;
  onItemRemoved?: (productTitle: string) => void;
}

// Full props received by the row component (extra + injected by react-window)
interface CartRowProps extends CartRowExtraProps {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
}

function CartRowInner({ items, index, style, ariaAttributes, dispatch, onItemRemoved }: CartRowProps): ReactElement | null {
  const item = items[index];
  if (!item) return null;

  const { product, quantity, snapshotPrice } = item;
  const lineTotal = snapshotPrice * quantity;

  function decrement() {
    if (quantity <= 1) {
      dispatch({ type: 'REMOVE_ITEM', payload: { productId: product.id } });
      onItemRemoved?.(product.title);
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { productId: product.id, quantity: quantity - 1 } });
    }
  }

  function increment() {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { productId: product.id, quantity: quantity + 1 } });
  }

  function remove() {
    dispatch({ type: 'REMOVE_ITEM', payload: { productId: product.id } });
    onItemRemoved?.(product.title);
  }

  return (
    <div
      style={style}
      {...ariaAttributes}
      className="cart-row flex items-center gap-3 px-4 border-b border-gray-100 bg-white"
    >
      <img
        src={product.image}
        alt={product.title}
        className="w-12 h-12 object-cover rounded flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{product.title}</p>
        <p className="text-xs text-gray-400">Locked at ${snapshotPrice.toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={decrement}
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-medium">{quantity}</span>
        <button
          onClick={increment}
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <span className="w-20 text-right text-sm font-semibold text-gray-900">
        ${lineTotal.toFixed(2)}
      </span>
      <button
        onClick={remove}
        className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
        aria-label="Remove item"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

// React.memo is required here — react-window passes row props by reference and the
// compiler cannot statically analyse cross-list-boundary re-renders.
export const CartRow = React.memo(CartRowInner) as (props: CartRowProps) => ReactElement | null;
