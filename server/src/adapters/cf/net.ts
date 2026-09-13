import {
  RemoteFetchError,
  type FetchLimits,
  type RawResponse,
  type RemoteTransport,
} from '../../core/storage/net.js';

async function readBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const stream = response.body;
  if (stream === null) {
    return new Uint8Array(0);
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done === true) {
      break;
    }
    total += step.value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RemoteFetchError('too large');
    }
    chunks.push(step.value);
  }
  const body = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.length;
  }
  return body;
}

async function send(target: URL, _pinned: unknown, limits: FetchLimits): Promise<RawResponse> {
  let response: Response;
  try {
    response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: { accept: '*/*' },
      signal: AbortSignal.timeout(limits.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    throw new RemoteFetchError(
      name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'connect failed',
    );
  }
  let body: Uint8Array;
  try {
    body = await readBody(response, limits.maxBytes);
  } catch (error) {
    if (error instanceof RemoteFetchError) {
      throw error;
    }
    throw new RemoteFetchError('read failed');
  }
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: response.status, headers, body };
}

export const cfTransport: RemoteTransport = {
  canPinAddresses: false,
  send,
};
