import { canonicalTopic } from './topic.js';

const HOME_PATHS = new Set(['', 'index.html', 'index.htm']);

export function decodePath(pathname: string): string {
  const withoutHead = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const plusAsSpace = withoutHead.replace(/\+/gu, ' ');
  try {
    return decodeURIComponent(plusAsSpace);
  } catch {
    return plusAsSpace;
  }
}

export function isHomeTopic(topic: string): boolean {
  return HOME_PATHS.has(topic);
}

export function canonicalPath(pathname: string): string {
  const topic = canonicalTopic(decodePath(pathname));
  return isHomeTopic(topic) ? '/' : '/' + topic;
}
