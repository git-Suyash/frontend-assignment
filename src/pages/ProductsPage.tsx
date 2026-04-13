import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useNotification } from '../contexts/NotificationContext';
import { useProducts } from '../hooks/useProducts';
import { useDebounce } from '../hooks/useDebounce';
import { useProductFilter, type SortOption } from '../hooks/useProductFilter';
import type { Product } from '../types';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      <div className="bg-gray-200 rounded h-48 mb-4" />
      <div className="bg-gray-200 rounded h-4 mb-2" />
      <div className="bg-gray-200 rounded h-4 w-2/3 mb-3" />
      <div className="bg-gray-200 rounded h-6 w-1/3 mb-3" />
      <div className="bg-gray-200 rounded h-9" />
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col hover:shadow-md transition-shadow">
      <div className="flex items-center justify-center h-48 mb-4">
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="max-h-48 max-w-full object-contain"
        />
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded self-start mb-2">
        {product.category}
      </span>
      <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1 mb-2">
        {product.title}
      </p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-lg font-bold text-gray-900">
          ${product.price.toFixed(2)}
        </span>
        <span className="text-xs text-gray-400">
          ★ {product.rating.rate} ({product.rating.count})
        </span>
      </div>
      <button
        onClick={() => onAddToCart(product)}
        className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
      >
        Add to Cart
      </button>
    </div>
  );
}

export default function ProductsPage() {
  const { state: cartState, dispatch: cartDispatch } = useCart();
  const { notify } = useNotification();
  const { products, loading, error, categories } = useProducts();

  const [rawSearch, setRawSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  const debouncedSearch = useDebounce(rawSearch, 300);
  const filteredProducts = useProductFilter(products, debouncedSearch, category, sortBy);

  const cartItemCount = cartState.items.reduce((sum, i) => sum + i.quantity, 0);

  function handleAddToCart(product: Product) {
    cartDispatch({ type: 'ADD_ITEM', payload: product });
    notify('success', 'Cart updated', `${product.title} added`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">OpenCart</h1>
          <Link to="/cart" className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and filter toolbar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            placeholder="Search products..."
            value={rawSearch}
            onChange={e => setRawSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="default">Default</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Name: A–Z</option>
            <option value="rating-desc">Top Rated</option>
          </select>
          {!loading && (
            <span className="text-sm text-gray-500 self-center whitespace-nowrap">
              Showing {filteredProducts.length} of {products.length} items
            </span>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center py-16">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No products match your search</p>
          </div>
        )}

        {/* Product grid */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
