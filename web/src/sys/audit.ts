import type { SysAuditEntry } from '@hiroba/shared';

const READ_ACTIONS = new Set([
  'squares.read',
  'chatters.read',
  'join-records.read',
  'stats.read',
  'images.read',
  'audit.read',
]);

export function isReadAction(action: string): boolean {
  return action.endsWith('.read') || READ_ACTIONS.has(action);
}

export function auditDetail(entry: SysAuditEntry): string {
  if (entry.detail.length === 0) {
    return '';
  }
  try {
    const parsed: unknown = JSON.parse(entry.detail);
    if (parsed === null || typeof parsed !== 'object') {
      return entry.detail;
    }
    return Object.entries(parsed as Record<string, unknown>)
      .map(
        ([key, value]) => key + '=' + (typeof value === 'string' ? value : JSON.stringify(value)),
      )
      .join(' ');
  } catch {
    return entry.detail;
  }
}
