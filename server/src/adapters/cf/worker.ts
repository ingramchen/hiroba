import { canonicalTopic } from '@hiroba/shared';
import { isServerPath } from '../../core/paths.js';
import { TOPIC_HEADER, edgeHeaders } from './clientAddress.js';
import type { Env, Fetcher } from './platform.js';

export { AppDO } from './app.do.js';
export { SquareDO } from './square.do.js';

const WS_PATH_PREFIX = '/ws/';
const APP_OBJECT_NAME = 'app';

function topicOf(pathname: string): string {
  const raw = pathname.slice(WS_PATH_PREFIX.length).split('?')[0] ?? '';
  try {
    return canonicalTopic(decodeURIComponent(raw));
  } catch {
    return '';
  }
}

async function shell(assets: Fetcher | undefined, url: URL): Promise<Response | null> {
  if (assets === undefined) {
    return null;
  }
  const page = await assets.fetch(new Request(new URL('/index.html', url.origin)));
  return page.ok ? new Response(page.body, { status: 200, headers: page.headers }) : null;
}

function spaCandidate(request: Request, url: URL, answer: Response): boolean {
  return (
    answer.status === 404 &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    !isServerPath(url.pathname)
  );
}

export default {
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await env.APP.get(env.APP.idFromName(APP_OBJECT_NAME)).wipe();
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = edgeHeaders(request);
    const url = new URL(request.url);
    if (url.pathname.startsWith(WS_PATH_PREFIX)) {
      const topic = topicOf(url.pathname);
      if (topic.length === 0) {
        return new Response('bad topic', { status: 400 });
      }
      headers.set(TOPIC_HEADER, topic);
      return env.SQUARE.get(env.SQUARE.idFromName(topic)).fetch(new Request(request, { headers }));
    }
    headers.delete(TOPIC_HEADER);
    const answer = await env.APP.get(env.APP.idFromName(APP_OBJECT_NAME)).fetch(
      new Request(request, { headers }),
    );
    if (!spaCandidate(request, url, answer)) {
      return answer;
    }
    return (await shell(env.ASSETS, url)) ?? answer;
  },
};
