# Performance

## Technique Table

| # | Technique | Implementation Location | Evidence Type |
|---|---|---|---|
| 1 | **Virtual list rendering** | `CartPage.tsx` → `react-window v2 <List>` | Chrome Elements panel: only ~8 DOM rows exist regardless of cart size |
| 2 | **React Compiler auto-memoisation** | `babel-plugin-react-compiler` in `vite.config.ts` | React DevTools Profiler: components skip re-renders without manual `useMemo` |
| 3 | **Debounced search input** | `useDebounce.ts` (300 ms) in `ProductsPage.tsx` | Network tab: filter re-computation fires at most once per 300 ms idle period |
| 4 | **Code splitting / lazy routes** | `router/index.tsx` → `React.lazy()` on all pages | `bun run build` output: separate JS chunks per page |
| 5 | **PWA StaleWhileRevalidate caching** | `vite.config.ts` Workbox `runtimeCaching` | DevTools → Application → Cache Storage: fakestoreapi responses cached after first load |

---

## Evidence

### 1. Virtual List

Only visible rows are mounted in the DOM. With 600 products, the cart list creates only enough DOM nodes to fill the viewport (~8 rows at 80px each).

```tsx
// CartPage.tsx
<List<CartRowExtraProps>
  rowComponent={CartRow}
  rowProps={{ items, dispatch, onItemRemoved: handleItemRemoved }}
  rowCount={items.length}
  rowHeight={80}
  style={{ height: listHeight }}
/>
```

*To verify:* Open DevTools → Elements, add 50+ items to the cart, inspect the List container. You will see a fixed number of `<div class="cart-row">` elements regardless of total item count.

---

### 2. React Compiler Auto-Memoisation

The React Compiler (babel-plugin-react-compiler) analyses component trees at build time and automatically inserts the equivalent of `useMemo`/`useCallback`/`React.memo` where needed. No manual annotations are required.

```ts
// vite.config.ts
babel({ presets: [reactCompilerPreset()] })
```

*To verify:* Open React DevTools Profiler, record a session while updating a single cart item's quantity. Only the affected `CartRow` shows a re-render highlight; sibling rows are skipped.

---

### 3. Debounced Search

Search state is split into `rawSearch` (bound to input) and `debouncedSearch` (300 ms debounce). `useProductFilter` only recomputes when `debouncedSearch` settles.

```ts
// ProductsPage.tsx
const debouncedSearch = useDebounce(rawSearch, 300);
const filteredProducts = useProductFilter(products, debouncedSearch, category, sortBy);
```

*To verify:* Type quickly in the search box while watching the React Profiler. Filter re-computation fires once, 300 ms after the last keystroke.

---

### 4. Code Splitting

All route-level pages are lazy-loaded. Vite emits a separate chunk for each page:

```
dist/assets/ProductsPage-*.js   ~10 kB
dist/assets/CartPage-*.js       ~17 kB
dist/assets/CheckoutPage-*.js   ~15 kB
dist/assets/OrderPage-*.js       ~9 kB
```

The main bundle only loads the routing shell; page bundles are fetched on demand.

```tsx
// router/index.tsx
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
```

*To verify:* Open DevTools → Network, filter by JS, navigate between pages, observe separate chunk fetches.

---

### 5. PWA Caching

The service worker uses `StaleWhileRevalidate` for Fake Store API product data (24-hour TTL) and `CacheFirst` for product images (7-day TTL). After the first load, both products and images serve from cache instantly.

```ts
// vite.config.ts (Workbox runtimeCaching)
{ urlPattern: /^https:\/\/fakestoreapi\.com\/.*/i, handler: 'StaleWhileRevalidate', ... }
{ urlPattern: /^https:\/\/fakestoreapi\.com\/img\/.*/i, handler: 'CacheFirst', ... }
```

*To verify:* Load the app, then in DevTools → Application → Cache Storage you will see `fakestoreapi-cache` and `product-images` stores populated.

---

## Profiling Methodology

1. Build production bundle: `bun run build && bun run preview`
2. Open Chrome DevTools → Performance tab
3. For virtual list: record while scrolling the cart list with 50+ items
4. For React Compiler: use React DevTools Profiler → record while changing one item quantity
5. For debounce: Network tab → filter XHR/Fetch, type in search bar, verify single network call
6. For code splitting: Network tab → JS, navigate pages, verify distinct chunk loads
7. For PWA cache: Application → Cache Storage → inspect entries after first load
