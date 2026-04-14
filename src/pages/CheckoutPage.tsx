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

interface ValidationNotif {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

function validationFailureNotif(reason: ValidationFailureReason): ValidationNotif {
  switch (reason) {
    case 'CART_EMPTY':
      return { type: 'warning', title: 'Empty cart', message: 'Add items to your cart before checking out.' };
    case 'CART_LOCKED':
      return { type: 'warning', title: 'Already in progress', message: 'A checkout is already in progress. Please wait.' };
    case 'CART_CONFLICT':
      return { type: 'error', title: 'Cart conflict', message: 'Resolve the cart conflict before checking out.' };
    case 'CHECKSUM_MISMATCH':
      return { type: 'error', title: 'Security check failed', message: 'Cart integrity could not be verified. Please review your cart.' };
    case 'PRICE_TAMPERING':
      return { type: 'error', title: 'Tampering detected', message: 'Product prices have been altered. Your cart has been reset to original prices.' };
    case 'STALE_PRICE':
      return { type: 'warning', title: 'Prices changed', message: 'Some items have new prices. Please review your cart.' };
    case 'IDEMPOTENCY_REUSE':
      return { type: 'warning', title: 'Duplicate attempt', message: 'This order has already been submitted.' };
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
        notify('error', 'Order status unclear', 'There was an issue saving your order. Please choose an action below.');
        auditLog('ORDER_INCONSISTENT', {
          cartVersion: cartState.version,
          cartItemCount: cartState.items.length,
        });
      } else {
        const orderId = String(response.id);
        orderDispatch({ type: 'SET_ORDER_ID', payload: { orderId } });
        orderDispatch({ type: 'TRANSITION', payload: { to: 'ORDER_SUCCESS' } });
        cartDispatch({ type: 'CLEAR_CART' });
        notify('success', 'Order confirmed!', `Your order #${orderId} has been placed successfully.`);
        auditLog('ORDER_SUCCESS', {
          cartVersion: cartState.version,
          cartItemCount: cartState.items.length,
        });
        navigate(`/order/${orderId}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      orderDispatch({ type: 'TRANSITION', payload: { to: 'ORDER_FAILED', reason: message } });
      notify('error', 'Order failed', "We couldn't process your order. You can retry or cancel.");
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
    notify('info', 'Validating', 'Checking your cart for issues...');

    const result = await validateCheckout(cartState);

    if (!result.valid) {
      cartDispatch({ type: 'SET_LOCK', payload: { locked: false } });
      orderDispatch({ type: 'TRANSITION', payload: { to: 'CART_READY' } });
      cartDispatch({ type: 'RESET_IDEMPOTENCY_KEY' });
      const notif = validationFailureNotif(result.reason);
      notify(notif.type, notif.title, notif.message);
      auditLog('CHECKOUT_BLOCKED', {
        cartVersion: cartState.version,
        reason: result.reason,
      });
      setSubmitting(false);
      return;
    }

    orderDispatch({ type: 'TRANSITION', payload: { to: 'CHECKOUT_VALIDATED' } });
    notify('success', 'Validation passed', 'Your order is ready to submit.');
    orderDispatch({ type: 'TRANSITION', payload: { to: 'ORDER_SUBMITTED' } });
    notify('info', 'Submitting order', 'Please wait while we process your order...');

    await runSubmitOrder();
  }

  async function handleRetry() {
    const attempt = orderState.retryCount + 1;
    cartDispatch({ type: 'RESET_IDEMPOTENCY_KEY' });
    orderDispatch({ type: 'INCREMENT_RETRY' });
    orderDispatch({ type: 'TRANSITION', payload: { to: 'ORDER_SUBMITTED' } });
    notify('info', 'Retrying order', `Attempting to resubmit your order (attempt #${attempt}).`);
    auditLog('RETRY_INITIATED', {
      cartVersion: cartState.version,
      reason: `Retry attempt ${attempt}`,
    });
    cartDispatch({ type: 'SET_LOCK', payload: { locked: true } });
    setSubmitting(true);
    await runSubmitOrder();
  }

  function handleRollback() {
    orderDispatch({ type: 'TRANSITION', payload: { to: 'ROLLED_BACK' } });
    auditLog('ROLLBACK_INITIATED', { cartVersion: cartState.version });
    notify('info', 'Order cancelled', 'Your order has been cancelled and your cart restored.');
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
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-warn/30 shadow-md max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-warn-muted flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-warn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-ink mb-2">Interrupted checkout</h2>
          <p className="text-ink-2 text-sm mb-7">
            Your previous order was interrupted. Would you like to resume or start over?
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowRecovery(false)}
              className="bg-gold text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-gold-dark transition-colors text-sm"
            >
              Resume
            </button>
            <button
              onClick={handleStartOver}
              className="border border-border text-ink-2 px-6 py-2.5 rounded-xl font-semibold hover:bg-muted transition-colors text-sm"
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
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-border shadow-md max-w-sm w-full p-10 text-center">
          <div className="flex justify-center mb-5">
            <svg className="animate-spin h-10 w-10 text-gold" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-80" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-ink mb-2">Processing your order…</h2>
          <p className="text-ink-3 text-sm">Please don't close this tab.</p>
        </div>
      </div>
    );
  }

  // ORDER_FAILED / ORDER_INCONSISTENT: failure screen
  if (orderState.current === 'ORDER_FAILED' || orderState.current === 'ORDER_INCONSISTENT') {
    const isInconsistent = orderState.current === 'ORDER_INCONSISTENT';
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-bad/25 shadow-md max-w-md w-full p-8 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${isInconsistent ? 'bg-warn-muted' : 'bg-bad-muted'}`}>
            <svg className={`w-7 h-7 ${isInconsistent ? 'text-warn' : 'text-bad'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isInconsistent
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              }
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-ink mb-1">
            {STATE_LABELS[orderState.current]}
          </h2>
          {orderState.failureReason && (
            <p className="text-xs text-ink-3 mb-4 bg-muted rounded-lg px-3 py-2.5 text-left font-mono leading-relaxed">
              {orderState.failureReason}
            </p>
          )}
          {isInconsistent && (
            <p className="text-sm text-warn bg-warn-muted border border-warn/20 rounded-xl px-4 py-3 mb-4 text-left leading-relaxed">
              The order may have been processed by the server. Retrying may create a duplicate — a new idempotency key will be generated.
            </p>
          )}
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={handleRetry}
              disabled={submitting}
              className="bg-gold text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-gold-dark transition-colors disabled:opacity-50 text-sm"
            >
              Retry order
            </button>
            <button
              onClick={handleRollback}
              disabled={submitting}
              className="border border-border text-ink-2 px-6 py-2.5 rounded-xl font-semibold hover:bg-muted transition-colors disabled:opacity-50 text-sm"
            >
              Cancel &amp; restore cart
            </button>
          </div>
          {orderState.retryCount > 0 && (
            <p className="text-xs text-ink-3 mt-4">Retry attempt #{orderState.retryCount}</p>
          )}
        </div>
      </div>
    );
  }

