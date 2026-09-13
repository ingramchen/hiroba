import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import type { RemoteAddressSource } from '../../core/http.js';

export const nodeRemoteAddress: RemoteAddressSource = (c: Context) => {
  try {
    return getConnInfo(c).remote.address ?? '';
  } catch {
    return '';
  }
};
