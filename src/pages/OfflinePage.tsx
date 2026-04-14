import { useCart } from '../contexts/CartContext';

export default function OfflinePage() {
  const { state: cartState } = useCart();
  const itemCount = cartState.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-4">
          <svg
            className="w-16 h-16 text-gray-400"
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

        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're offline</h1>
        <p className="text-gray-500 mb-4">
          You can still browse your cart and any previously loaded products.
        </p>

        {itemCount > 0 && (
          <p className="text-sm text-indigo-600 font-medium mb-6">
            You have {itemCount} item{itemCount !== 1 ? 's' : ''} in your cart
          </p>
        )}

        <button
          onClick={() => window.location.reload()}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Retry connection
        </button>
      </div>
    </div>
  );
}
