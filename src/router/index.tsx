import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

// Critical-path pages: eagerly imported so they're always in the main bundle
// and available even if the user was offline when the app first loaded.
import CartPage from '../pages/CartPage';
import CheckoutPage from '../pages/CheckoutPage';
import OfflinePage from '../pages/OfflinePage';
import { NotFoundPage, PageSkeleton, RouteErrorBoundary } from './components';

// Non-critical pages: lazy-loaded since they're not needed on the core flow.
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const OrderPage = lazy(() => import('../pages/OrderPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <ProductsPage />
      </Suspense>
    ),
  },
  {
    path: '/cart',
    errorElement: <RouteErrorBoundary />,
    element: <CartPage />,
  },
  {
    path: '/checkout',
    errorElement: <RouteErrorBoundary />,
    element: <CheckoutPage />,
  },
  {
    path: '/order/:id',
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <OrderPage />
      </Suspense>
    ),
  },
  {
    path: '/offline',
    errorElement: <RouteErrorBoundary />,
    element: <OfflinePage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
