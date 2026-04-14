import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useNotification } from '../contexts/NotificationContext';
import { useProducts } from '../hooks/useProducts';
import { useDebounce } from '../hooks/useDebounce';
import { useProductFilter, type SortOption } from '../hooks/useProductFilter';
import type { Product } from '../types';
import NotificationCenter from '../components/NotificationCenter';

function SkeletonCard() {
  return (
    <div className="bg-surface rounded-2xl p-5 animate-pulse shadow-sm">
      <div className="bg-muted rounded-xl h-48 mb-4" />
      <div className="bg-muted rounded-full h-4 w-20 mb-3" />
      <div className="bg-muted rounded h-3 mb-2" />
      <div className="bg-muted rounded h-3 w-3/4 mb-5" />
      <div className="flex justify-between mb-4">
        <div className="bg-muted rounded h-5 w-16" />
        <div className="bg-muted rounded h-4 w-20" />
      </div>
      <div className="bg-muted rounded-lg h-10" />
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <div className="bg-surface rounded-2xl p-5 flex flex-col shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-center justify-center h-48 mb-4 bg-canvas rounded-xl overflow-hidden">
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="max-h-44 max-w-full object-contain p-2"
        />
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gold-label bg-gold-muted px-2.5 py-1 rounded-full self-start mb-3">
        {product.category}
      </span>
      <p className="text-sm font-medium text-ink line-clamp-2 flex-1 mb-3 leading-relaxed">
        {product.title}
      </p>
      <div className="flex items-center justify-between mb-3.5">
        <span className="text-xl font-bold text-ink">
          ${product.price.toFixed(2)}
        </span>
        <span className="text-xs text-ink-3">
          <span className="text-gold">★</span> {product.rating.rate}{' '}
          <span className="opacity-60">({product.rating.count})</span>
        </span>
      </div>
      <button
        onClick={() => onAddToCart(product)}
        className="w-full bg-ink text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-colors duration-150 hover:bg-ink/80"
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
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);

  const [rawSearch, setRawSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  const debouncedSearch = useDebounce(rawSearch, 300);
  const filteredProducts = useProductFilter(products, debouncedSearch, category, sortBy);

  const cartItemCount = cartState.items.reduce((sum, i) => sum + i.quantity, 0);

  function handleAddToCart(product: Product) {
    cartDispatch({ type: 'ADD_ITEM', payload: product });
    notify('success', 'Cart updated', `${product.title} added to your cart`);
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink tracking-tight">OpenCart</h1>
          <div className="flex items-center gap-1">
            {/* Notification bell */}
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

            {/* Cart icon */}
            <Link
              to="/cart"
              className="relative p-2.5 text-ink-3 hover:text-ink rounded-xl hover:bg-muted transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-gold text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-7">
        {/* Search and filter toolbar */}
        <div className="bg-surface rounded-xl border border-border p-4 mb-6 flex flex-col sm:flex-row gap-3 shadow-sm">
          <input
            type="search"
            placeholder="Search products…"
            value={rawSearch}
            onChange={e => setRawSearch(e.target.value)}
            className="flex-1 border border-border rounded-lg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-gold/25 focus:border-gold bg-canvas transition-colors"
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="border border-border rounded-lg px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/25 focus:border-gold bg-canvas transition-colors"
          >
            <option value="all">All categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="border border-border rounded-lg px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/25 focus:border-gold bg-canvas transition-colors"
          >
            <option value="default">Default sort</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Name: A–Z</option>
            <option value="rating-desc">Top Rated</option>
          </select>
          {!loading && (
            <span className="text-sm text-ink-3 self-center whitespace-nowrap">
              {filteredProducts.length} of {products.length} items
            </span>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center py-20">
            <p className="text-bad mb-4 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-ink text-white px-5 py-2.5 rounded-xl hover:bg-ink/80 transition-colors font-medium text-sm"
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
          <div className="text-center py-24">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-base font-semibold text-ink mb-1">No products found</p>
            <p className="text-sm text-ink-3">Try adjusting your search or filters</p>
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

      <NotificationCenter open={notifCenterOpen} onClose={() => setNotifCenterOpen(false)} />
    </div>
  );
}
