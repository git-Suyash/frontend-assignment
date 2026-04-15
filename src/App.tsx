import { lazy, Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { NotificationProvider } from './contexts/NotificationProvider';
import { OrderProvider } from './contexts/OrderProvider';
import { CartProvider } from './contexts/CartProvider';
import { router } from './router';
import NotificationQueue from './components/NotificationQueue';
import { useOnlineStatus } from './hooks/useOnlineStatus';

const DevBridge = import.meta.env.DEV
  ? lazy(() => import('./components/DevBridge'))
  : null;

function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] bg-warn text-white text-sm font-medium text-center py-2 px-4"
    >
      You are currently offline. Some features may be unavailable.
    </div>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <OrderProvider>
        <CartProvider>
          <OfflineBanner />
          <NotificationQueue />
          {DevBridge && (
            <Suspense fallback={null}>
              <DevBridge />
            </Suspense>
          )}
          <RouterProvider router={router} />
        </CartProvider>
      </OrderProvider>
    </NotificationProvider>
  );
}
