# OpenCart — Secure Checkout Demo

A high-performance, security-aware checkout application built with React 19, TypeScript, and Tailwind CSS.

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later

## Getting Started

```bash
# Install dependencies
bun install

# Start development server (with HMR)
bun run dev

# Build for production
bun run build

# Preview production build locally
bun run preview
```

## Development Tools

In the browser console during development, the following globals are available:

```js
// Simulate tampering attacks (for demo/testing)
window.__devTools.simulatePriceTampering(productId, newPrice)
window.__devTools.simulateChecksumTampering()

// Inspect live application state
window.__app.getCartState()
window.__app.getOrderState()
window.__app.getAuditLog()
window.__app.getNotifHistory()
```

## Project Structure

```
src/
├── components/     Reusable UI components
├── contexts/       React Context providers (Cart, Order, Notification)
├── hooks/          Custom hooks
├── machines/       Order state machine
├── pages/          Route-level page components (lazy-loaded)
├── reducers/       Pure reducer functions
├── router/         Browser router configuration
├── services/       API and order submission services
├── types/          Shared TypeScript types
└── utils/          Pure utility functions (FNV-1a, audit log, logger, …)

docs/               Written deliverables
public/icons/       PWA icon assets
```

## Key Features

- **600-product catalog** with search, filter, and sort
- **Virtualized cart list** (react-window) — only visible rows rendered
- **7-check security validation pipeline** at checkout
- **FNV-1a checksum integrity** on cart contents
- **Price tampering detection** via snapshotPrice comparison
- **Cross-tab conflict detection** via StorageEvent
- **Idempotency key** per checkout attempt (consume-once)
- **Order state machine** with explicit valid transitions
- **Toast notification system** with ARIA live regions
- **Notification Center** with history, filters, and diagnostic export
- **Order timeline** visualization
- **PWA** with service worker, offline support, and installability
- **Structured logging** (DEV only) with feature namespaces

## Documentation

See the [`docs/`](docs/) folder for:

- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Stack, context ownership, data flow, state machine
- [`EDGE_CASES.md`](docs/EDGE_CASES.md) — All security and UX edge cases with detection mechanisms
- [`PERFORMANCE.md`](docs/PERFORMANCE.md) — Performance techniques with evidence
- [`SECURITY.md`](docs/SECURITY.md) — Threat model, detection table, audit log format
- [`NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) — Queue rules, dedup algorithm, ARIA, trigger table
- [`ORIGINALITY.md`](docs/ORIGINALITY.md) — Library inventory and API attribution
