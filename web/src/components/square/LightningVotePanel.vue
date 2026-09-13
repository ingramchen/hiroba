<script setup lang="ts">
import { VerticalPanel, HorizontalPanel } from '../../gwt/panels';
import { t } from '../../runtime';
import type { VotePanelView } from '../../live/voteState';
import type { AnchorRect } from '../../gwt/relativePosition';
import VoteChartHeader from './VoteChartHeader.vue';
import VoteChartTable from './VoteChartTable.vue';
import VoteChartFooter from './VoteChartFooter.vue';
import PosterPanel from './PosterPanel.vue';

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    title?: string;
    titleRed?: boolean;
    reason?: string;
    countdown?: string;
    ended?: boolean;
    chartVisible?: boolean;
    panel?: VotePanelView | null;
  }>(),
  {
    visible: false,
    title: '',
    titleRed: false,
    reason: '',
    countdown: '',
    ended: false,
    chartVisible: true,
    panel: null,
  },
);

const emit = defineEmits<{
  chartVisible: [value: boolean];
  posterEnlarge: [src: string];
  openBallot: [];
  forbidCreator: [anchor?: AnchorRect];
}>();

const i18n = t();
</script>

<template>
  <table
    cellspacing="0"
    cellpadding="0"
    class="SquareCssResource-lightningVote SquareCssResource-eventSection"
    :style="props.visible ? { width: '100%' } : { display: 'none' }"
  >
    <tbody>
      <tr>
        <td align="left" style="vertical-align: top">
          <HorizontalPanel :table-style="{ width: '100%' }" :cells="[{ width: '100%' }, {}]">
            <div
              :class="[
                'gwt-HTML',
                'SquareCssResource-title',
                'GlobalCssResource-zhFont',
                props.titleRed ? 'SquareCssResource-titleRed' : '',
              ]"
            >
              {{
                props.ended
                  ? i18n.t('lightningVoteEnd')
                  : props.countdown
                    ? i18n.t('lightningVote') + ' ' + props.countdown
                    : i18n.t('lightningVote')
              }}
            </div>
            <select
              class="gwt-ListBox SquareCssResource-eventSectionModeSelector"
              :value="props.chartVisible ? 'SHOW' : 'HIDE'"
              @change="emit('chartVisible', ($event.target as HTMLSelectElement).value === 'SHOW')"
            >
              <option value="SHOW">{{ i18n.t('lightningVoteShow') }}</option>
              <option value="HIDE">{{ i18n.t('lightningVoteHide') }}</option>
            </select>
          </HorizontalPanel>
        </td>
      </tr>
      <tr>
        <td align="left" style="vertical-align: top">
          <VerticalPanel
            :spacing="5"
            :table-style="
              props.chartVisible ? { width: '100%' } : { width: '100%', display: 'none' }
            "
            :class="[
              'SquareCssResource-voteChartPanel',
              props.panel !== null && props.panel.decor.special
                ? 'SquareCssResource-specialVotingGoal'
                : '',
            ]"
          >
            <VoteChartHeader
              v-if="props.panel !== null"
              :title="props.panel.chartTitle"
              :decor="props.panel.decor"
            />
            <div v-else class="SquareCssResource-voteTitle">{{ props.title }}</div>
            <VoteChartTable
              v-if="props.panel !== null"
              :rows="props.panel.rows"
              :total="props.panel.total"
              :option-header="props.panel.optionHeader"
              :count-header="props.panel.countHeader"
            />
            <VoteChartFooter
              :stats="props.panel"
              :leading="props.panel !== null && props.panel.canVote"
              @forbid-creator="emit('forbidCreator', $event)"
            >
              <button
                v-if="props.panel !== null && props.panel.canVote"
                type="button"
                class="gwt-Button"
                style="width: 100px"
                @click="emit('openBallot')"
              >
                {{ i18n.t('votingOpenVote') }}
              </button>
            </VoteChartFooter>
            <div
              class="SquareCssResource-voteGoalPanel"
              :style="
                props.panel !== null && props.panel.decor.poster !== null
                  ? undefined
                  : { display: 'none' }
              "
            >
              <PosterPanel
                v-if="props.panel !== null && props.panel.decor.poster !== null"
                :poster="props.panel.decor.poster"
                :mode="props.panel.decor.posterMode"
                :locale="props.panel.locale"
                @enlarge="emit('posterEnlarge', $event)"
              />
            </div>
          </VerticalPanel>
        </td>
      </tr>
    </tbody>
  </table>
</template>
