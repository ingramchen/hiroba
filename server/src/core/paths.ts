export const SERVER_PREFIXES = [
  '/api/',
  '/assets/',
  '/auth/',
  '/-/emoji/',
  '/-/img/',
  '/favicon.',
  '/load/',
  '/stat/',
  '/ws/',
] as const;

export const SERVER_PATHS = ['/config.js', '/healthz', '/robots.txt'] as const;

export const RESERVED_PREFIXES = ['/-/'] as const;

export function isServerPath(path: string): boolean {
  return (
    SERVER_PATHS.includes(path as (typeof SERVER_PATHS)[number]) ||
    SERVER_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

export function isReservedPath(path: string): boolean {
  return isServerPath(path) || RESERVED_PREFIXES.some((prefix) => path.startsWith(prefix));
}
