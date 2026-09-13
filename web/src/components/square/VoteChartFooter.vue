<script setup lang="ts">
import { GwtTable } from '../../gwt/panels';
import GwtImage from '../../gwt/GwtImage.vue';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';
import { elementRect, type AnchorRect } from '../../gwt/relativePosition';
import type { VoteChartStats } from './voteChart';

const props = withDefaults(
  defineProps<{
    stats?: VoteChartStats | null;
    leading?: boolean;
  }>(),
  { stats: null, leading: false },
);

const emit = defineEmits<{ forbidCreator: [anchor: AnchorRect] }>();

const i18n = t();
</script>

<template>
  <GwtTable
    :columns="2"
    :table-style="{ width: '100%' }"
    :rows="[[props.leading ? {} : { empty: true }, { valign: 'middle' }]]"
  >
    <slot />
    <div style="text-align: right">
      <div v-if="props.stats === null"></div>
      <div v-else>
        <span>{{ props.stats.statistics }}</span>
        <span style="padding-left: 10px"></span>
        <span
          class="GlobalCssResource-colorNickname"
          :style="'color:' + props.stats.creatorColor"
          >{{ props.stats.creatorNickname }}</span
        >
        <span> @{{ props.stats.createdAt }}</span>
        <GwtImage
          v-if="props.stats.supportVoteForbid"
          :img="IMG.voteForbidSmall"
          cls="GlobalCssResource-img16"
          pointer
          :title="i18n.t('forbidCrowdTitle')"
          style="display: inline-block; padding-left: 5px; vertical-align: top"
          @click="emit('forbidCreator', elementRect($event.currentTarget as Element))"
        />
      </div>
    </div>
  </GwtTable>
</template>
