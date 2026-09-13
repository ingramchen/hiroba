<script setup lang="ts">
import type { CoAnchorView } from '@hiroba/shared';
import Popup from '../../gwt/Popup.vue';
import { t } from '../../runtime';

const props = withDefaults(defineProps<{ coAnchors?: CoAnchorView[] }>(), { coAnchors: () => [] });
const emit = defineEmits<{ autoHide: [] }>();

const i18n = t();
const PER_ROW = 3;

function rows(list: CoAnchorView[]): CoAnchorView[][] {
  const out: CoAnchorView[][] = [];
  for (let index = 0; index < list.length; index += PER_ROW) {
    out.push(list.slice(index, index + PER_ROW));
  }
  return out;
}
</script>

<template>
  <Popup
    animated
    :caption="i18n.t('currentCoAnchors')"
    :position="{ mode: 'center' }"
    clipped
    auto-hide
    @auto-hide="emit('autoHide')"
  >
    <div style="overflow: auto; position: relative; zoom: 1; height: 200px; width: 300px">
      <table cellspacing="5" class="SquareCssResource-coAnchorList">
        <tbody>
          <tr v-for="(row, index) in rows(props.coAnchors)" :key="index">
            <td v-for="c in row" :key="c.username">
              <div class="gwt-HTML">{{ c.username }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Popup>
</template>
