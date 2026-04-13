import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrder } from '../contexts/OrderContext';
import { useCart } from '../contexts/CartContext';
import { useNotification } from '../contexts/NotificationContext';
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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Success header */}
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-9 h-9 text-green-600"
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
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Order Confirmed!</h1>
          <p className="text-lg text-indigo-600 font-semibold mb-2">Order #{id}</p>
          <p className="text-gray-500 text-sm">
            Thank you for your order. Estimated delivery: 3–5 business days.
          </p>
        </div>

        {/* Order Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-6">Order Timeline</h2>
          <OrderTimeline orderState={orderState} />
        </div>

        {/* Order details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {cartState.items.length > 0
              ? `Order Details (${totalItems} item${totalItems !== 1 ? 's' : ''})`
              : 'Order Details'}
          </h2>

          {cartState.items.length > 0 ? (
            <>
              <ul className="divide-y divide-gray-100 mb-4">
                {cartState.items.map(item => (
                  <li key={item.product.id} className="py-3 flex items-center gap-3">
                    <img
                      src={item.product.image}
                      alt={item.product.title}
                      className="w-10 h-10 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{item.product.title}</p>
                      <p className="text-xs text-gray-400">
                        {item.quantity} × ${item.snapshotPrice.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      ${(item.snapshotPrice * item.quantity).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Order complete. Cart has been cleared.</p>
          )}
        </div>

        {/* Continue Shopping */}
        <div className="text-center">
          <button
            onClick={handleContinueShopping}
            className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </main>
    </div>
  );
}
