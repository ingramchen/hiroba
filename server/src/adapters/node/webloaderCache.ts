import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { WebLoaderCache } from '../../core/storage/webloaderCache.js';
import { NullWebLoaderCache } from '../../core/storage/webloaderCache.js';
import { WEB_LOADER_DISK_MAX_BYTES } from '../../core/storage/webloader.js';

interface DiskEntry {
  size: number;
  mtime: number;
}

export interface FsWebLoaderCacheOptions {
  cacheDir: string;
  maxBytes: number;
  now?: () => number;
}

export class FsWebLoaderCache implements WebLoaderCache {
  private readonly cacheDir: string;
  private readonly maxBytes: number;
  private readonly now: () => number;
  private disk: Map<string, DiskEntry> | null = null;
  private diskBytes = 0;
  private scanning: Promise<void> | null = null;

  constructor(options: FsWebLoaderCacheOptions) {
    this.cacheDir = options.cacheDir;
    this.maxBytes = options.maxBytes;
    this.now = options.now ?? Date.now;
  }

  get bytes(): number {
    return this.diskBytes;
  }

  async read(relative: string): Promise<Uint8Array | null> {
    try {
      const data = await readFile(join(this.cacheDir, relative));
      return data.length === 0 ? null : new Uint8Array(data);
    } catch {
      return null;
    }
  }

  async write(relative: string, body: Uint8Array): Promise<readonly string[]> {
    const target = join(this.cacheDir, relative);
    if (body.length > this.maxBytes) {
      return [];
    }
    try {
      await this.scanDisk();
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
    } catch {
      return [];
    }
    const disk = this.disk ?? new Map<string, DiskEntry>();
    const previous = disk.get(relative);
    if (previous !== undefined) {
      this.diskBytes -= previous.size;
    }
    disk.set(relative, { size: body.length, mtime: this.now() });
    this.diskBytes += body.length;
    this.disk = disk;
    return this.evictDisk();
  }

  private scanDisk(): Promise<void> {
    if (this.disk !== null) {
      return Promise.resolve();
    }
    this.scanning ??= (async () => {
      const found = new Map<string, DiskEntry>();
      let total = 0;
      try {
        const names = await readdir(this.cacheDir, { recursive: true });
        for (const name of names) {
          const relative = String(name);
          try {
            const info = await stat(join(this.cacheDir, relative));
            if (info.isFile()) {
              found.set(relative, { size: info.size, mtime: info.mtimeMs });
              total += info.size;
            }
          } catch {
            continue;
          }
        }
      } catch {
        found.clear();
      }
      this.disk = found;
      this.diskBytes = total;
    })();
    return this.scanning;
  }

  private async evictDisk(): Promise<readonly string[]> {
    const disk = this.disk;
    if (disk === null || this.diskBytes <= this.maxBytes) {
      return [];
    }
    const evicted: string[] = [];
    const oldest = [...disk.entries()].toSorted((a, b) => a[1].mtime - b[1].mtime);
    for (const [relative, entry] of oldest) {
      if (this.diskBytes <= this.maxBytes) {
        break;
      }
      disk.delete(relative);
      this.diskBytes -= entry.size;
      evicted.push(relative);
      await rm(join(this.cacheDir, relative), { force: true }).catch(() => undefined);
    }
    return evicted;
  }
}

export function nodeLoaderCache(cacheDir: string | null, maxBytes: number | null): WebLoaderCache {
  return cacheDir === null
    ? new NullWebLoaderCache()
    : new FsWebLoaderCache({ cacheDir, maxBytes: maxBytes ?? WEB_LOADER_DISK_MAX_BYTES });
}
