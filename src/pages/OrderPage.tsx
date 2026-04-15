import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrder } from '../hooks/useOrder';
import { useCart } from '../hooks/useCart';
import { useNotification } from '../hooks/useNotification';
import { clearPersistedSession } from '../utils/storage';
import OrderTimeline from '../components/OrderTimeline';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: orderState, dispatch: orderDispatch } = useOrder();
  const { state: cartState } = useCart();
  const { notify } = useNotification();

  // Guard: if no orderId in URL or order is not success, redirect
  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }
    if (
      orderState.current !== 'ORDER_SUCCESS' ||
      (orderState.orderId && orderState.orderId !== id)
    ) {
      if (orderState.current !== 'ORDER_SUCCESS') {
        navigate('/');
      }
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleContinueShopping() {
    clearPersistedSession();
    orderDispatch({ type: 'RESET_ORDER' });
    notify('info', 'Session cleared', 'Your order session has been cleared.');
    navigate('/');
  }

  const subtotal = cartState.items.reduce(
    (sum, i) => sum + i.snapshotPrice * i.quantity,
    0
  );
  const totalItems = cartState.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-canvas">
      <main className="max-w-2xl mx-auto px-5 py-10 space-y-5">
        {/* Success header */}
        <div className="bg-surface rounded-2xl border border-ok/25 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-ok-muted flex items-center justify-center">
              <svg
                className="w-8 h-8 text-ok"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink mb-1.5">Order Confirmed!</h1>
          <p className="text-base text-gold font-semibold mb-2">Order #{id}</p>
          <p className="text-ink-3 text-sm">
            Thank you for your purchase. Estimated delivery: 3–5 business days.
          </p>
        </div>

        {/* Order Timeline */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-sm font-semibold text-ink mb-6 uppercase tracking-wider text-ink-3">Order Timeline</h2>
          <OrderTimeline orderState={orderState} />
        </div>

        {/* Order details */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3 mb-4">
            {cartState.items.length > 0
              ? `Order Details (${totalItems} item${totalItems !== 1 ? 's' : ''})`
              : 'Order Details'}
          </h2>

          {cartState.items.length > 0 ? (
            <>
              <ul className="divide-y divide-border mb-4">
                {cartState.items.map(item => (
                  <li key={item.product.id} className="py-3.5 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-canvas flex-shrink-0 flex items-center justify-center">
                      <img
                        src={item.product.image}
                        alt={item.product.title}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">{item.product.title}</p>
                      <p className="text-xs text-ink-3">
                        {item.quantity} × ${item.snapshotPrice.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-ink">
                      ${(item.snapshotPrice * item.quantity).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border pt-4 flex justify-between font-bold text-ink">
                <span>Total</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-3">Order complete. Cart has been cleared.</p>
          )}
        </div>

        {/* Continue Shopping */}
        <div className="text-center pt-2">
          <button
            onClick={handleContinueShopping}
            className="inline-block bg-ink text-white px-8 py-3 rounded-xl font-semibold hover:bg-ink/80 transition-colors text-sm"
          >
            Continue Shopping
          </button>
        </div>
      </main>
    </div>
  );
}
