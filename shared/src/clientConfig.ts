export const CLIENT_CONFIG_GLOBAL = 'hirobaConfig';
export const CLIENT_CONFIG_PATH = '/config.js';
export const MEDIA_ROUTE_PREFIX = '/-/img';

export interface ClientConfig {
  webLoaderKey: string;
  mediaBase: string;
}

export function clientConfigScript(config: ClientConfig): string {
  return `window.${CLIENT_CONFIG_GLOBAL}=${JSON.stringify(config)};`;
}

export function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function mediaBaseFor(origin: string): string {
  return `${trimTrailingSlash(origin)}${MEDIA_ROUTE_PREFIX}`;
}
