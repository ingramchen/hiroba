import { readMediaConfig, type MediaConfig } from '../../core/config.js';
import { buildMediaServicesOn, type MediaServices } from '../../core/storage/build.js';
import { BlobWebLoaderCache, NullWebLoaderCache } from '../../core/storage/webloaderCache.js';
import { r2S3BlobStore } from './blob.js';
import { cfTransport } from './net.js';
import { WasmMediaProcessor, type PhotonModule } from './media.js';

export const CACHE_BUCKET_KEY = 'S3_BUCKET_CACHE';

export function wipeBuckets(
  env: Record<string, string | undefined>,
  config: MediaConfig | null,
): string[] {
  const names = [
    config?.bucketImg,
    config?.bucketCdnImg,
    config?.bucketCdnVideo,
    env[CACHE_BUCKET_KEY],
  ];
  return [
    ...new Set(
      names
        .filter((name): name is string => name !== undefined)
        .map((name) => name.trim())
        .filter((name) => name !== ''),
    ),
  ];
}

export async function buildCfMediaServices(
  env: Record<string, string | undefined>,
): Promise<MediaServices | null> {
  const config = readMediaConfig(env);
  if (config === null) {
    return null;
  }
  const blobs = r2S3BlobStore({
    endpoint: config.s3Endpoint,
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  });
  const cacheBucket = env[CACHE_BUCKET_KEY];
  const photon = (await import('@cf-wasm/photon')) as unknown as PhotonModule;
  return buildMediaServicesOn(config, {
    blobs,
    processor: new WasmMediaProcessor(photon),
    loaderCache:
      cacheBucket === undefined || cacheBucket.trim().length === 0
        ? new NullWebLoaderCache()
        : new BlobWebLoaderCache({ blobs, bucket: cacheBucket.trim() }),
    net: cfTransport,
  });
}
