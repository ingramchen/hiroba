<script setup lang="ts">
import { computed, ref } from 'vue';
import Popup from '../../gwt/Popup.vue';
import { VerticalPanel } from '../../gwt/panels';
import { abbreviate } from '@hiroba/shared';
import { t } from '../../runtime';
import GwtImage from '../../gwt/GwtImage.vue';
import { IMG } from '../../assets/images';
import VoteChartHeader from '../square/VoteChartHeader.vue';
import VoteChartTable from '../square/VoteChartTable.vue';
import VoteChartFooter from '../square/VoteChartFooter.vue';
import PosterPanel from '../square/PosterPanel.vue';
import {
  voteCountHeader,
  voteStatistics,
  voteTotal,
  type VoteChartStats,
} from '../square/voteChart';
import type { AnchorRect } from '../../gwt/relativePosition';
import { shortDateTime, type VoteChartDecor } from '../../live/voteState';
import { chunk } from './chunk';

export interface RecentVoteRow {
  id: string;
  title: string;
  options: { option: string; count: number }[];
  voterCount: number;
  multipleChoice: number;
  chartTitle: string;
  creatorNickname: string;
  creatorColor: string;
  createTime: number;
  decor: VoteChartDecor;
}

const TOPIC_COLUMNS = 5;
const TOPIC_TITLE_LENGTH = 25;

const props = withDefaults(
  defineProps<{
    position?: { left: number; top: number };
    votings?: RecentVoteRow[];
    loading?: boolean;
    supportVoteForbid?: boolean;
    locale?: string;
  }>(),
  {
    position: () => ({ left: 100, top: 0 }),
    votings: () => [],
    loading: false,
    supportVoteForbid: false,
    locale: 'zh-TW',
  },
);
const emit = defineEmits<{
  autoHide: [];
  forbidCreator: [id: string, anchor: AnchorRect];
  posterEnlarge: [src: string];
}>();
const i18n = t();
const selected = ref<string | null>(null);

const topicRows = computed<RecentVoteRow[][]>(() => chunk(props.votings, TOPIC_COLUMNS));

const chart = computed<RecentVoteRow | null>(
  () => props.votings.find((row) => row.id === selected.value) ?? null,
);

const stats = computed<VoteChartStats | null>(() =>
  chart.value === null
    ? null
    : {
        statistics: voteStatistics(
          i18n,
          voteTotal(chart.value.options),
          chart.value.voterCount,
          chart.value.multipleChoice,
        ),
        creatorNickname: chart.value.creatorNickname,
        creatorColor: chart.value.creatorColor,
        createdAt: shortDateTime(chart.value.createTime),
        supportVoteForbid: props.supportVoteForbid,
      },
);

function onForbidCreator(anchor: AnchorRect): void {
  if (chart.value !== null) {
    emit('forbidCreator', chart.value.id, anchor);
  }
}
</script>

<template>
  <Popup
    animated
    :caption="i18n.t('votingRecents')"
    :position="{ mode: 'fixed', left: props.position.left, top: props.position.top }"
    clipped
    auto-hide
    @auto-hide="emit('autoHide')"
  >
    <div v-if="props.loading" style="text-align: center">
      <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" />
    </div>
    <VerticalPanel v-else :cells="[{ align: 'center' }, { align: 'center' }]">
      <table cellspacing="0" cellpadding="0">
        <tbody>
          <tr v-for="(row, r) in topicRows" :key="r">
            <td v-for="voting in row" :key="voting.id" width="120px">
              <a class="gwt-Anchor" href="javascript:;" @click="selected = voting.id">{{
                abbreviate(voting.title, TOPIC_TITLE_LENGTH)
              }}</a>
            </td>
          </tr>
        </tbody>
      </table>
      <VerticalPanel
        :spacing="5"
        :table-style="{ width: '100%' }"
        :class="[
          'SquareCssResource-voteChartPanel',
          chart !== null && chart.decor.special ? 'SquareCssResource-specialVotingGoal' : '',
        ]"
      >
        <VoteChartHeader v-if="chart !== null" :title="chart.chartTitle" :decor="chart.decor" />
        <div v-else class="SquareCssResource-voteTitle"></div>
        <VoteChartTable
          v-if="chart !== null"
          :rows="chart.options"
          :total="voteTotal(chart.options)"
          :option-header="i18n.t('votingOptionPrompt')"
          :count-header="voteCountHeader(i18n, chart.multipleChoice)"
        />
        <VoteChartFooter :stats="stats" @forbid-creator="onForbidCreator" />
        <div
          class="SquareCssResource-voteGoalPanel"
          :style="chart !== null && chart.decor.poster !== null ? undefined : { display: 'none' }"
        >
          <PosterPanel
            v-if="chart !== null && chart.decor.poster !== null"
            :poster="chart.decor.poster"
            :mode="chart.decor.posterMode"
            :locale="props.locale"
            @enlarge="emit('posterEnlarge', $event)"
          />
        </div>
      </VerticalPanel>
    </VerticalPanel>
  </Popup>
</template>
