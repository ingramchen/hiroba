import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
  RemoteFetchError,
  type FetchLimits,
  type RawResponse,
  type RemoteTransport,
  type ResolvedAddress,
  type AddressResolver,
} from '../../core/storage/net.js';

export const systemResolver: AddressResolver = (host) => dnsLookup(host, { all: true });

function readOnce(target: URL, pinned: ResolvedAddress, limits: FetchLimits): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port.length > 0 ? Number(target.port) : undefined,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        servername: target.hostname,
        headers: { host: target.host, accept: '*/*' },
        lookup: (_hostname, opts, callback) => {
          const done = callback as unknown as (
            error: Error | null,
            address: string | ResolvedAddress[],
            family?: number,
          ) => void;
          if (typeof opts === 'object' && opts !== null && opts.all === true) {
            done(null, [{ address: pinned.address, family: pinned.family }]);
          } else {
            done(null, pinned.address, pinned.family);
          }
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > limits.maxBytes) {
            req.destroy();
            reject(new RemoteFetchError('too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: new Uint8Array(Buffer.concat(chunks)),
          });
        });
        res.on('error', () => reject(new RemoteFetchError('read failed')));
      },
    );
    req.setTimeout(limits.timeoutMs, () => {
      req.destroy();
      reject(new RemoteFetchError('timeout'));
    });
    req.on('error', () => reject(new RemoteFetchError('connect failed')));
    req.end();
  });
}

export const nodeTransport: RemoteTransport = {
  canPinAddresses: true,
  resolve: systemResolver,
  send: (target, pinned, limits) =>
    pinned === null
      ? Promise.reject(new RemoteFetchError('refused'))
      : readOnce(target, pinned, limits),
};
