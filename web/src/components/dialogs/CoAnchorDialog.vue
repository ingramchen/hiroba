<script setup lang="ts">
import { ref } from 'vue';
import type { CoAnchorView } from '@hiroba/shared';
import Popup from '../../gwt/Popup.vue';
import { GwtTable, VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';

const props = withDefaults(
  defineProps<{ topic: string; coAnchors?: CoAnchorView[]; left?: number; top?: number }>(),
  {
    coAnchors: () => [],
    left: 403,
    top: 29,
  },
);

const emit = defineEmits<{ add: [username: string]; autoHide: [] }>();

const i18n = t();
const username = ref('');
const placeholder = ref(true);

function onFocus(): void {
  placeholder.value = false;
}

function onAdd(): void {
  const value = username.value.trim();
  if (value.length === 0) {
    return;
  }
  emit('add', value);
}
</script>

<template>
  <Popup
    animated
    :caption="i18n.t('manageCoAnchorsTitle', props.topic)"
    :position="{ mode: 'fixed', left: props.left, top: props.top }"
    clipped
    auto-hide
    modal
    @auto-hide="emit('autoHide')"
  >
    <GwtTable
      :columns="2"
      :spacing="5"
      :table-style="{ width: '400px', height: '300px' }"
      :rows="[[{ colspan: 2 }], [{}, {}], [{ colspan: 2 }], [{ colspan: 2 }]]"
    >
      <div class="gwt-HTML" v-html="i18n.t('addCoAnchorDesc')"></div>
      <input
        type="text"
        class="gwt-TextBox"
        style="width: 100%"
        :value="placeholder ? i18n.t('typeTwitterAccount') : username"
        @focus="onFocus"
        @input="username = ($event.target as HTMLInputElement).value"
        @keyup.enter="onAdd"
      />
      <button type="button" class="gwt-Button" @click="onAdd">
        {{ i18n.t('addCoAnchorButton') }}
      </button>
      <div class="gwt-HTML">
        <hr />
        <b>{{ i18n.t('currentCoAnchors') }}</b>
      </div>
      <div>
        <VerticalPanel>
          <div style="overflow: auto; position: relative; zoom: 1; height: 200px; width: 300px">
            <div style="position: relative; zoom: 1">
              <table cellspacing="5">
                <colgroup>
                  <col />
                </colgroup>
                <tbody>
                  <tr v-for="c in props.coAnchors" :key="c.username">
                    <td>
                      <div class="gwt-HTML">{{ c.username }}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </VerticalPanel>
      </div>
    </GwtTable>
  </Popup>
</template>
