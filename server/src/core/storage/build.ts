import type { BlobStore } from './blob.js';
import type { MediaProcessor } from './media.js';
import { policyAllowsAnyHost, type GuardOptions, type RemoteTransport } from './net.js';
import { StorageService } from './service.js';
import { WebLoader } from './webloader.js';
import type { WebLoaderCache } from './webloaderCache.js';

export interface MediaConfig {
  s3Endpoint: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: string;
  bucketImg: string;
  bucketCdnImg: string;
  bucketCdnVideo: string;
  flakeNodeId: number;
  webLoaderHosts: readonly string[];
  webLoaderKey: string;
  webLoaderCacheDir: string | null;
  webLoaderCacheMaxBytes: number | null;
  uploadLimitBytes?: number;
}

export interface StoragePlatform {
  blobs: BlobStore;
  processor: MediaProcessor;
  loaderCache: WebLoaderCache;
  net: RemoteTransport;
}

export interface MediaServices {
  blobs: BlobStore;
  storage: StorageService;
  loader: WebLoader;
  config: MediaConfig;
}

export function buildMediaServicesOn(
  config: MediaConfig,
  platform: StoragePlatform,
): MediaServices {
  const guard: GuardOptions = {
    policy: { allowHosts: config.webLoaderHosts },
    transport: platform.net,
  };
  if (!platform.net.canPinAddresses && policyAllowsAnyHost(guard.policy)) {
    throw new Error('web loader allow list must name hosts on a platform without address pinning');
  }
  const buckets = {
    img: config.bucketImg,
    cdnImg: config.bucketCdnImg,
    cdnVideo: config.bucketCdnVideo,
  };
  return {
    config,
    blobs: platform.blobs,
    storage: new StorageService({
      blobs: platform.blobs,
      processor: platform.processor,
      buckets,
      nodeId: config.flakeNodeId,
      guard,
      uploadLimitBytes: config.uploadLimitBytes,
    }),
    loader: new WebLoader({
      key: config.webLoaderKey,
      guard,
      cache: platform.loaderCache,
    }),
  };
}
