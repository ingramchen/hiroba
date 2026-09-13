import { escapeHtml } from './text.js';

export const VOTE_MIN_DURATION_MS = 10_000;
export const VOTE_MAX_DURATION_MS = 120_000;
export const VOTE_MIN_OPTIONS = 2;
export const VOTE_MAX_OPTIONS = 6;
export const VOTE_MAX_REASON = 50;
export const VOTE_MAX_TITLE_CLIENT = 140;
export const VOTE_MAX_TITLE = 140;
export const VOTE_MAX_OPTION_LENGTH = 30;
export const VOTE_QUORUM = 10;
export const VOTE_DECISION_EXPIRE_MS = 120_000;
export const VOTE_UPDATE_DELAY_MS = 3000;
export const VOTE_RECENT_LIMIT = 20;

export const NORMAL_DURATIONS_SEC = [30, 60, 120] as const;
export const SHORT_DURATIONS_SEC = [10, 20, 30, 77] as const;
export const FIXED_DURATION_SEC = 77;

export const MIN_KERMA_LEVELS = [0, 5, 10, 20, 40, 80, 120, 160] as const;

export const VOTING_GOALS = ['NORMAL', 'FORBID', 'BURN', 'MIN_KERMA', 'POSTER'] as const;
export type VotingGoalType = (typeof VOTING_GOALS)[number];

export const VOTING_STATES = ['CREATE', 'UPDATE', 'COMPLETE', 'PERSISTENT'] as const;
export type VotingState = (typeof VOTING_STATES)[number];

export const I18N_FORBID_TITLE = '__i18n_voteForbidTitle';
export const I18N_BURN_TITLE = '__i18n_voteBurnTitle';
export const I18N_MIN_KERMA_TITLE = '__i18n_voteMinKermaTitle';
export const I18N_POSTER_TITLE = '__i18n_votePosterTitle';
export const I18N_FORBID = '__i18n_forbid';
export const I18N_UNFORBID = '__i18n_unForbid';
export const I18N_BURN = '__i18n_burn';
export const I18N_UNBURN = '__i18n_unBurn';
export const I18N_AGREE = '__i18n_agree';
export const I18N_DISAGREE = '__i18n_disagree';
export const I18N_GIVEUP = '__i18n_giveup';

export const SPECIAL_OPTIONS: Record<Exclude<VotingGoalType, 'NORMAL'>, readonly string[]> = {
  FORBID: [I18N_FORBID, I18N_UNFORBID, I18N_GIVEUP],
  BURN: [I18N_BURN, I18N_UNBURN, I18N_GIVEUP],
  MIN_KERMA: [I18N_AGREE, I18N_DISAGREE, I18N_GIVEUP],
  POSTER: [I18N_AGREE, I18N_DISAGREE, I18N_GIVEUP],
};

export function maxChoiceCount(config: number, optionsCount: number): number {
  return Math.max(1, Math.min(optionsCount - 1, config));
}

export function isValidTotalOptions(config: number, optionsCount: number): boolean {
  return config < optionsCount;
}

export function isValidVotedOptions(config: number, votedCount: number): boolean {
  return votedCount > 0 && config >= votedCount;
}

export function isValidDuration(durationMs: number): boolean {
  return durationMs >= VOTE_MIN_DURATION_MS && durationMs <= VOTE_MAX_DURATION_MS;
}

export interface OptionCount {
  option: string;
  count: number;
}

function leadingPair(counts: OptionCount[]): [number, number] {
  return [counts[0]?.count ?? 0, counts[1]?.count ?? 0];
}

export function isQuorumReached(counts: OptionCount[]): boolean {
  const [winning, losing] = leadingPair(counts);
  return winning > losing && winning >= VOTE_QUORUM;
}

export function isUnforbidQuorumReached(counts: OptionCount[]): boolean {
  const [forbid, unforbid] = leadingPair(counts);
  return unforbid > forbid && unforbid >= VOTE_QUORUM;
}

export function abbreviateReason(raw: string, maxWidth = VOTE_MAX_REASON): string {
  if (raw.length <= maxWidth) {
    return raw;
  }
  return `${raw.slice(0, maxWidth - 3)}...`;
}

export function safeReason(raw: string, maxWidth = VOTE_MAX_REASON): string {
  return escapeHtml(abbreviateReason(raw, maxWidth));
}

export interface VoteCreator {
  publicId: string;
  nickname: string;
  colorToken: string | null;
}

export interface VoteTargetDetail {
  reason: string;
  targetPublicId: string;
  targetNickname: string;
}

export interface VoteMinKermaDetail {
  reason: string;
  kerma: number;
}

export interface VotePosterDetail {
  reason: string;
  poster: unknown;
}

export interface VoteGoalDetail {
  NORMAL: Record<string, never>;
  FORBID: VoteTargetDetail;
  BURN: VoteTargetDetail;
  MIN_KERMA: VoteMinKermaDetail;
  POSTER: VotePosterDetail;
}

export type VoteGoal = {
  [G in VotingGoalType]: { goal: G; goalDetail: VoteGoalDetail[G] };
}[VotingGoalType];

export interface VoteViewBase {
  id: string;
  topic: string;
  title: string;
  creator: VoteCreator;
  state: VotingState;
  createTime: number;
  endTime: number;
  options: OptionCount[];
  voterCount: number;
  multipleChoiceConfig: number;
  applied: boolean;
}

export type VoteView = VoteViewBase & VoteGoal;

export function asVoteGoal(goal: VotingGoalType, detail: Record<string, unknown>): VoteGoal {
  const reason = typeof detail['reason'] === 'string' ? detail['reason'] : '';
  switch (goal) {
    case 'FORBID':
    case 'BURN':
      return {
        goal,
        goalDetail: {
          reason,
          targetPublicId: String(detail['targetPublicId'] ?? ''),
          targetNickname: String(detail['targetNickname'] ?? ''),
        },
      };
    case 'MIN_KERMA':
      return { goal, goalDetail: { reason, kerma: Number(detail['kerma'] ?? 0) } };
    case 'POSTER':
      return { goal, goalDetail: { reason, poster: detail['poster'] ?? null } };
    default:
      return { goal: 'NORMAL', goalDetail: {} };
  }
}

export interface VoteCastRequest {
  topic: string;
  permit: string;
  votingId: string;
  options: string[];
}

export interface VoteApplyRequest {
  topic: string;
  permit: string;
  votingId: string;
  unforbid?: boolean;
  nickname?: string;
}

export interface VoteCreatedResponse {
  votingId: string;
}

export interface VoteCastResponse {
  ok: boolean;
}

export interface VoteAppliedResponse {
  applied: boolean;
}

export interface RecentVotesResponse {
  topic: string;
  votings: VoteView[];
}
