import {
  MEDIA_ROUTE_PREFIX,
  canonicalTopic,
  type ModerationState,
  moderationKeyOf,
  type ModerationStates,
} from '@hiroba/shared';
import type { ModerationConfig, RemoteClassifier } from '../config.js';
import { systemEvent } from '../http.js';
import { SysAuditLog, type SysActor } from '../sysAudit.js';
import { deleteStoredImage, imageUrlsIn } from '../sysImages.js';
import type { StoredMedia } from '../storage/routes.js';
import type { Services } from '../types.js';
import {
  classifierEndpoint,
  classify,
  failureKindFor,
  logClassifyFailure,
  type ClassifierAnswer,
  type ClassifyOutcome,
} from './classify.js';
import { classifyNaive } from './naive.js';

import { ModerationStore } from './store.js';

export const MODERATION_ACTOR: SysActor = { address: 'moderation', session: '' };

export function moderationStoredHook(services: Services): (c: unknown, media: StoredMedia) => void {
  return (_c: unknown, media: StoredMedia): void => {
    try {
      services.moderation?.stored(media);
    } catch (error) {
      logClassifyFailure(
        {
          kind: 'service',
          status: null,
          reason: error instanceof Error ? error.message : 'failed',
        },
        media.url,
      );
    }
  };
}

export class ModerationService {
  private readonly store: ModerationStore;
  private readonly audit: SysAuditLog;
  private readonly inflight = new Set<Promise<void>>();

  constructor(
    private readonly services: Services,
    readonly config: ModerationConfig,
    private readonly fetcher: typeof fetch,
    private readonly publicOrigin: string | null = null,
  ) {
    this.store = new ModerationStore(services.db);
    this.audit = new SysAuditLog(services.db);
  }

  blocksAnyOf(content: string): boolean {
    return imageUrlsIn(content).some((url) => {
      const key = moderationKeyOf(url);
      return key !== null && this.store.find(key)?.state === 'block';
    });
  }

  statesFor(topic: string): ModerationStates {
    return this.store.statesFor(topic);
  }

  stored(raw: StoredMedia): void {
    const media = { ...raw, topic: canonicalTopic(raw.topic) };
    const key = moderationKeyOf(media.url);
    if (key === null) {
      return;
    }
    this.store.markPending(key, media.topic, this.services.clock.now());
    // announce the hold to whoever is already in the square. Without this the
    // pending mask exists only for LATE joiners (via SquareStart.moderation) and
    // a live viewer sees an unclassified image unmasked for the whole classify
    // window -- milliseconds with the naive classifier, but seconds with a remote one
    // and ~9s through its cold start.
    this.announce(key, media.topic, 'pending');
    const work = this.run(key, media)
      .catch((error: unknown) => {
        logClassifyFailure(
          {
            kind: 'service',
            status: null,
            reason: error instanceof Error ? error.message : 'failed',
          },
          media.url,
        );
      })
      .finally(() => {
        this.inflight.delete(work);
      });
    this.inflight.add(work);
  }

  get pending(): number {
    return this.inflight.size;
  }

  async settled(): Promise<void> {
    while (this.inflight.size > 0) {
      await Promise.all(this.inflight);
    }
  }

  private async run(key: string, media: StoredMedia): Promise<void> {
    const outcome =
      this.config.kind === 'naive'
        ? await this.naive(key)
        : await this.remote(this.config, key, media);
    if (!outcome.ok) {
      logClassifyFailure(outcome, media.url);
      this.settle(key, media.topic, 'error');
      return;
    }
    if (outcome.answer.verdict === 'block') {
      await this.block(key, media, outcome.answer);
      return;
    }
    this.settle(key, media.topic, outcome.answer.verdict);
  }

  private async naive(key: string): Promise<ClassifyOutcome> {
    const outcome = await classifyNaive(this.services, key);
    if (outcome.ok) {
      return {
        ok: true,
        answer: {
          verdict: outcome.answer.verdict,
          rule: outcome.answer.rule,
          thresholdsVersion: outcome.answer.thresholds_version,
        },
      };
    }
    return {
      ok: false,
      kind: failureKindFor(outcome.status),
      status: outcome.status,
      reason: `http ${outcome.status}`,
    };
  }

  private async remote(
    config: RemoteClassifier,
    key: string,
    media: StoredMedia,
  ): Promise<ClassifyOutcome> {
    const origin = this.publicOrigin ?? media.origin;
    return classify(
      config,
      classifierEndpoint(config),
      `${origin}${MEDIA_ROUTE_PREFIX}/${key}`,
      this.fetcher,
    );
  }

  private settle(key: string, topic: string, state: ModerationState): void {
    this.store.setState(key, state);
    this.announce(key, topic, state);
  }

  private announce(key: string, topic: string, state: ModerationState): void {
    if (!this.services.hub.has(topic)) {
      return;
    }
    this.services.hub.get(topic).broadcast({
      t: 'event',
      event: systemEvent('MODERATION_MESSAGE', '', this.services.clock.now(), { key, state }),
    });
  }

  private async block(key: string, media: StoredMedia, answer: ClassifierAnswer): Promise<void> {
    const deleted = await deleteStoredImage(this.services, {
      url: media.url,
      topic: media.topic,
      senderPublicId: '',
    });
    this.store.setState(key, 'block');
    this.audit.record(
      MODERATION_ACTOR,
      {
        action: 'image.block',
        targetType: 'topic',
        target: media.topic,
        topic: media.topic,
        detail: {
          url: media.url,
          rule: answer.rule,
          thresholds_version: answer.thresholdsVersion,
          deleted: deleted.ok,
        },
      },
      this.services.clock.now(),
    );
  }
}
