import type { BlobStore, ListedPage } from './storage/blob.js';

export const WIPE_DELETES_PER_CALL = 500;
export const WIPE_MAX_PASSES = 200;

export interface WipeProgress {
  deleted: number;
  done: boolean;
}

export interface SiteWipeOptions {
  blobs: BlobStore | null;
  buckets: readonly string[];
  resetDatabase?: (() => Promise<void>) | undefined;
  deletesPerCall?: number;
  log?: (line: Record<string, unknown>) => void;
}

export class SiteWipe {
  private readonly log: (line: Record<string, unknown>) => void;

  constructor(private readonly options: SiteWipeOptions) {
    this.log =
      options.log ??
      ((line) => {
        console.warn(JSON.stringify(line));
      });
  }

  get available(): boolean {
    return this.options.resetDatabase !== undefined;
  }

  async emptyBuckets(): Promise<WipeProgress> {
    const blobs = this.options.blobs;
    if (blobs === null) {
      return { deleted: 0, done: true };
    }
    const budget = this.options.deletesPerCall ?? WIPE_DELETES_PER_CALL;
    let deleted = 0;
    for (const bucket of new Set(this.options.buckets)) {
      let token: string | null = null;
      for (;;) {
        let page: ListedPage;
        try {
          page = await blobs.list(bucket, '', token);
        } catch (error) {
          this.log({ event: 'wipe.list', bucket, error: String(error) });
          break;
        }
        for (const object of page.objects) {
          if (deleted >= budget) {
            return { deleted, done: false };
          }
          try {
            await blobs.delete(bucket, object.key);
            deleted += 1;
          } catch (error) {
            this.log({ event: 'wipe.delete', bucket, key: object.key, error: String(error) });
          }
        }
        token = page.next;
        if (token === null) {
          break;
        }
      }
    }
    return { deleted, done: true };
  }

  async run(): Promise<{ deleted: number }> {
    let deleted = 0;
    for (let pass = 0; pass < WIPE_MAX_PASSES; pass += 1) {
      const progress = await this.emptyBuckets();
      deleted += progress.deleted;
      if (progress.done || progress.deleted === 0) {
        break;
      }
    }
    const reset = this.options.resetDatabase;
    if (reset !== undefined) {
      await reset();
    }
    this.log({ event: 'wipe', deleted });
    return { deleted };
  }
}
