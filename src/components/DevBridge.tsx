import { useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import { useOrder } from '../contexts/OrderContext';
import { useNotification } from '../contexts/NotificationContext';
import { getAuditLog } from '../utils/auditLog';
import type { CartState, OrderState, Notification, AuditEvent } from '../types';

interface AppDevAPI {
  getCartState: () => CartState;
  getOrderState: () => OrderState;
  getAuditLog: () => AuditEvent[];
  getNotifHistory: () => Notification[];
}

declare global {
  interface Window {
    __app?: AppDevAPI;
  }
}

/**
 * Zero-render DEV-only component.
 * Attaches live context state accessors to window.__app for console debugging.
 * Only mounted in development (caller is responsible for the DEV guard).
 */
export default function DevBridge() {
  const { state: cartState } = useCart();
  const { state: orderState } = useOrder();
  const { state: notifState } = useNotification();

  useEffect(() => {
    window.__app = {
      getCartState: () => cartState,
      getOrderState: () => orderState,
      getAuditLog,
      getNotifHistory: () => notifState.history,
    };
  }, [cartState, orderState, notifState.history]);

  return null;
}
