import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useOrder } from '../contexts/OrderContext';
import { useNotification } from '../contexts/NotificationContext';
import { validateCheckout, type ValidationFailureReason } from '../services/checkoutValidation';
import { submitOrder, simulatePartialFailure } from '../services/orders';
import { auditLog } from '../utils/auditLog';
import { clearPersistedSession } from '../utils/storage';
import { STATE_LABELS } from '../machines/orderStateMachine';

interface FormFields {
  fullName: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

const EMPTY_FORM: FormFields = {
  fullName: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  country: '',
};

function validationFailureMessage(reason: ValidationFailureReason): string {
  switch (reason) {
    case 'CART_EMPTY':       return 'Your cart is empty.';
    case 'CART_LOCKED':      return 'A checkout is already in progress. Please wait.';
    case 'CART_CONFLICT':    return 'Cart conflict detected — your cart was modified in another tab.';
    case 'CHECKSUM_MISMATCH':return 'Cart integrity check failed. Your cart may have been tampered with.';
    case 'PRICE_TAMPERING':  return 'Price tampering detected. Item prices do not match their locked values.';
    case 'STALE_PRICE':      return 'Prices have changed since you added items. Please review your cart.';
    case 'IDEMPOTENCY_REUSE':return 'This order was already submitted. Please refresh and try again.';
  }
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { state: cartState, dispatch: cartDispatch } = useCart();
  const { state: orderState, dispatch: orderDispatch } = useOrder();
  const { notify } = useNotification();

  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormFields>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Guard: redirect if cart empty
  useEffect(() => {
    if (cartState.items.length === 0 && orderState.current === 'CART_READY') {
      notify('info', 'Cart empty', 'Your cart is empty');
      navigate('/');
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: redirect if order already succeeded
  useEffect(() => {
    if (orderState.current === 'ORDER_SUCCESS' && orderState.orderId) {
      navigate(`/order/${orderState.orderId}`);
    }
  }, [orderState.current, orderState.orderId, navigate]);

  // Refresh recovery: detect interrupted checkout
  useEffect(() => {
    if (
      orderState.current === 'ORDER_SUBMITTED' ||
      orderState.current === 'ORDER_INCONSISTENT'
    ) {
      setShowRecovery(true);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof FormFields]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }

  function validateForm(): boolean {
    const errors: Partial<FormFields> = {};
    if (form.fullName.trim().length < 2) errors.fullName = 'Full name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Please enter a valid email address';
    if (form.address.trim().length < 5) errors.address = 'Address must be at least 5 characters';
    if (form.city.trim().length < 2) errors.city = 'City must be at least 2 characters';
    if (!/^[a-zA-Z0-9\s-]{3,10}$/.test(form.postalCode)) errors.postalCode = 'Postal code must be 3–10 alphanumeric characters';
    if (form.country.trim().length < 2) errors.country = 'Country must be at least 2 characters';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const runSubmitOrder = useCallback(async () => {
    try {
      const response = await submitOrder(cartState.items, cartState.idempotencyKey);

      if (simulatePartialFailure()) {
        orderDispatch({
          type: 'TRANSITION',
          payload: { to: 'ORDER_INCONSISTENT', reason: 'Persistence failed after successful API call' },
        });
        notify('error', 'Order status unclear', 'Order status unclear — please check below');
        auditLog('ORDER_INCONSISTENT', {
          cartVersion: cartState.version,
          cartItemCount: cartState.items.length,
        });
      } else {
        orderDispatch({ type: 'SET_ORDER_ID', payload: { orderId: String(response.id) } });
        orderDispatch({ type: 'TRANSITION', payload: { to: 'ORDER_SUCCESS' } });
        cartDispatch({ type: 'CLEAR_CART' });
        notify('success', 'Order placed!', 'Order placed successfully!');
        auditLog('ORDER_SUCCESS', {
          cartVersion: cartState.version,
          cartItemCount: cartState.items.length,
        });
        navigate(`/order/${response.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      orderDispatch({ type: 'TRANSITION', payload: { to: 'ORDER_FAILED', reason: message } });
      notify('error', 'Order failed', `Order failed — ${message}`);
      auditLog('ORDER_FAILED', {
        cartVersion: cartState.version,
        reason: message,
      });
    } finally {
      cartDispatch({ type: 'SET_LOCK', payload: { locked: false } });
      setSubmitting(false);
    }
  }, [cartState, cartDispatch, orderDispatch, notify, navigate]);

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    cartDispatch({ type: 'SET_LOCK', payload: { locked: true } });
    notify('info', 'Validating order', 'Validating your order...');

    const result = await validateCheckout(cartState);

    if (!result.valid) {
      cartDispatch({ type: 'SET_LOCK', payload: { locked: false } });
      orderDispatch({ type: 'TRANSITION', payload: { to: 'CART_READY' } });
      cartDispatch({ type: 'RESET_IDEMPOTENCY_KEY' });
      notify('error', 'Validation failed', validationFailureMessage(result.reason));
      auditLog('CHECKOUT_BLOCKED', {
        cartVersion: cartState.version,
        reason: result.reason,
      });
      setSubmitting(false);
      return;
    }

    orderDispatch({ type: 'TRANSITION', payload: { to: 'CHECKOUT_VALIDATED' } });
    notify('success', 'Validation passed', 'Validation passed — submitting order...');
    orderDispatch({ type: 'TRANSITION', payload: { to: 'ORDER_SUBMITTED' } });

    await runSubmitOrder();
  }

  async function handleRetry() {
    cartDispatch({ type: 'RESET_IDEMPOTENCY_KEY' });
    orderDispatch({ type: 'INCREMENT_RETRY' });
    orderDispatch({ type: 'TRANSITION', payload: { to: 'ORDER_SUBMITTED' } });
    auditLog('RETRY_INITIATED', {
      cartVersion: cartState.version,
      reason: `Retry attempt ${orderState.retryCount + 1}`,
    });
    cartDispatch({ type: 'SET_LOCK', payload: { locked: true } });
    setSubmitting(true);
    await runSubmitOrder();
  }

  function handleRollback() {
    orderDispatch({ type: 'TRANSITION', payload: { to: 'ROLLED_BACK' } });
    auditLog('ROLLBACK_INITIATED', { cartVersion: cartState.version });
    notify('info', 'Order cancelled', 'Order cancelled. Your cart has been restored.');
    clearPersistedSession();
    orderDispatch({ type: 'RESET_ORDER' });
    navigate('/cart');
  }

  function handleStartOver() {
    orderDispatch({ type: 'RESET_ORDER' });
    navigate('/cart');
  }

  // ── UI sections ────────────────────────────────────────────────────────────

  const subtotal = cartState.items.reduce(
    (sum, i) => sum + i.snapshotPrice * i.quantity,
    0
  );

  // Recovery banner (refresh during ORDER_SUBMITTED / ORDER_INCONSISTENT)
  if (showRecovery) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-amber-300 shadow-md max-w-md w-full p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Interrupted checkout</h2>
          <p className="text-gray-600 mb-6">
            Your previous order was interrupted. Would you like to resume or start over?
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowRecovery(false)}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Resume
            </button>
            <button
              onClick={handleStartOver}
              className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ORDER_SUBMITTED: loading screen
  if (orderState.current === 'ORDER_SUBMITTED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-md max-w-sm w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg className="animate-spin h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Submitting your order…</h2>
          <p className="text-gray-500 text-sm">Please don't close this tab.</p>
        </div>
      </div>
    );
  }

  // ORDER_FAILED / ORDER_INCONSISTENT: failure screen
  if (orderState.current === 'ORDER_FAILED' || orderState.current === 'ORDER_INCONSISTENT') {
    const isInconsistent = orderState.current === 'ORDER_INCONSISTENT';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-red-200 shadow-md max-w-md w-full p-8 text-center">
          <div className="text-4xl mb-4">{isInconsistent ? '⚠️' : '❌'}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {STATE_LABELS[orderState.current]}
          </h2>
          {orderState.failureReason && (
            <p className="text-sm text-gray-500 mb-4 bg-gray-50 rounded px-3 py-2 text-left font-mono">
              {orderState.failureReason}
            </p>
          )}
          {isInconsistent && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4 text-left">
              The order may have been processed by the server. Retrying may create a duplicate — a new idempotency key will be generated.
            </p>
          )}
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={handleRetry}
              disabled={submitting}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Retry order
            </button>
            <button
              onClick={handleRollback}
              disabled={submitting}
              className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel &amp; restore cart
            </button>
          </div>
          {orderState.retryCount > 0 && (
            <p className="text-xs text-gray-400 mt-3">Retry attempt #{orderState.retryCount}</p>
          )}
        </div>
      </div>
    );
  }

  // CART_READY / CHECKOUT_VALIDATED: checkout form + order summary
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/cart" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to cart
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Checkout form */}
        <form ref={formRef} onSubmit={handlePlaceOrder} noValidate className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Shipping details</h2>

          <Field
            label="Full name"
            name="fullName"
            type="text"
            value={form.fullName}
            error={fieldErrors.fullName}
            onChange={handleFieldChange}
            minLength={2}
            required
          />
          <Field
            label="Email"
            name="email"
            type="email"
            value={form.email}
            error={fieldErrors.email}
            onChange={handleFieldChange}
            required
          />
          <Field
            label="Address line 1"
            name="address"
            type="text"
            value={form.address}
            error={fieldErrors.address}
            onChange={handleFieldChange}
            minLength={5}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="City"
              name="city"
              type="text"
              value={form.city}
              error={fieldErrors.city}
              onChange={handleFieldChange}
              minLength={2}
              required
            />
            <Field
              label="Postal code"
              name="postalCode"
              type="text"
              value={form.postalCode}
              error={fieldErrors.postalCode}
              onChange={handleFieldChange}
              required
            />
          </div>
          <Field
            label="Country"
            name="country"
            type="text"
            value={form.country}
            error={fieldErrors.country}
            onChange={handleFieldChange}
            minLength={2}
            required
          />

          <button
            type="submit"
            disabled={submitting || cartState.status === 'locked'}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {submitting ? 'Processing…' : 'Place Order'}
          </button>
        </form>

        {/* Order summary panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 self-start lg:sticky lg:top-20">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order Summary ({cartState.items.reduce((s, i) => s + i.quantity, 0)} items)
          </h2>
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
          <div className="space-y-1 text-sm border-t border-gray-100 pt-3">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Field helper component ──────────────────────────────────────────────────

interface FieldProps {
  label: string;
  name: string;
  type: string;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  minLength?: number;
}

function Field({ label, name, type, value, error, onChange, required, minLength }: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
