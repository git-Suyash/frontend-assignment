# Notifications

## 1. Queue Rules

- **Ordering:** Notifications are added to the end of the queue (`queue` array). `NotificationQueue` renders the last 5 non-dismissed entries (`.slice(-5)`), so the most recent notification is at the bottom of the stack.
- **Capacity:** The live `queue` array is unbounded but only 5 are visible at a time. The `history` array is capped at 200 entries (oldest discarded on overflow).
- **Persistence:** Neither `queue` nor `history` are persisted to `localStorage`. Both are reset on page load. The audit log (separate system) is persisted.
- **Dismissal:** Each notification can be dismissed manually (× button) or auto-dismissed by timer. Dismissed items remain in `history` with `dismissed: true` but are removed from the visible `queue`.

---

## 2. Dedup Algorithm

```typescript
// notifReducer.ts — PUSH case
const dedupKey = action.payload.dedupKey;   // format: "${type}:${title}"
const now = Date.now();
const isDuplicate = state.queue.some(
  n => !n.dismissed && n.dedupKey === dedupKey && now - n.timestamp < 3000
);
if (isDuplicate) return state;  // silently discard
```

- **Key formula:** `dedupKey = "${type}:${title}"` — two notifications are considered duplicates if they share both type and title.
- **Window:** 3000 ms. If the same `dedupKey` appears in the undismissed queue within 3 seconds, the new PUSH is ignored entirely.
- **Scope:** Only non-dismissed queue entries are checked. A dismissed notification does not block future identical notifications.

---

## 3. Auto-Dismiss Timers

| Notification Type | Auto-dismiss Delay |
|---|---|
| `success` | 5000 ms |
| `info` | 5000 ms |
| `warning` | 5000 ms |
| `error` | 10000 ms |

The timer is started in `NotificationToast.tsx` via `useEffect` on mount. The timer is cleared on unmount (component removed before it fires). The progress bar animation duration matches the timer exactly.

---

## 4. ARIA Implementation

| Element | ARIA Attribute | Value | Reason |
|---|---|---|---|
| Polite live region | `aria-live` | `"polite"` | Announces success/info toasts — non-urgent, waits for user idle |
| Assertive live region | `aria-live` | `"assertive"` | Announces error toasts — urgent, interrupts the current narration |
| Both live regions | `aria-atomic` | `"false"` (polite) / `"true"` (assertive) | Error reads fully atomically; info can stream incrementally |
| `NotificationToast` div | `role` | `"alert"` | Marks the toast as an alert for AT, triggers live region behaviour |
| Notification Center | `role` | `"dialog"` | Panel behaves as a modal dialog |
| Notification Center | `aria-modal` | `"true"` | Prevents AT from reading background content |
| Dismiss button | `aria-label` | `"Dismiss notification"` | Provides accessible name for icon-only button |
| Close button (Center) | `aria-label` | `"Close notification center"` | Provides accessible name for icon-only button |

The two ARIA live regions (`id="notif-live-region"` and `id="notif-assertive-region"`) are rendered inside `NotificationProvider`, which is always mounted. This ensures the regions exist in the DOM *before* any notifications fire, preventing the common bug where the first announcement is missed by screen readers.

---

## 5. Complete Notification Trigger Table

| Event | Type | Title | Message |
|---|---|---|---|
| Item added to cart | `success` | "Cart updated" | "{product.title} added to your cart" |
| Item removed from cart | `info` | "Item removed" | "{product.title} removed from cart" |
| Cart conflict (other tab) | `warning` | "Cart conflict" | "Your cart was modified in another tab. Review before checkout." |
| Checkout validation started | `info` | "Validating" | "Checking your cart for issues..." |
| Validation passed | `success` | "Validation passed" | "Your order is ready to submit." |
| Cart empty blocked | `warning` | "Empty cart" | "Add items to your cart before checking out." |
| Checksum mismatch | `error` | "Security check failed" | "Cart integrity could not be verified. Please review your cart." |
| Price tampering | `error` | "Tampering detected" | "Product prices have been altered. Your cart has been reset to original prices." |
| Stale price | `warning` | "Prices changed" | "Some items have new prices. Please review your cart." |
| Idempotency block | `warning` | "Duplicate attempt" | "This order has already been submitted." |
| Cart conflict blocked | `error` | "Cart conflict" | "Resolve the cart conflict before checking out." |
| Order submitting | `info` | "Submitting order" | "Please wait while we process your order..." |
| Order success | `success` | "Order confirmed!" | "Your order #{id} has been placed successfully." |
| Order failed | `error` | "Order failed" | "We couldn't process your order. You can retry or cancel." |
| Order inconsistent | `error` | "Order status unclear" | "There was an issue saving your order. Please choose an action below." |
| Retry initiated | `info` | "Retrying order" | "Attempting to resubmit your order (attempt #{n})." |
| Rollback initiated | `info` | "Order cancelled" | "Your order has been cancelled and your cart restored." |
