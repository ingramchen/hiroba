<script setup lang="ts">
import { computed } from 'vue';
import StatusPanel from '../components/StatusPanel.vue';
import HeaderCrowdBox from '../components/home/HeaderCrowdBox.vue';
import Footer from '../components/Footer.vue';
import CreateSquarePanel from '../components/home/CreateSquarePanel.vue';
import TopicListPanel from '../components/home/TopicListPanel.vue';
import { HorizontalPanel } from '../gwt/panels';
import type { MenuEntry } from '../gwt/types';
import type { TopicRow } from '../fixtures/types';
import { t } from '../runtime';
import { homeMenuEntries } from '../live/menu';
import { IMG } from '../assets/images';

const props = withDefaults(
  defineProps<{
    crowd?: number;
    username?: string | null;
    hot?: TopicRow[];
    latest?: TopicRow[];
    freeTopic?: string;
    anchorTopic?: string;
  }>(),
  { crowd: 0, username: null, hot: () => [], latest: () => [], freeTopic: '', anchorTopic: '' },
);

const emit = defineEmits<{
  'update:freeTopic': [value: string];
  'update:anchorTopic': [value: string];
  go: [];
  create: [];
  login: [rect: DOMRect];
  menu: [index: number];
  about: [];
}>();

const i18n = t();

const menuItems = computed<MenuEntry[]>(() => homeMenuEntries(i18n, props.username ?? null));
</script>

<template>
  <table cellspacing="0" cellpadding="0" style="width: 100%">
    <tbody>
      <tr>
        <td align="left" width="" height="" colspan="2" style="vertical-align: top">
          <StatusPanel :items="menuItems" @select="emit('menu', $event)" />
        </td>
      </tr>
      <tr>
        <td align="left" width="" height="" colspan="2" style="vertical-align: top">
          <HorizontalPanel valign="middle" class="HomeCssResource-homeHeader">
            <img
              class="gwt-Image HomeCssResource-logo"
              :src="IMG.logo180.src"
              width="179"
              height="61"
            />
            <HeaderCrowdBox :crowd="props.crowd" />
          </HorizontalPanel>
        </td>
      </tr>
      <tr>
        <td align="left" width="" height="" colspan="2" style="vertical-align: top">
          <CreateSquarePanel
            :logged-in="props.username !== null"
            :free-topic="props.freeTopic"
            :anchor-topic="props.anchorTopic"
            @update:free-topic="emit('update:freeTopic', $event)"
            @update:anchor-topic="emit('update:anchorTopic', $event)"
            @go="emit('go')"
            @create="emit('create')"
            @login="emit('login', $event)"
          />
        </td>
      </tr>
      <tr>
        <td align="left" width="50%" height="" style="vertical-align: top">
          <TopicListPanel title="HOT" :topics="props.hot" />
        </td>
        <td align="left" width="" height="" rowspan="1" style="vertical-align: top">
          <TopicListPanel title="LATEST" :topics="props.latest" right-panel />
        </td>
      </tr>
      <tr>
        <td align="left" width="" height="" colspan="2" style="vertical-align: top">
          <Footer @about="emit('about')" />
        </td>
      </tr>
    </tbody>
  </table>
</template>
