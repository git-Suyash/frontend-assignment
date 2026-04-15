import { useNotification } from '../hooks/useNotification';
import NotificationToast from './NotificationToast';

export default function NotificationQueue() {
  const { state, dispatch } = useNotification();

  // Show only non-dismissed, up to 5 most recent
  const visible = state.queue.filter(n => !n.dismissed).slice(-5);

  if (visible.length === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 sm:top-4 sm:right-4 sm:left-auto z-50 flex flex-col gap-2 pointer-events-none sm:w-80 p-2 sm:p-0"
      aria-label="Notifications"
    >
      {visible.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() =>
            dispatch({ type: 'DISMISS', payload: { id: notification.id } })
          }
        />
      ))}
    </div>
  );
}
