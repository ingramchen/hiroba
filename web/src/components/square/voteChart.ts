import type { Translator } from '../../i18n';
import type { VoteChartRow } from '../../live/voteState';

export interface VoteChartStats {
  statistics: string;
  creatorNickname: string;
  creatorColor: string;
  createdAt: string;
  supportVoteForbid: boolean;
}

export type { VoteChartRow };

export function barWidth(count: number, total: number): string {
  return total <= 0 ? '0%' : String(Math.round((count / total) * 100)) + '%';
}

export function voteTotal(rows: readonly VoteChartRow[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

export function voteStatistics(
  i18n: Translator,
  total: number,
  voterCount: number,
  multipleChoice: number,
): string {
  const votingTotal = i18n.t('votingTotal', String(total));
  return multipleChoice > 1
    ? votingTotal + ' ' + i18n.t('voterTotal', String(voterCount))
    : votingTotal;
}

export function voteCountHeader(i18n: Translator, multipleChoice: number): string {
  return multipleChoice > 1
    ? i18n.t('votingNoOfVote') + ' (' + i18n.t('multipleChoice', String(multipleChoice)) + ')'
    : i18n.t('votingNoOfVote');
}
