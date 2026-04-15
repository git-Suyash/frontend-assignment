/**
 * auditLog
 *
 * Append-only security audit trail stored in localStorage. Records
 * significant checkout and cart-security events so that suspicious activity
 * (price tampering, checksum mismatches, idempotency reuse) can be reviewed
 * after the fact.
 *
 * Each entry carries:
 *   - `event`      — the type of event (see AuditEventType in types/index.ts)
 *   - `timestamp`  — Unix milliseconds
 *   - `sessionId`  — anonymous UUID per browser session (never user-identifying)
 *   - optional metadata (cartVersion, cartItemCount, reason)
 *
 * Design notes:
 *   - The log is capped at 100 entries; oldest entries are trimmed first.
 *   - `getAuditLog` and `exportAuditLogSafe` are exposed for the diagnostic
 *     copy feature in NotificationCenter and the DevBridge window API.
 *   - In development, each entry is also printed to the console via
 *     console.group for real-time visibility.
 */

import type { AuditEvent, AuditEventType } from '../types';

const AUDIT_LOG_KEY = 'audit_log';
const SESSION_ID_KEY = 'session_id';

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function auditLog(event: AuditEventType, meta?: Partial<AuditEvent>): void {
  const entry: AuditEvent = {
    timestamp: Date.now(),
    event,
    sessionId: getSessionId(),
    ...meta,
  };

  let log: AuditEvent[] = [];
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (raw) log = JSON.parse(raw) as AuditEvent[];
  } catch {
    log = [];
  }

  log.push(entry);
  // Keep only last 100 events
  if (log.length > 100) {
    log = log.slice(log.length - 100);
  }

  try {
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(log));
  } catch {
    // Storage write failed silently
  }

  if (import.meta.env.DEV) {
    console.group(`[AuditLog] ${event}`);
    console.log(entry);
    console.groupEnd();
  }
}

export function getAuditLog(): AuditEvent[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (raw) return JSON.parse(raw) as AuditEvent[];
  } catch {
    // ignore
  }
  return [];
}

export function exportAuditLogSafe(): string {
  return JSON.stringify(getAuditLog());
}
