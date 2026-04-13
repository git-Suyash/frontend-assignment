import { useEffect } from 'react';
import type { Notification, NotificationType } from '../types';

interface TypeStyle {
  border: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  progressColor: string;
}

const TYPE_STYLES: Record<NotificationType, TypeStyle> = {
  success: {
    border: 'border-l-green-500',
    icon: '✓',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-700',
    progressColor: 'bg-green-500',
  },
  warning: {
    border: 'border-l-amber-500',
    icon: '!',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    progressColor: 'bg-amber-500',
  },
  error: {
    border: 'border-l-red-500',
    icon: '✕',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-700',
    progressColor: 'bg-red-500',
  },
  info: {
    border: 'border-l-blue-500',
    icon: 'i',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    progressColor: 'bg-blue-500',
  },
};

interface NotificationToastProps {
  notification: Notification;
  onDismiss: () => void;
}

export default function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const { id, type, title, message } = notification;
  const duration = type === 'error' ? 10000 : 5000;
  const s = TYPE_STYLES[type];

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      className={`relative bg-white rounded-lg shadow-lg border border-gray-200 border-l-4 ${s.border} overflow-hidden w-full max-w-sm pointer-events-auto`}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4 pr-10">
        <span
          className={`mt-0.5 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${s.iconBg} ${s.iconColor}`}
        >
          {s.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-500 mt-0.5 leading-snug">{message}</p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Auto-dismiss progress bar */}
      <div className="h-0.5 bg-gray-100">
        <div
          className={`h-0.5 ${s.progressColor}`}
          style={{
            animation: `toast-shrink ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
