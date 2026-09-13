export const WEB_LOADER_PREFIX = '/load';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

export async function signWebLoaderUrl(key: string, remoteUrl: string): Promise<string> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', material, encoder.encode(remoteUrl));
  return toBase64Url(new Uint8Array(signature));
}

export async function webLoaderUrl(key: string, remoteUrl: string, origin = ''): Promise<string> {
  const filters = '';
  const mac = await signWebLoaderUrl(key, filters + remoteUrl);
  return `${origin}${WEB_LOADER_PREFIX}/${mac}/${filters}${remoteUrl}`;
}
