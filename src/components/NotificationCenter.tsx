import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';
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
  success: 'text-green-600 bg-green-100',
  warning: 'text-amber-600 bg-amber-100',
  error: 'text-red-600 bg-red-100',
  info: 'text-blue-600 bg-blue-100',
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
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notification center"
        className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white z-50 shadow-xl flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDiagnostic}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors relative"
              title="Copy diagnostic info to clipboard"
            >
              {copied ? 'Copied!' : 'Copy diagnostic'}
            </button>
            <button
              onClick={() => dispatch({ type: 'DISMISS_ALL' })}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors"
            >
              Clear all
            </button>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close notification center"
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-100 px-4 gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`text-xs font-medium py-2 px-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-12">No notifications</div>
          ) : (
            [...filtered].reverse().map(n => (
              <div
                key={n.id}
                className={`flex gap-3 px-4 py-3 transition-opacity ${n.dismissed ? 'opacity-50' : ''}`}
              >
                <span
                  className={`mt-0.5 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${TYPE_COLOR[n.type]}`}
                >
                  {TYPE_ICON[n.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
