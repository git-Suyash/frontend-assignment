import { RouterProvider } from 'react-router-dom';
import { NotificationProvider } from './contexts/NotificationContext';
import { OrderProvider } from './contexts/OrderContext';
import { CartProvider } from './contexts/CartContext';
import { router } from './router';
import NotificationQueue from './components/NotificationQueue';

export default function App() {
  return (
    <NotificationProvider>
      <OrderProvider>
        <CartProvider>
          <NotificationQueue />
          <RouterProvider router={router} />
        </CartProvider>
      </OrderProvider>
    </NotificationProvider>
  );
}
