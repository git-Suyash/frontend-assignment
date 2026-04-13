import { Link, useParams } from 'react-router-dom';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-green-200 shadow-md max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
        <p className="text-gray-500 mb-1">Thank you for your purchase.</p>
        <p className="text-sm text-gray-400 mb-6">
          Order ID: <span className="font-mono font-semibold text-gray-700">#{id}</span>
        </p>
        <Link
          to="/"
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
