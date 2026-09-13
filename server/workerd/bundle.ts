import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export function bundleFixture(entry: string): Promise<string> {
  return bundleEntry(fileURLToPath(new URL(`./fixtures/${entry}`, import.meta.url)));
}

export async function bundleEntry(entryPoint: string): Promise<string> {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'esnext',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['workerd', 'worker', 'browser', 'import'],
    external: ['node:*', 'cloudflare:*', '@cf-wasm/photon'],
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}
