import { useEffect } from 'react';
import type { Notification, NotificationType } from '../types';

interface TypeStyle {
  border: string;
  iconBg: string;
  iconColor: string;
  icon: string;
  progressColor: string;
}

const TYPE_STYLES: Record<NotificationType, TypeStyle> = {
  success: {
    border: 'border-l-ok',
    iconBg: 'bg-ok-muted',
    iconColor: 'text-ok',
    icon: '✓',
    progressColor: 'bg-ok',
  },
  warning: {
    border: 'border-l-warn',
    iconBg: 'bg-warn-muted',
    iconColor: 'text-warn',
    icon: '!',
    progressColor: 'bg-warn',
  },
  error: {
    border: 'border-l-bad',
    iconBg: 'bg-bad-muted',
    iconColor: 'text-bad',
    icon: '✕',
    progressColor: 'bg-bad',
  },
  info: {
    border: 'border-l-note',
    iconBg: 'bg-note-muted',
    iconColor: 'text-note',
    icon: 'i',
    progressColor: 'bg-note',
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
      className={`relative bg-surface rounded-xl shadow-lg border border-border border-l-4 ${s.border} overflow-hidden w-full max-w-sm pointer-events-auto animate-fade-up`}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4 pr-10">
        <span
          className={`mt-0.5 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${s.iconBg} ${s.iconColor}`}
        >
          {s.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-ink-2 mt-0.5 leading-relaxed">{message}</p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="absolute top-3 right-3 text-ink-3 hover:text-ink transition-colors p-1 rounded-lg hover:bg-muted"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Auto-dismiss progress bar */}
      <div className="h-0.5 bg-muted">
        <div
          className={`h-0.5 ${s.progressColor}`}
          style={{ animation: `toast-shrink ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}
