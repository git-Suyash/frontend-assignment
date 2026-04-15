import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { List } from 'react-window';
import { useCart } from '../hooks/useCart';
import { useNotification } from '../hooks/useNotification';
import { CartRow, type CartRowExtraProps } from '../components/CartRow';
import NotificationCenter from '../components/NotificationCenter';

export default function CartPage() {
  const { state, dispatch } = useCart();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);

  const items = state.items;
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.snapshotPrice * i.quantity, 0);

  const itemSize = 80;
  const listHeight = Math.min(items.length * itemSize, window.innerHeight * 0.6);

  const dismissConflict = useCallback(() => {
    dispatch({ type: 'SET_STATUS', payload: { status: 'idle' } });
  }, [dispatch]);

  const handleItemRemoved = useCallback(
    (productTitle: string) => {
      notify('info', 'Item removed', `${productTitle} removed from cart`);
    },
    [notify]
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="text-ink-3 hover:text-ink text-sm font-medium flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Shop
          </Link>
          <h1 className="font-display text-xl font-bold text-ink flex-1">
            Your Cart
            {totalItems > 0 && (
              <span className="font-sans text-sm font-normal text-ink-3 ml-2">
                ({totalItems} {totalItems === 1 ? 'item' : 'items'})
              </span>
            )}
          </h1>
          <button
            onClick={() => setNotifCenterOpen(true)}
            aria-label="Open notification center"
            className="p-2.5 text-ink-3 hover:text-ink rounded-xl hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-7">
        {/* Conflict banner */}
        {state.status === 'conflict' && (
          <div className="mb-5 bg-warn-muted border border-warn/30 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
            <p className="text-sm text-warn">
              Your cart was modified in another tab. Please review before checking out.
            </p>
            <button
              onClick={dismissConflict}
              className="text-warn hover:text-warn/70 text-sm font-semibold whitespace-nowrap transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Empty cart */}
        {items.length === 0 ? (
          <div className="text-center py-28">
            <div className="text-5xl mb-5">🛒</div>
            <h2 className="text-xl font-semibold text-ink mb-2">Your cart is empty</h2>
            <p className="text-ink-3 text-sm mb-7">Add some products to get started.</p>
            <Link
              to="/"
              className="bg-ink text-white px-6 py-2.5 rounded-xl hover:bg-ink/80 transition-colors font-medium text-sm"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Virtualized list */}
            <div className="flex-1 bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
              <List<CartRowExtraProps>
                rowComponent={CartRow}
                rowProps={{ items, dispatch, onItemRemoved: handleItemRemoved }}
                rowCount={items.length}
                rowHeight={itemSize}
                style={{ height: listHeight }}
              />
            </div>

            {/* Summary panel */}
            <div className="lg:w-72 bg-surface rounded-2xl border border-border p-6 lg:sticky lg:top-20 self-start shadow-sm">
              <h2 className="text-base font-semibold text-ink mb-5">Order Summary</h2>
              <div className="space-y-2.5 mb-5">
                <div className="flex justify-between text-sm text-ink-2">
                  <span>Items ({totalItems})</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-ink-2">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="border-t border-border pt-2.5 flex justify-between font-bold text-ink">
                  <span>Total</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                disabled={items.length === 0 || state.status === 'locked'}
                className="w-full bg-gold text-white py-3 px-4 rounded-xl font-semibold hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </main>

      <NotificationCenter open={notifCenterOpen} onClose={() => setNotifCenterOpen(false)} />
    </div>
  );
}
