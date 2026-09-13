import { CLIENT_EVENT_TYPES, SERVER_EVENT_TYPES } from './events.js';

export const HANDLE_MIN_LENGTH = 1;
export const HANDLE_MAX_LENGTH = 15;
export const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/u;

export const RESERVED_HANDLES: readonly string[] = [
  'SYSTEM',
  'ADMIN',
  'SYS',
  'ROOT',
  'HIROBA',
  'KEKEKE',
  'ANONYMOUS',
  'NULL',
  'UNDEFINED',
  'SYSTEM_PUBLIC_ID',
  ...CLIENT_EVENT_TYPES,
  ...SERVER_EVENT_TYPES,
];

export function foldHandle(value: string): string {
  return value.toLowerCase();
}

const RESERVED_FOLDED: ReadonlySet<string> = new Set(RESERVED_HANDLES.map(foldHandle));

export function isValidHandle(value: string): boolean {
  return HANDLE_PATTERN.test(value);
}

export function isReservedHandle(value: string): boolean {
  return RESERVED_FOLDED.has(foldHandle(value));
}
