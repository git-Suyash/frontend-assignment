// ─── Product & Cart ───────────────────────────────────────────────────────────

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: { rate: number; count: number };
}

export interface CartItem {
  product: Product;
  quantity: number;
  snapshotPrice: number; // Price at the time item was added — never mutated after add
}

// ─── Cart State ───────────────────────────────────────────────────────────────

export type CartStatus =
  | 'idle'       // Normal browsing
  | 'locked'     // Checkout submission in progress — all UI interactions disabled
  | 'conflict';  // Cart was modified in another tab

export interface CartState {
  items: CartItem[];
  version: number;        // Increments on every mutation. Used for cross-tab conflict detection.
  checksum: string;       // FNV-1a hash of serialized items (id+qty+price). Recomputed on every mutation.
  idempotencyKey: string; // UUID for the current checkout session. Generated fresh per checkout attempt.
  status: CartStatus;
}

// ─── Cart Actions ─────────────────────────────────────────────────────────────

export type CartAction =
  | { type: 'ADD_ITEM'; payload: Product }
  | { type: 'REMOVE_ITEM'; payload: { productId: number } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: number; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_LOCK'; payload: { locked: boolean } }
  | { type: 'SET_STATUS'; payload: { status: CartStatus } }
  | { type: 'SYNC_FROM_STORAGE'; payload: CartState }
  | { type: 'RESET_IDEMPOTENCY_KEY' };

// ─── Order State Machine ──────────────────────────────────────────────────────

export type OrderStateName =
  | 'CART_READY'
  | 'CHECKOUT_VALIDATED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_SUCCESS'
  | 'ORDER_FAILED'
  | 'ORDER_INCONSISTENT'
  | 'ROLLED_BACK';

export interface OrderState {
  current: OrderStateName;
  orderId: string | null;
  timestamps: Partial<Record<OrderStateName, number>>; // Unix ms per state entry
  retryCount: number;
  failureReason: string | null;
}

export type OrderAction =
  | { type: 'TRANSITION'; payload: { to: OrderStateName; reason?: string } }
  | { type: 'SET_ORDER_ID'; payload: { orderId: string } }
  | { type: 'INCREMENT_RETRY' }
  | { type: 'RESET_ORDER' };

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface Notification {
  id: string;           // UUID
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;    // Unix ms
  dismissed: boolean;
  dedupKey: string;     // type + ':' + title — used to prevent rapid duplicate notifications
}

export type NotificationAction =
  | { type: 'PUSH'; payload: Omit<Notification, 'id' | 'timestamp' | 'dismissed'> }
  | { type: 'DISMISS'; payload: { id: string } }
  | { type: 'DISMISS_ALL' }
  | { type: 'CLEAR_HISTORY' };

// ─── Audit Log ────────────────────────────────────────────────────────────────

export type AuditEventType =
  | 'CART_ITEM_ADDED'
  | 'CART_ITEM_REMOVED'
  | 'CART_QUANTITY_UPDATED'
  | 'CART_CLEARED'
  | 'CART_CONFLICT_DETECTED'
  | 'CHECKSUM_COMPUTED'
  | 'CHECKSUM_MISMATCH'
  | 'PRICE_TAMPERING_DETECTED'
  | 'STALE_PRICE_DETECTED'
  | 'CHECKOUT_VALIDATED'
  | 'CHECKOUT_BLOCKED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_SUCCESS'
  | 'ORDER_FAILED'
  | 'ORDER_INCONSISTENT'
  | 'IDEMPOTENCY_BLOCK'
  | 'ROLLBACK_INITIATED'
  | 'RETRY_INITIATED'
  | 'BASELINE_INTEGRITY_FAILED'
  | 'BASELINE_TAMPERING_DETECTED'
  | 'BASELINE_MISSING';

export interface AuditEvent {
  timestamp: number;
  event: AuditEventType;
  cartVersion?: number;
  cartItemCount?: number;
  reason?: string;
  sessionId: string; // Anonymous UUID, generated at app start, never user-identifying
}
