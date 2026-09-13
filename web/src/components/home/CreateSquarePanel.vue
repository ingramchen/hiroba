<script setup lang="ts">
import { MAX_TOPIC_LENGTH } from '@hiroba/shared';
import ColorBox from '../ColorBox.vue';
import { HorizontalPanel, VerticalPanel } from '../../gwt/panels';
import { t } from '../../runtime';
import { refusesTopicKey } from './topicInput';

const props = withDefaults(
  defineProps<{ loggedIn?: boolean; freeTopic?: string; anchorTopic?: string }>(),
  { loggedIn: false, freeTopic: '', anchorTopic: '' },
);

const emit = defineEmits<{
  'update:freeTopic': [value: string];
  'update:anchorTopic': [value: string];
  go: [];
  create: [];
  login: [rect: DOMRect];
}>();
const i18n = t();

function onTopicKeydown(event: KeyboardEvent): void {
  if (refusesTopicKey(event)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function onAnchorButton(event: MouseEvent): void {
  if (props.loggedIn) {
    emit('create');
    return;
  }
  emit('login', (event.currentTarget as HTMLElement).getBoundingClientRect());
}
</script>

<template>
  <div
    class="HomeCssResource-createSquare GlobalCssResource-zhFont"
    style="width: 700px; height: 200px; margin-left: auto; margin-right: auto"
  >
    <HorizontalPanel :spacing="20" valign="middle" :table-style="{ width: '100%' }">
      <ColorBox :level="3">
        <VerticalPanel :table-style="{ width: '300px', height: '150px' }">
          <div class="gwt-HTML">
            <div style="font-size: 30px">{{ i18n.t('freeTopicTitle') }}</div>
          </div>
          <div class="gwt-HTML">
            <div style="text-indent: 10px; font-size: 16px">{{ i18n.t('freeTopicDesc') }}</div>
          </div>
          <HorizontalPanel>
            <input
              type="text"
              class="gwt-TextBox HomeCssResource-topicBox"
              :maxlength="MAX_TOPIC_LENGTH"
              :placeholder="i18n.t('topicBoxPrompt')"
              :value="props.freeTopic"
              @input="emit('update:freeTopic', ($event.target as HTMLInputElement).value)"
              @keydown="onTopicKeydown"
              @keydown.enter="emit('go')"
            />
            <button
              type="button"
              class="gwt-Button"
              style="font-size: 16px; width: 80px; height: 30px"
              @click="emit('go')"
            >
              Go
            </button>
          </HorizontalPanel>
        </VerticalPanel>
      </ColorBox>
      <ColorBox :level="2">
        <VerticalPanel :table-style="{ width: '300px', height: '150px' }">
          <div class="gwt-HTML">
            <div style="font-size: 30px">{{ i18n.t('anchorTopicTitle') }}</div>
          </div>
          <div class="gwt-HTML">
            <div style="text-indent: 10px; font-size: 16px">{{ i18n.t('anchorTopicDesc') }}</div>
          </div>
          <HorizontalPanel>
            <input
              v-if="props.loggedIn"
              type="text"
              class="gwt-TextBox HomeCssResource-topicBox"
              :maxlength="MAX_TOPIC_LENGTH"
              :placeholder="i18n.t('topicBoxPrompt')"
              :value="props.anchorTopic"
              @input="emit('update:anchorTopic', ($event.target as HTMLInputElement).value)"
              @keydown="onTopicKeydown"
              @keydown.enter="emit('create')"
            />
            <button
              type="button"
              class="gwt-Button"
              :style="
                props.loggedIn
                  ? 'font-size: 16px; width: 80px; height: 30px'
                  : 'font-size: 16px; width: 180px; height: 30px'
              "
              @click="onAnchorButton"
            >
              {{ props.loggedIn ? i18n.t('create') : i18n.t('loginToCreate') }}
            </button>
          </HorizontalPanel>
        </VerticalPanel>
      </ColorBox>
    </HorizontalPanel>
  </div>
</template>
