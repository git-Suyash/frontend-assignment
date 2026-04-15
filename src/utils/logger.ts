/**
 * logger
 *
 * Lightweight structured console logger scoped to named app features.
 * Output is suppressed entirely outside of development builds so that
 * production bundles emit nothing to the console.
 *
 * Usage:
 *   logger.info('cart', 'Item added', { productId: 42 });
 *   logger.error('order', 'Submission failed', error);
 *
 * Feature namespaces:
 *   'cart'          — cart mutations, storage sync, cross-tab events
 *   'checkout'      — validation pipeline
 *   'order'         — order state machine transitions
 *   'notifications' — notification queue and dedup
 *   'security'      — price tampering, checksum verification
 *   'pwa'           — IndexedDB catalog cache, network revalidation
 *
 * Log levels map to console groups with colour-coded labels for easy
 * filtering in DevTools.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Feature = 'cart' | 'checkout' | 'order' | 'notifications' | 'security' | 'pwa';

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'color: #9ca3af; font-weight: normal',
  info:  'color: #3b82f6; font-weight: bold',
  warn:  'color: #f97316; font-weight: bold',
  error: 'color: #ef4444; font-weight: bold',
};

function log(level: LogLevel, feature: Feature, message: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;

  const label = `[${feature.toUpperCase()}] ${message}`;
  const style = LEVEL_COLORS[level];

  if (data !== undefined) {
    console.groupCollapsed(`%c${label}`, style);
    console.log(data);
    console.groupEnd();
  } else {
    console.log(`%c${label}`, style);
  }
}

export const logger = {
  debug: (feature: Feature, message: string, data?: unknown) => log('debug', feature, message, data),
  info:  (feature: Feature, message: string, data?: unknown) => log('info',  feature, message, data),
  warn:  (feature: Feature, message: string, data?: unknown) => log('warn',  feature, message, data),
  error: (feature: Feature, message: string, data?: unknown) => log('error', feature, message, data),
};
