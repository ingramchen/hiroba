<script setup lang="ts">
import GwtImage from '../../gwt/GwtImage.vue';
import type { VoteChartDecor } from '../../live/voteState';

const props = defineProps<{ title: string; decor: VoteChartDecor }>();
</script>

<template>
  <div class="SquareCssResource-voteTitle">
    <GwtImage
      v-if="props.decor.icon !== null"
      :img="props.decor.icon"
      cls="GlobalCssResource-img24"
    />
    <span>{{ props.title }}</span>
    <span
      v-if="props.decor.target !== null"
      class="GlobalCssResource-colorNickname"
      :style="'color:' + props.decor.target.color"
      >{{ props.decor.target.nickname }}</span
    >
    <span v-if="props.decor.reason.length > 0" class="SquareCssResource-voteReason">{{
      props.decor.reason
    }}</span>
  </div>
</template>
