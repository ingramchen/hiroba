<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import { GwtTable, VerticalPanel, HorizontalPanel } from '../../gwt/panels';
import type { ChatRow } from '../../fixtures/types';
import ExternalLink from '../ExternalLink.vue';
import { t } from '../../runtime';

const props = withDefaults(
  defineProps<{
    nickname: string;
    color: string;
    rows?: ChatRow[];
    help: string;
    captionPrefix: string;
    forbid?: boolean;
  }>(),
  { rows: () => [], forbid: false },
);

const emit = defineEmits<{ forbid: []; unforbid: []; close: [] }>();
const i18n = t();
</script>

<template>
  <Popup
    animated
    cls="gwt-DialogBox SquareCssResource-watchPanel"
    :caption-html="
      props.captionPrefix +
      '<span class=&quot;GlobalCssResource-colorNickname&quot; style=&quot;color:' +
      props.color +
      '&quot;>' +
      props.nickname +
      '</span>'
    "
    clipped
  >
    <GwtTable
      :columns="1"
      :rows="[[{}], [{}]]"
      :class="props.forbid ? 'SquareCssResource-forbidMonitorPanel' : undefined"
    >
      <HorizontalPanel>
        <button v-if="props.forbid" type="button" class="gwt-Button" @click="emit('forbid')">
          {{ i18n.t('forbid') }}
        </button>
        <button v-if="props.forbid" type="button" class="gwt-Button" @click="emit('unforbid')">
          {{ i18n.t('unForbid') }}
        </button>
        <button type="button" class="gwt-Button" @click="emit('close')">
          {{ i18n.t('close') }}
        </button>
      </HorizontalPanel>
      <div style="overflow: auto; position: relative; zoom: 1; width: 250px; height: 200px">
        <div style="position: relative; zoom: 1">
          <VerticalPanel class="SquareCssResource-watchPanel" :table-style="{ width: '230px' }">
            <div class="gwt-HTML">
              <span style="color: #555">{{ props.help }}</span>
            </div>
            <div
              v-for="(row, i) in props.rows"
              :key="i"
              :class="[
                'gwt-HTML',
                'SquareCssResource-message',
                row.even ? '' : 'SquareCssResource-odd',
                row.replyToMe ? 'SquareCssResource-replyToMe' : '',
              ]"
            >
              <template v-for="(part, j) in row.parts" :key="j"
                ><template v-if="part.kind === 'text'">{{ part.text }}</template
                ><ExternalLink v-else-if="part.kind === 'link'" :href="part.href"
                  ><template v-for="(sub, k) in part.label" :key="k"
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
                  :alt="part.alt"
              /></template>
            </div>
          </VerticalPanel>
        </div>
      </div>
    </GwtTable>
  </Popup>
</template>
