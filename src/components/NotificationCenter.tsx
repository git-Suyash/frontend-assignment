import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotification } from '../hooks/useNotification';
import { getAuditLog } from '../utils/auditLog';
import type { Notification, NotificationType } from '../types';

type FilterTab = 'all' | NotificationType;

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
  { label: 'Info', value: 'info' },
];

const TYPE_ICON: Record<NotificationType, string> = {
  success: '✓',
  warning: '!',
  error: '✕',
  info: 'i',
};

const TYPE_COLOR: Record<NotificationType, string> = {
  success: 'text-ok bg-ok-muted',
  warning: 'text-warn bg-warn-muted',
  error:   'text-bad bg-bad-muted',
  info:    'text-note bg-note-muted',
};

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { state, dispatch } = useNotification();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus close button when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    []
  );

  const filtered: Notification[] =
    activeTab === 'all'
      ? state.history
      : state.history.filter(n => n.type === activeTab);

  async function handleCopyDiagnostic() {
    const data = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        notificationHistory: state.history.map(n => ({
          type: n.type,
          title: n.title,
          timestamp: n.timestamp,
        })),
        auditLog: getAuditLog(),
      },
      null,
      2
    );

    try {
      await navigator.clipboard.writeText(data);
    } catch {
      // Fallback: textarea select trick
      const ta = document.createElement('textarea');
      ta.value = data;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/20 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notification center"
        className="fixed top-0 right-0 h-full w-full sm:w-96 bg-surface z-50 shadow-2xl flex flex-col animate-slide-in-right"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-base font-bold text-ink">Notifications</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyDiagnostic}
              className="text-xs text-ink-3 hover:text-ink border border-border rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted"
              title="Copy diagnostic info to clipboard"
            >
              {copied ? 'Copied!' : 'Diagnostics'}
            </button>
            <button
              onClick={() => dispatch({ type: 'CLEAR_HISTORY' })}
              className="text-xs text-ink-3 hover:text-ink border border-border rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted"
            >
              Clear all
            </button>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close notification center"
              className="text-ink-3 hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-muted ml-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border px-5 gap-0.5 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`text-xs font-medium py-3 px-3 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-gold text-gold'
                  : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-ink-3 text-sm py-16">
              <p className="text-2xl mb-2">🔔</p>
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[...filtered].reverse().map(n => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-5 py-3.5 transition-opacity ${n.dismissed ? 'opacity-40' : ''}`}
                >
                  <span
                    className={`mt-0.5 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${TYPE_COLOR[n.type]}`}
                  >
                    {TYPE_ICON[n.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    <p className="text-xs text-ink-2 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[11px] text-ink-3 mt-1">{formatRelativeTime(n.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
