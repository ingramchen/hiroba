import { randomUUID } from 'node:crypto';
import {
  VOTE_DECISION_EXPIRE_MS,
  VOTE_MAX_OPTION_LENGTH,
  VOTE_MAX_OPTIONS,
  VOTE_MAX_TITLE,
  VOTE_MIN_OPTIONS,
  VOTE_RECENT_LIMIT,
  VOTE_UPDATE_DELAY_MS,
  asVoteGoal,
  isQuorumReached,
  isUnforbidQuorumReached,
  isValidDuration,
  isValidTotalOptions,
  isValidVotedOptions,
  maxChoiceCount,
  type MessageEvent,
  type OptionCount,
  type VotingGoalType,
  type VoteCreator,
  type VoteView,
  type VotingState,
} from '@hiroba/shared';
import { desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { voting } from '../db/schema.js';
import type { Permission } from './permission.js';
import type { Clock, TimerHandle, Timers } from './room/types.js';

export type VoteErrorCode =
  | 'INVALID_DURATION'
  | 'INVALID_OPTIONS'
  | 'INVALID_TITLE'
  | 'INVALID_REASON'
  | 'NOT_PERMITTED'
  | 'VOTE_IN_PROGRESS'
  | 'NO_SUCH_VOTING'
  | 'NOT_ENOUGH_KERMA'
  | 'ALREADY_VOTED'
  | 'INVALID_BALLOT';

export class VoteError extends Error {
  constructor(readonly code: VoteErrorCode) {
    super(code);
  }
}

export type { VoteCreator as Creator, VoteView as VotePayload };

interface ActiveVoting {
  id: string;
  topic: string;
  title: string;
  creator: VoteCreator;
  createTime: number;
  endTime: number;
  options: OptionCount[];
  multipleChoiceConfig: number;
  goal: VotingGoalType;
  goalDetail: Record<string, unknown>;
  identities: Set<string>;
  voters: number;
  update: TimerHandle | null;
  complete: TimerHandle | null;
}

export interface CreateVotingInput {
  topic: string;
  creator: VoteCreator;
  title: string;
  options: string[];
  durationMs: number;
  multipleChoiceConfig: number;
  goal: VotingGoalType;
  goalDetail: Record<string, unknown>;
}

export type VotePublisher = (topic: string, payload: VoteView) => void;

function toPayload(active: ActiveVoting, state: VotingState, applied = false): VoteView {
  return {
    id: active.id,
    topic: active.topic,
    title: active.title,
    creator: active.creator,
    state,
    createTime: active.createTime,
    endTime: active.endTime,
    options: active.options.map((option) => ({ ...option })),
    voterCount: active.voters,
    multipleChoiceConfig: active.multipleChoiceConfig,
    ...asVoteGoal(active.goal, active.goalDetail),
    applied,
  };
}

export class VoteService {
  private readonly active = new Map<string, ActiveVoting>();

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly timers: Timers,
    private readonly publish: VotePublisher,
    private readonly isForbidden: (topic: string, ips: string, publicId: string) => boolean,
  ) {}

  create(input: CreateVotingInput, permission: Permission): string {
    if (
      input.goal === 'MIN_KERMA' &&
      String(input.goalDetail['reason'] ?? '').trim().length === 0
    ) {
      throw new VoteError('INVALID_REASON');
    }
    if (!isValidDuration(input.durationMs)) {
      throw new VoteError('INVALID_DURATION');
    }
    const title = input.title.trim();
    if (title.length === 0 || title.length > VOTE_MAX_TITLE) {
      throw new VoteError('INVALID_TITLE');
    }
    const trimmed = input.options.map((option) => option.trim()).filter((o) => o.length > 0);
    if (
      trimmed.length !== input.options.length ||
      new Set(trimmed).size !== trimmed.length ||
      trimmed.length < VOTE_MIN_OPTIONS ||
      trimmed.length > VOTE_MAX_OPTIONS ||
      trimmed.some((option) => option.length > VOTE_MAX_OPTION_LENGTH)
    ) {
      throw new VoteError('INVALID_OPTIONS');
    }
    const choice = maxChoiceCount(input.multipleChoiceConfig, trimmed.length);
    if (!isValidTotalOptions(choice, trimmed.length)) {
      throw new VoteError('INVALID_OPTIONS');
    }
    if (!this.isPermittedCreator(permission, input.creator.publicId)) {
      throw new VoteError('NOT_PERMITTED');
    }
    const now = this.clock.now();
    const current = this.active.get(input.topic);
    if (current !== undefined && current.endTime > now) {
      throw new VoteError('VOTE_IN_PROGRESS');
    }
    if (current !== undefined) {
      this.cancelTimers(current);
    }
    const created: ActiveVoting = {
      id: randomUUID(),
      topic: input.topic,
      title: input.title,
      creator: input.creator,
      createTime: now,
      endTime: now + input.durationMs,
      options: trimmed.map((option) => ({ option, count: 0 })),
      multipleChoiceConfig: choice,
      goal: input.goal,
      goalDetail: input.goalDetail,
      identities: new Set(),
      voters: 0,
      update: null,
      complete: null,
    };
    this.active.set(input.topic, created);
    this.persist(created, false);
    this.publish(input.topic, toPayload(created, 'CREATE'));
    created.complete = this.timers.schedule(() => {
      created.complete = null;
      this.persist(created, false);
      this.publish(created.topic, toPayload(created, 'COMPLETE'));
    }, input.durationMs);
    return created.id;
  }

  activeVoting(topic: string): ActiveVoting | null {
    const current = this.active.get(topic);
    if (current === undefined || current.endTime <= this.clock.now()) {
      return null;
    }
    return current;
  }

  cast(
    topic: string,
    votingId: string,
    options: string[],
    permission: Permission,
    currentIps: string,
  ): void {
    const current = this.activeVoting(topic);
    if (current === null || current.id !== votingId) {
      throw new VoteError('NO_SUCH_VOTING');
    }
    if (!isValidVotedOptions(current.multipleChoiceConfig, options.length)) {
      throw new VoteError('INVALID_BALLOT');
    }
    const chosen = new Set(options);
    for (const option of chosen) {
      if (!current.options.some((entry) => entry.option === option)) {
        throw new VoteError('INVALID_BALLOT');
      }
    }
    if (current.goal !== 'NORMAL' && !permission.kermaEnough) {
      throw new VoteError('NOT_ENOUGH_KERMA');
    }
    const identities = [currentIps, permission.startIps, permission.publicId].filter(
      (identity) => identity.length > 0,
    );
    if (identities.length === 0) {
      throw new VoteError('ALREADY_VOTED');
    }
    if (identities.some((identity) => current.identities.has(identity))) {
      throw new VoteError('ALREADY_VOTED');
    }
    for (const identity of identities) {
      current.identities.add(identity);
    }
    current.voters += 1;
    for (const entry of current.options) {
      if (chosen.has(entry.option)) {
        entry.count += 1;
      }
    }
    this.scheduleUpdate(current);
  }

  private scheduleUpdate(current: ActiveVoting): void {
    if (current.update !== null) {
      return;
    }
    current.update = this.timers.schedule(() => {
      current.update = null;
      if (current.endTime <= this.clock.now()) {
        return;
      }
      this.persist(current, false);
      this.publish(current.topic, toPayload(current, 'UPDATE'));
    }, VOTE_UPDATE_DELAY_MS);
  }

  loadForCreatorApply(topic: string, votingId: string, permission: Permission): VoteView | null {
    const row = this.db.select().from(voting).where(eq(voting.id, votingId)).get();
    if (row === undefined || row.topic !== topic) {
      return null;
    }
    if (!this.isPermittedCreator(permission, row.creatorPublicId)) {
      return null;
    }
    const now = this.clock.now();
    if (row.endTime.getTime() + VOTE_DECISION_EXPIRE_MS < now) {
      return null;
    }
    if (row.applied) {
      return null;
    }
    return this.rowToPayload(row, 'PERSISTENT');
  }

  markApplied(votingId: string): void {
    this.db.update(voting).set({ applied: true }).where(eq(voting.id, votingId)).run();
  }

  hasReachedQuorum(payload: VoteView, unforbid = false): boolean {
    return unforbid ? isUnforbidQuorumReached(payload.options) : isQuorumReached(payload.options);
  }

  listRecent(topic: string): VoteView[] {
    return this.db
      .select()
      .from(voting)
      .where(eq(voting.topic, topic))
      .orderBy(desc(voting.createTime))
      .limit(VOTE_RECENT_LIMIT)
      .all()
      .map((row) => this.rowToPayload(row, 'PERSISTENT'));
  }

  dispose(): void {
    for (const current of this.active.values()) {
      this.cancelTimers(current);
    }
    this.active.clear();
  }

  private cancelTimers(current: ActiveVoting): void {
    if (current.update !== null) {
      this.timers.cancel(current.update);
      current.update = null;
    }
    if (current.complete !== null) {
      this.timers.cancel(current.complete);
      current.complete = null;
    }
  }

  private isPermittedCreator(permission: Permission, publicId: string): boolean {
    if (!permission.kermaEnough) {
      return false;
    }
    if (permission.publicId !== publicId) {
      return false;
    }
    return !this.isForbidden(permission.topic, permission.startIps, permission.publicId);
  }

  private persist(current: ActiveVoting, applied: boolean): void {
    this.db
      .insert(voting)
      .values({
        id: current.id,
        createTime: new Date(current.createTime),
        endTime: new Date(current.endTime),
        creatorPublicId: current.creator.publicId,
        creatorNickname: current.creator.nickname,
        creatorColorToken: current.creator.colorToken,
        topic: current.topic,
        title: current.title,
        optionVotes: JSON.stringify(current.options),
        voterCount: current.voters,
        multipleChoiceConfig: current.multipleChoiceConfig,
        votingGoal: JSON.stringify({ goal: current.goal, detail: current.goalDetail }),
        applied,
      })
      .onConflictDoUpdate({
        target: voting.id,
        set: {
          optionVotes: JSON.stringify(current.options),
          voterCount: current.voters,
        },
      })
      .run();
  }

  private rowToPayload(row: typeof voting.$inferSelect, state: VotingState): VoteView {
    const goal = JSON.parse(row.votingGoal) as {
      goal: VotingGoalType;
      detail: Record<string, unknown>;
    };
    const options = JSON.parse(row.optionVotes) as OptionCount[];
    return {
      id: row.id,
      topic: row.topic,
      title: row.title,
      creator: {
        publicId: row.creatorPublicId,
        nickname: row.creatorNickname,
        colorToken: row.creatorColorToken,
      },
      state,
      createTime: row.createTime.getTime(),
      endTime: row.endTime.getTime(),
      options,
      voterCount: row.voterCount,
      multipleChoiceConfig: row.multipleChoiceConfig,
      ...asVoteGoal(goal.goal, goal.detail),
      applied: row.applied,
    };
  }
}

export function voteEvent(payload: VoteView, date: number): MessageEvent {
  return {
    eventType: 'VOTE_MESSAGE',
    senderPublicId: 'SYSTEM_PUBLIC_ID',
    senderNickName: 'SYSTEM',
    senderColorToken: null,
    anchorUsername: '',
    content: '',
    date,
    payload: { voting: payload as unknown as Record<string, unknown> },
  };
}
