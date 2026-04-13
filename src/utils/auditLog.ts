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
