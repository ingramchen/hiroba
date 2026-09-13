<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    prefix?: string;
    contentClass?: string;
    caption?: string | null;
    captionHtml?: string | null;
    inner?: boolean;
  }>(),
  { prefix: 'dialog', contentClass: '', caption: null, captionHtml: null, inner: true },
);
const p = props.prefix;
</script>

<template>
  <div>
    <table cellspacing="0" cellpadding="0">
      <tbody>
        <tr :class="`${p}Top`">
          <td :class="`${p}TopLeft`"><div v-if="props.inner" :class="`${p}TopLeftInner`"></div></td>
          <td :class="`${p}TopCenter`">
            <div v-if="props.inner" :class="`${p}TopCenterInner`">
              <div
                v-if="props.captionHtml !== null"
                class="Caption"
                v-html="props.captionHtml"
              ></div>
              <div v-else-if="props.caption !== null" class="Caption">{{ props.caption }}</div>
            </div>
          </td>
          <td :class="`${p}TopRight`">
            <div v-if="props.inner" :class="`${p}TopRightInner`"></div>
          </td>
        </tr>
        <tr :class="`${p}Middle`">
          <td :class="`${p}MiddleLeft`">
            <div v-if="props.inner" :class="`${p}MiddleLeftInner`"></div>
          </td>
          <td :class="`${p}MiddleCenter`">
            <div :class="[`${p}MiddleCenterInner`, `${p}Content`, props.contentClass]">
              <slot />
            </div>
          </td>
          <td :class="`${p}MiddleRight`">
            <div v-if="props.inner" :class="`${p}MiddleRightInner`"></div>
          </td>
        </tr>
        <tr :class="`${p}Bottom`">
          <td :class="`${p}BottomLeft`">
            <div v-if="props.inner" :class="`${p}BottomLeftInner`"></div>
          </td>
          <td :class="`${p}BottomCenter`">
            <div v-if="props.inner" :class="`${p}BottomCenterInner`"></div>
          </td>
          <td :class="`${p}BottomRight`">
            <div v-if="props.inner" :class="`${p}BottomRightInner`"></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
