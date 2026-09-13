import type { MessageKey } from '../i18n';
import { calculateColor, rgbCss, type VoteView, type VotingGoalType } from '@hiroba/shared';
import { IMG, type BundleImage } from '../assets/images';
import { asPosterView, type PosterView } from '../poster/poster';
import type { PosterDisplayMode } from '../poster/render';

export interface VoteChartDecor {
  special: boolean;
  icon: BundleImage | null;
  target: { nickname: string; color: string } | null;
  reason: string;
  poster: PosterView | null;
  posterMode: PosterDisplayMode;
}

const GOAL_ICONS: Record<string, BundleImage> = {
  MIN_KERMA: IMG.voteMinKerma,
  FORBID: IMG.voteForbid,
  BURN: IMG.voteBurn,
  POSTER: IMG.poster,
};

/** FORBID/BURN put the target beside the title as a coloured nickname, so the title stays short. */
export function voteChartTitle(
  goal: VotingGoalType,
  shortTitle: string,
  fullTitle: string,
): string {
  return goal === 'FORBID' || goal === 'BURN' ? shortTitle : fullTitle;
}

export function voteChartDecor(
  voting: VoteView,
  colorTokenOf: (publicId: string) => string | null = () => null,
): VoteChartDecor {
  const icon = GOAL_ICONS[voting.goal] ?? null;
  const detail = voting.goalDetail as Record<string, unknown>;
  const reason = typeof detail['reason'] === 'string' ? detail['reason'] : '';
  const targetNickname =
    typeof detail['targetNickname'] === 'string' ? detail['targetNickname'] : '';
  const targetPublicId =
    typeof detail['targetPublicId'] === 'string' ? detail['targetPublicId'] : '';
  const target =
    (voting.goal === 'FORBID' || voting.goal === 'BURN') && targetNickname.length > 0
      ? {
          nickname: targetNickname,
          color: rgbCss(calculateColor(targetPublicId, colorTokenOf(targetPublicId))),
        }
      : null;
  return {
    special: icon !== null,
    icon,
    target,
    reason,
    poster: voting.goal === 'POSTER' ? asPosterView(detail['poster']) : null,
    posterMode: voting.state === 'COMPLETE' ? 'ONE_LINE' : 'SMALL',
  };
}

export interface VoteChartRow {
  option: string;
  count: number;
}

export interface VotePanelView {
  statistics: string;
  creatorNickname: string;
  creatorColor: string;
  createdAt: string;
  optionHeader: string;
  countHeader: string;
  rows: VoteChartRow[];
  total: number;
  canVote: boolean;
  supportVoteForbid: boolean;
  chartTitle: string;
  decor: VoteChartDecor;
  locale: string;
}

export function shortDateTime(millis: number): string {
  const date = new Date(millis);
  const hour = date.getHours();
  const meridiem = hour < 12 ? '上午' : '下午';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${String(date.getFullYear())}/${String(date.getMonth() + 1)}/${String(date.getDate())} ${meridiem}${String(twelve)}:${minute}`;
}

/** Maps a vote refusal code from the server to the message the old client showed; null = no mapping (the raw code is shown). */
export function voteErrorKey(code: string): MessageKey | null {
  switch (code) {
    case 'VOTE_IN_PROGRESS':
      return 'votingCreateFail';
    case 'NOT_ENOUGH_KERMA':
      return 'kermaNotEnough';
    case 'ALREADY_VOTED':
    case 'INVALID_BALLOT':
    case 'NO_SUCH_VOTING':
      return 'votingVoteFail';
    case 'INVALID_TITLE':
      return 'votingTitleIsRequired';
    case 'INVALID_OPTIONS':
      return 'votingAtLeastTwoOptions';
    case 'INVALID_REASON':
      return 'voteReasonPrompt';
    default:
      return null;
  }
}
