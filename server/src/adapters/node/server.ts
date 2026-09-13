import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { isAbsolute, join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { CLIENT_CONFIG_PATH, SYS_CONSOLE_PATH } from '@hiroba/shared';
import { createApp } from '../../core/app.js';
import type { Services } from '../../core/types.js';
import type { Config } from '../../core/config.js';
import { isServerPath } from '../../core/paths.js';
import { bootServices } from '../../core/boot.js';
import { Scheduler } from '../../core/scheduler.js';
import { readTimeZone, timeZoneConfigured } from '../../core/timeZone.js';
import type { Store } from '../../db/client.js';
import { nodeRemoteAddress } from './conninfo.js';
import { openDatabase } from './db.js';
import { buildNodeMediaServices } from './media.js';
import { attachWebSockets, type WsGateway, type WsOptions } from './ws.js';

export interface RunningServer {
  port: number;
  services: Services;
  close: () => Promise<void>;
}

export interface StartOptions {
  config: Config;
  migrationsFolder: string;
  webRoot?: string;
  ws?: WsOptions;
  env?: Record<string, string | undefined>;
}

export function injectClientConfig(html: string): string {
  if (html.includes(`src="${CLIENT_CONFIG_PATH}"`)) {
    return html;
  }
  const tag = `<script src="${CLIENT_CONFIG_PATH}"></script>`;
  const at = html.indexOf('</head>');
  return at === -1 ? `${tag}${html}` : `${html.slice(0, at)}${tag}${html.slice(at)}`;
}

async function withClientConfig(path: string): Promise<string | null> {
  try {
    return injectClientConfig(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

export async function startServer(options: StartOptions): Promise<RunningServer> {
  const store: Store = openDatabase(options.config.dbPath, options.migrationsFolder);
  const services: Services = await bootServices({
    store,
    tokenSecret: options.config.tokenSecret,
    env: options.env ?? process.env,
    media: options.config.media === null ? null : buildNodeMediaServices(options.config.media),
  });

  const env = options.env ?? process.env;
  const timeZone = readTimeZone(env);
  const app = createApp(services, {
    remoteAddress: nodeRemoteAddress,
    sysPassword: options.config.sysPassword,
    timeZone,
    timeZoneConfigured: timeZoneConfigured(env),
  });

  if (options.webRoot !== undefined) {
    const webDist = isAbsolute(options.config.webDist)
      ? options.config.webDist
      : resolve(options.webRoot, options.config.webDist);
    const indexHtml = await withClientConfig(join(webDist, 'index.html'));
    const sysHtml = await withClientConfig(join(webDist, '-', 'sys.html'));
    app.get(SYS_CONSOLE_PATH, (c, next) =>
      sysHtml === null ? next() : Promise.resolve(c.html(sysHtml)),
    );
    app.use('/*', serveStatic({ root: webDist }));
    app.get('*', (c, next) => {
      if (c.req.path === '/favicon.ico') {
        return Promise.resolve(c.body(null, 204));
      }
      if (isServerPath(c.req.path)) {
        return next();
      }
      return indexHtml === null
        ? serveStatic({ path: join(webDist, 'index.html') })(c, next)
        : Promise.resolve(c.html(indexHtml));
    });
  }

  const httpServer = await new Promise<Server>((ready) => {
    const created = serve({ fetch: app.fetch, port: options.config.port }, () => {
      ready(created as Server);
    }) as Server;
  });
  const gateway: WsGateway = attachWebSockets(httpServer, services, options.ws);
  const scheduler = new Scheduler(services, () => services.clock.now(), undefined, timeZone);
  scheduler.start();

  const address = httpServer.address();
  const port = typeof address === 'object' && address !== null ? address.port : options.config.port;

  return {
    port,
    services,
    close: async () => {
      scheduler.stop();
      await gateway.close();
      services.votes.dispose();
      services.hub.dispose();
      await new Promise<void>((done) => {
        httpServer.close(() => {
          done();
        });
      });
      store.close();
    },
  };
}
