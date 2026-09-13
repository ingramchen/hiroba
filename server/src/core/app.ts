import {
  CLIENT_CONFIG_PATH,
  canonicalTopic,
  clientConfigScript,
  decodePath,
  isHomeTopic,
  mediaBaseFor,
} from '@hiroba/shared';
import { Hono } from 'hono';
import { PermissionDenied, REMOTE_ADDRESS_VAR, clientIps, requirePermission } from './http.js';
import { isReservedPath } from './paths.js';
import { registerNaiveClassifier } from './moderation/naive.js';
import { moderationStoredHook } from './moderation/service.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerSquareRoutes } from './routes/square.js';
import { registerMediaRoutes, requestOrigin } from './storage/routes.js';
import { createSysApp } from './sys.js';
import { deleteThumbObject } from './sysImages.js';
import type { AppOptions, Services } from './types.js';

export function createApp(services: Services, options: AppOptions = {}): Hono {
  const app = new Hono();
  const addressSource = options.remoteAddress;

  app.use('/*', async (c, next) => {
    c.set(REMOTE_ADDRESS_VAR, addressSource === undefined ? '' : addressSource(c));
    await next();
  });

  app.route(
    '/api/sys',
    createSysApp(
      services,
      options.sysPassword ?? null,
      options.timeZone,
      options.timeZoneConfigured,
    ),
  );

  app.use('/*', async (c, next) => {
    const path = c.req.path;
    if ((c.req.method !== 'GET' && c.req.method !== 'HEAD') || isReservedPath(path)) {
      return next();
    }
    const decoded = decodePath(path);
    if (decoded.length === 0) {
      return next();
    }
    const canonical = canonicalTopic(decoded);
    const url = new URL(c.req.url);
    if (isHomeTopic(canonical)) {
      return c.redirect(`/${url.search}`, 302);
    }
    if (canonical === decoded) {
      return next();
    }
    return c.redirect(`/${encodeURIComponent(canonical)}${url.search}`, 302);
  });

  app.get('/healthz', (c) => c.text('ok'));

  app.get(CLIENT_CONFIG_PATH, (c) =>
    c.body(
      clientConfigScript({
        webLoaderKey: services.media?.config.webLoaderKey ?? '',
        mediaBase: services.media === null ? '' : mediaBaseFor(requestOrigin(c)),
      }),
      200,
      {
        'content-type': 'application/javascript;charset=UTF-8',
        'cache-control': 'no-store',
      },
    ),
  );

  if (services.media !== null) {
    registerMediaRoutes(app, services.media, {
      authorize: (c, fields) => {
        requirePermission(services, fields.permit, canonicalTopic(fields.topic), clientIps(c));
      },
      saveThumb: async (write) => {
        const canonical = canonicalTopic(write.topic);
        if (canonical.length === 0) {
          return;
        }
        const superseded = services.squares.saveThumb(canonical, write.thumb, services.clock.now());
        if (superseded !== null && services.media !== null) {
          await deleteThumbObject(services.media, superseded);
        }
      },
      stored: moderationStoredHook(services),
    });
  }

  registerNaiveClassifier(app, services);
  registerSquareRoutes(app, services);
  registerAccountRoutes(app, services);

  app.onError((error, c) => {
    if (error instanceof PermissionDenied) {
      return c.json({ error: error.code }, 403);
    }
    return c.json({ error: 'INTERNAL' }, 500);
  });

  return app;
}
