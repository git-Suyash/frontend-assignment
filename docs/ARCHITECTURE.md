# Architecture

## 1. Stack Overview

| Technology | Choice | Why |
|---|---|---|
| **Runtime** | Bun | Faster installs and test execution than Node; compatible with Node APIs |
| **Bundler** | Vite 8 | Near-instant HMR, native ESM, excellent plugin ecosystem |
| **UI library** | React 19 | Concurrent features, built-in `use()`, stable Actions API |
| **Compiler** | React Compiler (babel-plugin-react-compiler) | Automatic memoisation — no manual `useMemo`/`useCallback` needed |
| **Language** | TypeScript strict mode | Eliminates whole categories of runtime bugs at authoring time |
| **Styling** | Tailwind CSS v4 | Utility-first, no runtime, Vite plugin for zero-config setup |
| **Routing** | React Router v7 | File-free route definition, `createBrowserRouter`, selective lazy page loading, per-route `errorElement` |
| **Virtual list** | react-window v2 | Renders only visible rows — essential for 600-product cart list |
| **State** | React Context + useReducer | Sufficient for this scale; avoids adding Zustand/Redux overhead |
| **PWA** | vite-plugin-pwa + Workbox | Service worker generation, offline cache, installability |

---

## 2. Context Ownership Diagram

```
App
└── NotificationProvider  ← owns: { queue[], history[] }
    └── OrderProvider     ← owns: { current, orderId, timestamps, retryCount, failureReason }
        └── CartProvider  ← owns: { items[], version, checksum, baselineSnapshot, idempotencyKey, status }
            ├── NotificationQueue      (reads NotificationContext)
            ├── OfflineBanner          (reads useOnlineStatus hook — no context)
            ├── DevBridge (DEV only)   (reads all three contexts → window.__app)
            └── RouterProvider
                ├── ProductsPage       (reads CartContext, NotificationContext)
                ├── CartPage           (reads CartContext, NotificationContext)
                ├── CheckoutPage       (reads CartContext, OrderContext, NotificationContext)
                ├── OrderPage          (reads OrderContext, CartContext, NotificationContext)
                └── OfflinePage        (reads CartContext)
```

Each context is consumed only by components that need it. No prop-drilling occurs; all shared state travels through context.

---

## 3. Data Flow Narrative — "User clicks Add to Cart"

1. **User clicks** "Add to Cart" in `ProductsPage` → `handleAddToCart(product)` fires.
2. `cartDispatch({ type: 'ADD_ITEM', payload: product })` is called.
3. `cartReducer` receives the action. It finds or creates a `CartItem`, increments quantity, recomputes the **FNV-1a 32-bit checksum** over all items (sorted by productId for order-independence), bumps `version`, and returns new state.
4. `CartContext`'s `useEffect([state])` fires → `persistCart(state)` writes the new state to `localStorage` under key `checkout_cart`.
5. Any other open tab receives a `StorageEvent` → `CartProvider` compares versions → if newer, `SYNC_FROM_STORAGE` + `SET_STATUS: conflict` + `notify('warning', 'Cart conflict', ...)`.
6. Back in `ProductsPage`, `notify('success', 'Cart updated', '...')` fires → `NotificationContext`'s `notify()` dispatches `PUSH` to `notifReducer`.
7. `notifReducer` dedup-checks within 3 s by `dedupKey` → if unique, appends to both `queue` and `history` (capped at 200).
8. `NotificationQueue` re-renders → shows `NotificationToast` with the new item → auto-dismiss timer starts.
9. The ARIA live region (`aria-live="polite"`) in `NotificationProvider` picks up the new title → screen readers announce it.
10. The cart icon badge in the header re-renders because `cartItemCount` derived from `state.items` changed.

---

## 4. State Machine — Order Lifecycle

| State | Label | Valid Transitions | Trigger |
|---|---|---|---|
| `CART_READY` | Cart ready | `CHECKOUT_VALIDATED` | User submits checkout form |
| `CHECKOUT_VALIDATED` | Checkout validated | `ORDER_SUBMITTED`, `CART_READY` | All 7 security checks pass; or validation fails |
| `ORDER_SUBMITTED` | Order submitted | `ORDER_SUCCESS`, `ORDER_FAILED`, `ORDER_INCONSISTENT` | `submitOrder()` resolves or rejects |
| `ORDER_SUCCESS` | Order successful | *(terminal)* | API returns 201, no partial failure |
| `ORDER_FAILED` | Order failed | `ORDER_SUBMITTED`, `ROLLED_BACK` | Network/API error thrown |
| `ORDER_INCONSISTENT` | Order inconsistent | `ORDER_SUBMITTED`, `ROLLED_BACK` | API succeeded but `simulatePartialFailure()` fired |
| `ROLLED_BACK` | Rolled back | `CART_READY` | User clicks "Cancel & restore cart" |

All transitions are validated by `transition(from, to)` in `orderStateMachine.ts`. Invalid transitions are logged and the state is returned unchanged.

---

## 5. Folder Structure

```
src/
├── components/        UI building blocks (CartRow, OrderTimeline, NotificationToast, …)
├── contexts/          Context objects only — one file per context (no components, no hooks)
│   ├── CartContext.tsx          createContext call + CartContextValue interface
│   ├── CartProvider.tsx         CartProvider component (localStorage sync, cross-tab listener)
│   ├── OrderContext.tsx         createContext call + OrderContextValue interface
│   ├── OrderProvider.tsx        OrderProvider component (order persistence effects)
│   ├── NotificationContext.tsx  createContext call + NotificationContextValue interface
│   └── NotificationProvider.tsx NotificationProvider component (notify helper, ARIA regions)
├── hooks/             Custom hooks — each file exports exactly one hook
│   ├── useCart.ts               Consumer hook for CartContext (throws outside CartProvider)
│   ├── useOrder.ts              Consumer hook for OrderContext
│   ├── useNotification.ts       Consumer hook for NotificationContext
│   ├── useProducts.ts           Stale-while-revalidate product loader
│   ├── useProductFilter.ts      Search + sort + category filter pipeline
│   ├── useOnlineStatus.ts       navigator.onLine + online/offline events
│   └── useDebounce.ts           Generic debounce — used for search input
├── machines/          Order state machine — transitions, labels, terminal check
├── pages/             Route-level components (ProductsPage + OrderPage are lazy-loaded;
│                      CartPage, CheckoutPage, OfflinePage are eagerly bundled)
├── reducers/          Pure reducer functions for each context
├── router/            createBrowserRouter config, RouteErrorBoundary, lazy page imports
├── services/          API calls (api.ts) and order submission (orders.ts)
├── types/             Single index.ts — all shared TypeScript types
└── utils/             Pure utilities: fnv1a, idempotency, storage, auditLog, logger, …

docs/                  Written deliverables (this file + 5 others)
public/icons/          PWA icon assets
```

### Context Module Convention

Each context is split across three files to satisfy Vite Fast Refresh constraints (a `.tsx` file may only export React components for HMR to work correctly):

| File | Exports | Vite HMR |
|---|---|---|
| `contexts/XxxContext.tsx` | `XxxContext` object + `XxxContextValue` interface | No components — no constraint |
| `contexts/XxxProvider.tsx` | `XxxProvider` component **only** | One component — Fast Refresh works |
| `hooks/useXxx.ts` | `useXxx` hook **only** | Plain `.ts` — no HMR constraint |

All consumer files (pages, components, other hooks) import exclusively from the `hooks/` layer.
