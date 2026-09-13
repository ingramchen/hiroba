import { POSTER_TYPES, type PosterCreator, type PosterType, type PosterView } from '@hiroba/shared';

export { POSTER_TYPES };
export type { PosterCreator, PosterType, PosterView };

export function asPosterView(value: unknown): PosterView | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const creator = row['creator'];
  if (
    typeof row['id'] !== 'string' ||
    typeof row['mediaUrl'] !== 'string' ||
    typeof row['content'] !== 'string' ||
    typeof creator !== 'object' ||
    creator === null
  ) {
    return null;
  }
  const posterType = row['posterType'];
  if (posterType !== 'IMAGE' && posterType !== 'YOUTUBE') {
    return null;
  }
  const who = creator as Record<string, unknown>;
  return {
    id: row['id'],
    topic: typeof row['topic'] === 'string' ? row['topic'] : '',
    creator: {
      publicId: typeof who['publicId'] === 'string' ? who['publicId'] : '',
      nickname: typeof who['nickname'] === 'string' ? who['nickname'] : '',
      colorToken: typeof who['colorToken'] === 'string' ? who['colorToken'] : null,
    },
    mediaUrl: row['mediaUrl'],
    posterType,
    content: row['content'],
    createTime: typeof row['createTime'] === 'number' ? row['createTime'] : 0,
  };
}

export function isNewerPoster(candidate: PosterView, current: PosterView | null): boolean {
  return current === null || candidate.createTime >= current.createTime;
}
