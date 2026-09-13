<script setup lang="ts">
import { ref } from 'vue';
import ExternalLink from '../ExternalLink.vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { IMG } from '../../assets/images';
import { useRowActions } from '../../live/rowActions';
import type { ChatRow } from '../../fixtures/types';

const props = defineProps<{ row: ChatRow }>();
const emit = defineEmits<{ mention: [nickname: string] }>();
const actions = useRowActions();
const hovered = ref(false);
</script>

<template>
  <div
    :class="[
      'SquareCssResource-chatContent',
      props.row.even ? 'SquareCssResource-even' : '',
      props.row.replyToMe ? 'SquareCssResource-replyToMe' : '',
    ]"
  >
    <div v-if="props.row.forbidIcon" class="SquareCssResource-chatName">
      <div
        :class="['gwt-HTML', hovered ? 'SquareCssResource-chatNameHover' : '']"
        :title="props.row.replyTo"
        @click="emit('mention', props.row.nickname)"
        @mouseover="hovered = true"
        @mouseout="hovered = false"
      >
        <span v-if="props.row.anchor" class="SquareCssResource-anchorIcon"></span>
        <span class="GlobalCssResource-colorNickname" :style="'color:' + props.row.color"
          >{{ props.row.nickname
          }}<span v-if="props.row.showColor">{{ props.row.showColor }}</span></span
        >
      </div>
      <GwtImage
        :img="IMG.forbid"
        cls="GlobalCssResource-img24"
        pointer
        @click="actions.forbid(props.row.senderPublicId ?? '', props.row.nickname)"
      />
    </div>
    <div
      v-else
      :class="[
        'gwt-HTML',
        'SquareCssResource-chatName',
        hovered ? 'SquareCssResource-chatNameHover' : '',
      ]"
      :title="props.row.replyTo"
      @click="emit('mention', props.row.nickname)"
      @mouseover="hovered = true"
      @mouseout="hovered = false"
    >
      <span v-if="props.row.anchor" class="SquareCssResource-anchorIcon"></span>
      <span class="GlobalCssResource-colorNickname" :style="'color:' + props.row.color"
        >{{ props.row.nickname
        }}<span v-if="props.row.showColor">{{ props.row.showColor }}</span></span
      >
    </div>
    <div class="SquareCssResource-messageContainer">
      <div class="gwt-HTML SquareCssResource-message">
        <template v-for="(part, i) in props.row.parts" :key="i"
          ><template v-if="part.kind === 'text'">{{ part.text }}</template
          ><ExternalLink v-else-if="part.kind === 'link'" :href="part.href"
            ><template v-for="(sub, j) in part.label" :key="j"
              ><template v-if="sub.kind === 'text'">{{ sub.text }}</template
              ><br v-else-if="sub.kind === 'break'" /><img
                v-else
                class="GlobalCssResource-smiley"
                :src="sub.src"
                :alt="sub.alt" /></template></ExternalLink
          ><br v-else-if="part.kind === 'break'" /><img
            v-else
            class="GlobalCssResource-smiley"
            :src="part.src"
            :alt="part.alt" /></template
        ><span class="SquareCssResource-chatDate"> @ {{ props.row.time }}</span>
      </div>
    </div>
  </div>
</template>
