import { moderationKeyOf } from '@hiroba/shared';
import type { Hono } from 'hono';
import type { Services } from '../types.js';
import type { ClassifierVerdict } from './classify.js';
import { NAIVE_CLASSIFY_PATH } from './config.js';
import { decodePng, skinRatio } from './pixels.js';

export const NAIVE_THRESHOLDS_VERSION = 'naive-skin-ratio-1';
export const FORCE_MARKER = 'HIROBA-MOD-FORCE:';
export const SKIN_BLOCK_RATIO = 0.6;
export const SKIN_FLAG_RATIO = 0.3;

export const FORCED_OUTCOMES = ['pass', 'flag', 'block', '4xx', '5xx'] as const;

export type ForcedOutcome = (typeof FORCED_OUTCOMES)[number];

export interface NaiveAnswer {
  verdict: ClassifierVerdict;
  rule: string;
  thresholds_version: string;
  skin_ratio: number;
}

export function forcedOutcomeIn(bytes: Uint8Array): ForcedOutcome | null {
  const text = new TextDecoder('latin1').decode(bytes);
  const at = text.indexOf(FORCE_MARKER);
  if (at < 0) {
    return null;
  }
  const rest = text.slice(at + FORCE_MARKER.length);
  return FORCED_OUTCOMES.find((outcome) => rest.startsWith(outcome)) ?? null;
}

export async function naiveVerdict(bytes: Uint8Array): Promise<NaiveAnswer> {
  const image = await decodePng(bytes);
  if (image === null) {
    return {
      verdict: 'pass',
      rule: 'naive.undecodable',
      thresholds_version: NAIVE_THRESHOLDS_VERSION,
      skin_ratio: 0,
    };
  }
  const ratio = skinRatio(image);
  const verdict: ClassifierVerdict =
    ratio >= SKIN_BLOCK_RATIO ? 'block' : ratio >= SKIN_FLAG_RATIO ? 'flag' : 'pass';
  const rule =
    verdict === 'block'
      ? 'naive.skin_high'
      : verdict === 'flag'
        ? 'naive.skin_some'
        : 'naive.clean';
  return { verdict, rule, thresholds_version: NAIVE_THRESHOLDS_VERSION, skin_ratio: ratio };
}

function forcedAnswer(outcome: ForcedOutcome): NaiveAnswer {
  return {
    verdict: outcome as ClassifierVerdict,
    rule: `naive.forced_${outcome}`,
    thresholds_version: NAIVE_THRESHOLDS_VERSION,
    skin_ratio: 0,
  };
}

export type NaiveOutcome =
  { ok: true; answer: NaiveAnswer } | { ok: false; status: 400 | 422 | 503; error: string };

export async function classifyNaive(services: Services, mediaKey: string): Promise<NaiveOutcome> {
  const media = services.media;
  if (media === null) {
    return { ok: false, status: 503, error: 'no media' };
  }
  const slash = mediaKey.indexOf('/');
  const bucket = slash === -1 ? '' : mediaKey.slice(0, slash);
  const key = slash === -1 ? '' : mediaKey.slice(slash + 1);
  const allowed = [media.config.bucketImg, media.config.bucketCdnImg, media.config.bucketCdnVideo];
  if (key.length === 0 || !allowed.includes(bucket)) {
    return { ok: false, status: 400, error: 'not a media url' };
  }
  let bytes: Uint8Array | null;
  try {
    bytes = await media.storage.readObject(bucket, key);
  } catch {
    bytes = null;
  }
  if (bytes === null) {
    return { ok: false, status: 422, error: 'could not fetch' };
  }
  const forced = forcedOutcomeIn(bytes);
  if (forced === '4xx') {
    return { ok: false, status: 422, error: 'forced image failure' };
  }
  if (forced === '5xx') {
    return { ok: false, status: 503, error: 'forced service failure' };
  }
  return { ok: true, answer: forced === null ? await naiveVerdict(bytes) : forcedAnswer(forced) };
}

export function registerNaiveClassifier(app: Hono, services: Services): void {
  const moderation = services.moderation;
  if (moderation === null || moderation.config.kind !== 'naive') {
    return;
  }
  const expected = moderation.config.token;
  app.post(NAIVE_CLASSIFY_PATH, async (c) => {
    if (expected !== null && c.req.header('authorization') !== `Bearer ${expected}`) {
      return c.json({ error: 'not found' }, 404);
    }
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const path = moderationKeyOf(typeof body['url'] === 'string' ? body['url'] : '');
    if (path === null) {
      return c.json({ error: 'not a media url' }, 400);
    }
    const outcome = await classifyNaive(services, path);
    return outcome.ok ? c.json(outcome.answer) : c.json({ error: outcome.error }, outcome.status);
  });
}
