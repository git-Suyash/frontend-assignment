import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { List } from 'react-window';
import { useCart } from '../contexts/CartContext';
import { CartRow, type CartRowExtraProps } from '../components/CartRow';

export default function CartPage() {
  const { state, dispatch } = useCart();
  const navigate = useNavigate();

  const items = state.items;
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.snapshotPrice * i.quantity, 0);

  const itemSize = 80;
  const listHeight = Math.min(items.length * itemSize, window.innerHeight * 0.6);

  const dismissConflict = useCallback(() => {
    dispatch({ type: 'SET_STATUS', payload: { status: 'idle' } });
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to shop
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            Your Cart ({totalItems} {totalItems === 1 ? 'item' : 'items'})
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Conflict banner */}
        {state.status === 'conflict' && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
            <p className="text-sm text-amber-800">
              Your cart was modified in another tab. Please review before checking out.
            </p>
            <button
              onClick={dismissConflict}
              className="text-amber-700 hover:text-amber-900 text-sm font-medium whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Empty cart */}
        {items.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add some products to get started.</p>
            <Link
              to="/"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Virtualized list */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
              <List<CartRowExtraProps>
                rowComponent={CartRow}
                rowProps={{ items, dispatch }}
                rowCount={items.length}
                rowHeight={itemSize}
                style={{ height: listHeight }}
              />
            </div>

            {/* Summary panel */}
            <div className="lg:w-72 bg-white rounded-lg border border-gray-200 p-5 lg:sticky lg:top-20 self-start">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Items ({totalItems})</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-gray-900">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                disabled={items.length === 0 || state.status === 'locked'}
                className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