  // CART_READY / CHECKOUT_VALIDATED: checkout form + order summary
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center gap-4">
          <Link to="/cart" className="text-ink-3 hover:text-ink text-sm font-medium flex items-center gap-1.5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Cart
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">Checkout</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Checkout form */}
        <form ref={formRef} onSubmit={handlePlaceOrder} noValidate className="space-y-5">
          <h2 className="text-base font-semibold text-ink">Shipping details</h2>

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
            className="w-full bg-gold text-white py-3.5 px-4 rounded-xl font-semibold hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {submitting ? 'Processing…' : 'Place Order'}
          </button>
        </form>

        {/* Order summary panel */}
        <div className="bg-surface rounded-2xl border border-border p-6 self-start lg:sticky lg:top-20 shadow-sm">
          <h2 className="text-base font-semibold text-ink mb-5">
            Order Summary
            <span className="font-normal text-ink-3 ml-1.5 text-sm">
              ({cartState.items.reduce((s, i) => s + i.quantity, 0)} items)
            </span>
          </h2>
          <ul className="divide-y divide-border mb-5">
            {cartState.items.map(item => (
              <li key={item.product.id} className="py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-canvas flex-shrink-0 flex items-center justify-center">
                  <img
                    src={item.product.image}
                    alt={item.product.title}
                    className="w-9 h-9 object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">{item.product.title}</p>
                  <p className="text-xs text-ink-3">
                    {item.quantity} × ${item.snapshotPrice.toFixed(2)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink">
                  ${(item.snapshotPrice * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 text-sm border-t border-border pt-4">
            <div className="flex justify-between text-ink-2">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-ink-2">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="flex justify-between font-bold text-ink text-base pt-2 border-t border-border">
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
      <label htmlFor={name} className="block text-sm font-medium text-ink-2 mb-1.5">
        {label}
        {required && <span className="text-bad ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 transition-colors bg-canvas ${
          error
            ? 'border-bad/50 bg-bad-muted focus:ring-bad/20 focus:border-bad'
            : 'border-border focus:ring-gold/25 focus:border-gold'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-bad">{error}</p>}
    </div>
  );
}
