import sharp from 'sharp';
import { S3BlobStore } from '../../core/storage/blob.js';
import {
  buildMediaServicesOn,
  type MediaConfig,
  type MediaServices,
} from '../../core/storage/build.js';
import {
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  THUMBNAIL_WIDTH,
  type MediaProcessor,
  type ThumbnailResult,
} from '../../core/storage/media.js';
import { nodeLoaderCache } from './webloaderCache.js';
import { nodeTransport } from './net.js';

export class NodeMediaProcessor implements MediaProcessor {
  async thumbnail(source: Uint8Array): Promise<ThumbnailResult> {
    const data = await sharp(source, { animated: false })
      .flatten({ background: '#ffffff' })
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toBuffer();
    return { data: new Uint8Array(data), width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT };
  }
}

export function buildNodeMediaServices(config: MediaConfig): MediaServices {
  return buildMediaServicesOn(config, {
    blobs: new S3BlobStore({
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      accessKeyId: config.s3AccessKey,
      secretAccessKey: config.s3SecretKey,
    }),
    processor: new NodeMediaProcessor(),
    loaderCache: nodeLoaderCache(config.webLoaderCacheDir, config.webLoaderCacheMaxBytes),
    net: nodeTransport,
  });
}
