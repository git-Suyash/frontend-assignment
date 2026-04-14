# Security

## 1. Threat Model

This application simulates a client-side checkout flow. The following attack scenarios are intentionally modelled and detectable:

| Attack | Why it Matters |
|---|---|
| **Price tampering** | An attacker edits `localStorage` to reduce product prices before checkout, hoping the server accepts the client-supplied total |
| **Checksum bypass** | An attacker modifies cart items but not the integrity hash, or corrupts the hash directly |
| **Stale price exploitation** | An attacker adds an item at a low price, waits for the price to change, and submits the order at the old (lower) price |
| **Idempotency replay** | An attacker replays a previously submitted checkout request to create a duplicate order |
| **Cross-tab cart injection** | A malicious script in another tab modifies `localStorage` to inject fraudulent items |
| **Double-submit race condition** | Rapid repeated form submission before the UI can disable the button |

---

## 2. Detection Mechanisms

| Attack | Detection Mechanism | Code Location | User Response |
|---|---|---|---|
| Price tampering | `detectPriceTampering(items)`: compares `item.product.price` vs `item.snapshotPrice` for every item — snapshot is set on add and never mutated | `src/utils/priceValidation.ts` → `detectPriceTampering()` | Error toast "Tampering detected". Checkout blocked. Idempotency key reset. |
| Checksum mismatch | `computeCartChecksum(items)` recomputes FNV-1a 32-bit hash at checkout and compares to stored `cartState.checksum` | `src/utils/fnv1a.ts` → `computeCartChecksum()`, `src/services/checkoutValidation.ts` Check 4 | Error toast "Security check failed". Checkout blocked. |
| Stale prices | `detectStalePrice(items, freshPrices)`: re-fetches all products from API; flags any item where `|snapshotPrice - freshPrice| > 0.01` | `src/utils/priceValidation.ts` → `detectStalePrice()`, `src/services/checkoutValidation.ts` Check 6 | Warning toast "Prices changed". User must review cart. |
| Idempotency replay | `consumeIdempotencyKey(key)`: UUID generated per checkout attempt; consumed keys stored in localStorage (last 10); returns `false` on re-use | `src/utils/idempotency.ts` → `consumeIdempotencyKey()`, `checkoutValidation.ts` Check 7 | Warning toast "Duplicate attempt". New key generated for next attempt. |
| Cross-tab cart injection | `StorageEvent` listener in `CartProvider`: detects external writes to `checkout_cart` key; sets `status: 'conflict'` | `src/contexts/CartContext.tsx` → `handleStorage()` | Warning toast + amber conflict banner in CartPage. Checkout blocked until resolved. |
| Double-submit race | Cart `status: 'locked'` set immediately on submission; `disabled={submitting}` on button; Check 2 in `validateCheckout` rejects locked cart | `src/pages/CheckoutPage.tsx`, `src/services/checkoutValidation.ts` Check 2 | Button disabled; if bypassed, validation returns `CART_LOCKED`. |

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

**Event types:** `CART_ITEM_ADDED`, `CART_ITEM_REMOVED`, `CART_QUANTITY_UPDATED`, `CART_CLEARED`, `CART_CONFLICT_DETECTED`, `CHECKSUM_COMPUTED`, `CHECKSUM_MISMATCH`, `PRICE_TAMPERING_DETECTED`, `STALE_PRICE_DETECTED`, `CHECKOUT_VALIDATED`, `CHECKOUT_BLOCKED`, `ORDER_SUBMITTED`, `ORDER_SUCCESS`, `ORDER_FAILED`, `ORDER_INCONSISTENT`, `IDEMPOTENCY_BLOCK`, `ROLLBACK_INITIATED`, `RETRY_INITIATED`

The log is capped at 100 entries (oldest discarded). It can be exported via `window.__devTools.getAuditLog()` or through the "Copy diagnostic info" button in the Notification Center.

---

## 4. Limitations

**This is a frontend-only simulation, not real security.**

- All checks occur in the browser. A determined attacker can bypass them by sending API requests directly with arbitrary payloads.
- `localStorage` is mutable by any JavaScript running in the same origin, including the attacker's own code.
- The `snapshotPrice` integrity model requires the server to independently validate prices against its own database before processing payment — this server-side validation does not exist in this demo (it uses the Fake Store API / JSONPlaceholder).
- The session ID in the audit log is anonymous and regenerated per browser session; it provides no real user attribution.
- The idempotency key list stored in `localStorage` is client-controlled and can be cleared by the user.

These mechanisms exist to demonstrate the *detection patterns* that a production system would implement on both the client and server sides.
