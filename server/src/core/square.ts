import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { anchorSquare, poster, square, squareInfo, squareLive } from '../db/schema.js';

export interface StoredThumb {
  path: string;
  sourcePath: string;
  width: number;
  height: number;
}

export interface SquareInfo {
  minKermaValue: number;
  sealed: boolean;
  createTime: number;
}

export class Squares {
  constructor(private readonly db: Database) {}

  ensure(topic: string, now: number): void {
    this.db
      .insert(squareInfo)
      .values({ topic, createTime: new Date(now) })
      .onConflictDoNothing()
      .run();
  }

  info(topic: string): SquareInfo | null {
    const row = this.db.select().from(squareInfo).where(eq(squareInfo.topic, topic)).get();
    if (row === undefined) {
      return null;
    }
    return {
      minKermaValue: row.minKermaValue,
      sealed: row.sealed,
      createTime: row.createTime.getTime(),
    };
  }

  saveThumb(topic: string, thumb: StoredThumb, now: number): string | null {
    const superseded =
      this.db
        .select({ thumbPath: squareInfo.thumbPath })
        .from(squareInfo)
        .where(eq(squareInfo.topic, topic))
        .get()?.thumbPath ?? null;
    this.db
      .insert(squareInfo)
      .values({
        topic,
        createTime: new Date(now),
        thumbPath: thumb.path,
        thumbWidth: thumb.width,
        thumbHeight: thumb.height,
        thumbSourcePath: thumb.sourcePath,
      })
      .onConflictDoUpdate({
        target: squareInfo.topic,
        set: {
          thumbPath: thumb.path,
          thumbWidth: thumb.width,
          thumbHeight: thumb.height,
          thumbSourcePath: thumb.sourcePath,
        },
      })
      .run();
    return superseded === thumb.path ? null : superseded;
  }

  thumbsOfSource(sourcePath: string): { topic: string; thumbPath: string }[] {
    return this.db
      .select({ topic: squareInfo.topic, thumbPath: squareInfo.thumbPath })
      .from(squareInfo)
      .where(eq(squareInfo.thumbSourcePath, sourcePath))
      .all()
      .flatMap((row) =>
        row.thumbPath === null ? [] : [{ topic: row.topic, thumbPath: row.thumbPath }],
      );
  }

  clearThumb(topic: string): void {
    this.db
      .update(squareInfo)
      .set({ thumbPath: null, thumbWidth: null, thumbHeight: null, thumbSourcePath: null })
      .where(eq(squareInfo.topic, topic))
      .run();
  }

  minKerma(topic: string): number {
    return this.info(topic)?.minKermaValue ?? 0;
  }

  updateMinKerma(topic: string, value: number): void {
    this.db
      .update(squareInfo)
      .set({ minKermaValue: value })
      .where(eq(squareInfo.topic, topic))
      .run();
  }

  seal(topic: string): void {
    this.db.update(squareInfo).set({ sealed: true }).where(eq(squareInfo.topic, topic)).run();
    this.db.update(anchorSquare).set({ sealed: true }).where(eq(anchorSquare.topic, topic)).run();
  }

  removeLive(topic: string): void {
    this.db.delete(squareLive).where(eq(squareLive.topic, topic)).run();
  }

  // returns the path of the thumbnail object the deleted row pointed at, so the
  // caller can remove it -- the row is the only record of that object
  removePermanent(topic: string): string | null {
    return this.db.transaction(() => {
      const orphan =
        this.db
          .select({ thumbPath: squareInfo.thumbPath })
          .from(squareInfo)
          .where(eq(squareInfo.topic, topic))
          .get()?.thumbPath ?? null;
      this.db.delete(poster).where(eq(poster.topic, topic)).run();
      this.db.delete(square).where(eq(square.topic, topic)).run();
      this.db.delete(squareInfo).where(eq(squareInfo.topic, topic)).run();
      return orphan;
    });
  }

  isSealed(topic: string): boolean {
    if (this.info(topic)?.sealed === true) {
      return true;
    }
    const anchor = this.db
      .select({ sealed: anchorSquare.sealed })
      .from(anchorSquare)
      .where(eq(anchorSquare.topic, topic))
      .get();
    return anchor?.sealed === true;
  }

  isLockPublic(topic: string, now: number): boolean {
    const info = this.info(topic);
    return info !== null && info.createTime < now - 24 * 60 * 60 * 1000;
  }
}
