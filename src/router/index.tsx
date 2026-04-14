import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
const OrderPage = lazy(() => import('../pages/OrderPage'));
const OfflinePage = lazy(() => import('../pages/OfflinePage'));

function PageSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse bg-gray-200 rounded-lg w-3/4 h-64" />
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800">404</h1>
        <p className="text-gray-500 mt-2">Page not found</p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <ProductsPage />
      </Suspense>
    ),
  },
  {
    path: '/cart',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <CartPage />
      </Suspense>
    ),
  },
  {
    path: '/checkout',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <CheckoutPage />
      </Suspense>
    ),
  },
  {
    path: '/order/:id',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <OrderPage />
      </Suspense>
    ),
  },
  {
    path: '/offline',
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <OfflinePage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
