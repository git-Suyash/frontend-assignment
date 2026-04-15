# Security

## 1. Threat Model

This application simulates a client-side checkout flow. The following attack scenarios are intentionally modelled and detectable:

| Attack | Why it Matters |
|---|---|
| **Price tampering** | An attacker edits `localStorage` to reduce product prices before checkout, hoping the server accepts the client-supplied total |
| **Checksum bypass** | An attacker modifies cart items but not the integrity hash, or corrupts the hash directly |
| **Cross-storage tampering** | An attacker modifies both the `snapshotPrice` and the FNV-1a checksum in `localStorage` — circumventing checks 4 & 5 — but fails to also manipulate the IDB baseline and its SHA-256 digest |
| **Stale price exploitation** | An attacker adds an item at a low price, waits for the price to change, and submits the order at the old (lower) price |
| **Idempotency replay** | An attacker replays a previously submitted checkout request to create a duplicate order |
| **Cross-tab cart injection** | A malicious script in another tab modifies `localStorage` to inject fraudulent items |
| **Double-submit race condition** | Rapid repeated form submission before the UI can disable the button |

---

## 2. Detection Mechanisms

### Checkout validation pipeline (10 checks, fail-fast)

| Check | Attack Detected | Mechanism | Code Location | User Response |
|---|---|---|---|---|
| 1 | Empty cart | `items.length === 0` guard | `checkoutValidation.ts` | Warning toast. Redirect to `/`. |
| 2 | Double-submit | `status === 'locked'`; button `disabled` | `checkoutValidation.ts`, `CheckoutPage.tsx` | Button disabled; validation returns `CART_LOCKED` if bypassed. |
| 3 | Cross-tab injection | `status === 'conflict'` set by `StorageEvent` listener | `CartProvider.tsx` → `handleStorage()` | Amber conflict banner. Checkout blocked until resolved. |
| 4 | Checksum bypass / localStorage mutation | Recomputes FNV-1a 32-bit hash over all items; compares to stored `cartState.checksum` | `src/utils/fnv1a.ts`, `checkoutValidation.ts` | Error toast "Security check failed". |
| 5 | In-memory price tampering | `detectPriceTampering()`: `item.product.price !== item.snapshotPrice` | `src/utils/priceValidation.ts` | Error toast "Tampering detected". |
| 6 | IDB baseline tampered | `verifyBaselineIntegrity()`: recomputes SHA-256 digest of sorted `id:price` entries; mismatch blocks checkout | `src/utils/catalogDb.ts`, `checkoutValidation.ts` | Error toast "Tampering detected". |
| 7 | Cross-storage price tampering | `validateAgainstBaseline()`: compares each `snapshotPrice` against the IDB baseline price for that product ID | `src/utils/priceValidation.ts` | Error toast "Tampering detected". |
| 8 | Cart total manipulation | `validateCartTotal()`: recomputes expected total from IDB baseline prices; compares against `snapshotPrice`-derived total | `src/utils/priceValidation.ts` | Error toast "Tampering detected". |
| 9 | Stale price exploitation | `detectStalePrice()`: re-fetches all products from API; flags any item where `|snapshotPrice − freshPrice| > 0.01` | `src/utils/priceValidation.ts`, `checkoutValidation.ts` | Warning toast "Prices changed". User must review cart. |
| 10 | Idempotency replay | `consumeIdempotencyKey()`: UUID per checkout attempt; consumed keys persisted in localStorage (last 10); returns `false` on re-use | `src/utils/idempotency.ts` | Warning toast "Duplicate attempt". New key generated. |

### Defence-in-depth model

The baseline checks (6–8) operate across a separate storage partition (IndexedDB) from the FNV-1a checks (4–5, localStorage). To smuggle an altered price through to checkout an attacker must:

1. Modify `snapshotPrice` in `localStorage` ← caught by check 4 (checksum)
2. Also update the FNV-1a checksum in `localStorage` ← caught by check 5 (in-memory compare)
3. Also modify the `price_baseline` record in IndexedDB ← caught by check 6 (SHA-256 digest mismatch)
4. Also reproduce the SHA-256 digest over the canonical serialisation of every price ← computationally unforgeable in the browser

### Price baseline lifecycle

The baseline is written to IndexedDB **once** per catalog load — not on every cart mutation — via `setPriceBaseline()` called from `useProducts` → `applyProducts()`. It is never stored in `localStorage` or `CartState`. At checkout, `getPriceBaseline()` reads it and `verifyBaselineIntegrity()` recomputes its SHA-256 digest before any price comparison takes place.

---

## 3. Audit Log Format

Every security-relevant event is written to `localStorage` key `audit_log` and logged to the console in development.

```typescript
interface AuditEvent {
  timestamp: number;       // Unix milliseconds
  event: AuditEventType;   // e.g. 'CHECKSUM_MISMATCH', 'PRICE_TAMPERING_DETECTED'
  sessionId: string;       // Anonymous UUID from sessionStorage — never user-identifying
  cartVersion?: number;    // Cart version at time of event
  cartItemCount?: number;  // Number of items in cart
  reason?: string;         // Human-readable reason string
}
```

**Event types:** `CART_ITEM_ADDED`, `CART_ITEM_REMOVED`, `CART_QUANTITY_UPDATED`, `CART_CLEARED`, `CART_CONFLICT_DETECTED`, `CHECKSUM_COMPUTED`, `CHECKSUM_MISMATCH`, `PRICE_TAMPERING_DETECTED`, `BASELINE_INTEGRITY_FAILED`, `BASELINE_TAMPERING_DETECTED`, `BASELINE_MISSING`, `STALE_PRICE_DETECTED`, `CHECKOUT_VALIDATED`, `CHECKOUT_BLOCKED`, `ORDER_SUBMITTED`, `ORDER_SUCCESS`, `ORDER_FAILED`, `ORDER_INCONSISTENT`, `IDEMPOTENCY_BLOCK`, `ROLLBACK_INITIATED`, `RETRY_INITIATED`

The log is capped at 100 entries (oldest discarded). It can be exported via `window.__devTools.getAuditLog()` or through the "Copy diagnostic info" button in the Notification Center.

---

## 4. IndexedDB Schema

The `opencart_catalog` IndexedDB database (version 2) contains two object stores:

| Store | Key | Contents |
|---|---|---|
| `cache` | `"catalog"` | `{ products, categories, cachedAt }` — the full product catalog with 24-hour TTL |
| `price_baseline` | `"baseline"` | `{ entries: [{id, price}], savedAt, integrity }` — trusted price snapshot with SHA-256 digest |

The two stores share a single `openDb()` call; the `onupgradeneeded` handler creates whichever stores are missing, so existing v1 databases are upgraded transparently on first open.

---

## 5. Limitations

**This is a frontend-only simulation, not real security.**

- All checks occur in the browser. A determined attacker can bypass them by sending API requests directly with arbitrary payloads.
- `localStorage` is mutable by any JavaScript running in the same origin, including the attacker's own code.
- The `snapshotPrice` integrity model requires the server to independently validate prices against its own database before processing payment — this server-side validation does not exist in this demo (it uses the Fake Store API / JSONPlaceholder).
- The session ID in the audit log is anonymous and regenerated per browser session; it provides no real user attribution.
- The idempotency key list stored in `localStorage` is client-controlled and can be cleared by the user.

These mechanisms exist to demonstrate the *detection patterns* that a production system would implement on both the client and server sides.
