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
      className="flex items-center gap-3 px-5 border-b border-border bg-surface"
    >
      <div className="w-10 h-10 rounded-lg bg-canvas flex-shrink-0 flex items-center justify-center overflow-hidden">
        <img
          src={product.image}
          alt={product.title}
          className="w-9 h-9 object-contain"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{product.title}</p>
        <p className="text-xs text-ink-3">${snapshotPrice.toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={decrement}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-ink-2 hover:bg-muted hover:border-border-strong transition-colors text-sm font-medium"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold text-ink">{quantity}</span>
        <button
          onClick={increment}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-ink-2 hover:bg-muted hover:border-border-strong transition-colors text-sm font-medium"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <span className="w-20 text-right text-sm font-bold text-ink">
        ${lineTotal.toFixed(2)}
      </span>
      <button
        onClick={remove}
        className="ml-1 text-ink-3 hover:text-bad transition-colors p-1 rounded-lg hover:bg-bad-muted"
        aria-label="Remove item"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

// React.memo is required here — react-window passes row props by reference and the
// compiler cannot statically analyse cross-list-boundary re-renders.
export const CartRow = React.memo(CartRowInner) as (props: CartRowProps) => ReactElement | null;
