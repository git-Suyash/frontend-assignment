import { useCart } from '../contexts/CartContext';

export default function OfflinePage() {
  const { state: cartState } = useCart();
  const itemCount = cartState.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl border border-border shadow-sm max-w-md w-full p-10 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <svg
              className="w-8 h-8 text-ink-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 9.172L14.828 14.828M14.828 9.172l-5.656 5.656"
              />
            </svg>
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold text-ink mb-2">You're offline</h1>
        <p className="text-ink-2 text-sm mb-1">
          You can still browse your cart and any previously loaded products.
        </p>

        {itemCount > 0 && (
          <p className="text-sm text-gold font-semibold mt-3 mb-1">
            {itemCount} item{itemCount !== 1 ? 's' : ''} saved in your cart
          </p>
        )}

        <button
          onClick={() => window.location.reload()}
          className="mt-6 bg-ink text-white px-7 py-2.5 rounded-xl font-medium hover:bg-ink/80 transition-colors text-sm"
        >
          Retry connection
        </button>
      </div>
    </div>
  );
}
