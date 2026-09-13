<script lang="ts">
import type { ChatroomType } from '@hiroba/shared';

export type RoomType = ChatroomType;

export type ToolName =
  'emoji' | 'crowd' | 'upload' | 'forbid' | 'voteNormal' | 'voteForbid' | 'voteMinKerma';

export const SMILEY_STOCK_CLASS = 'SquareCssResource-smileyStock';

export function smileyStockTarget(scope: string): string {
  return `[data-input-scope='${scope}'] .${SMILEY_STOCK_CLASS}`;
}
</script>

<script setup lang="ts">
import { GwtTable } from '../../gwt/panels';
import GwtImage from '../../gwt/GwtImage.vue';
import { IMG } from '../../assets/images';
import { computed, ref } from 'vue';
import { t } from '../../runtime';
import { LIMITS, MAX_NICKNAME_LENGTH } from '@hiroba/shared';
import { inputScopeOf } from '../../emoji/picker';

const props = withDefaults(
  defineProps<{
    roomType?: RoomType;
    prompt?: string;
    maxlength?: number;
    quotaOk?: boolean;
    quotaText?: string;
    nickname?: string;
    message?: string;
    upload?: boolean;
    forbid?: boolean;
    voteNormal?: boolean;
    voteForbid?: boolean;
    voteMinKerma?: boolean;
    nicknameDisabled?: boolean;
    scope?: string;
  }>(),
  {
    roomType: 'FREE',
    prompt: '',
    maxlength: LIMITS.contentClient,
    quotaOk: true,
    quotaText: '',
    nickname: '',
    message: '',
    upload: true,
    forbid: false,
    voteNormal: true,
    voteForbid: true,
    voteMinKerma: true,
    nicknameDisabled: false,
    scope: '',
  },
);

const emit = defineEmits<{
  'update:nickname': [value: string];
  'update:message': [value: string];
  commitNickname: [value: string];
  send: [];
  tool: [name: ToolName, scope: string, rect?: DOMRect];
}>();

const i18n = t();
const keke = computed(() => props.roomType === 'DEGRADE_FREE' || props.roomType === 'CHAT_FREEZE');

const scope = computed(() => (props.scope.length > 0 ? props.scope : inputScopeOf(props.roomType)));

function onTool(name: ToolName, event: MouseEvent): void {
  const icon = (event.currentTarget as HTMLElement).querySelector('img');
  emit('tool', name, scope.value, icon?.getBoundingClientRect());
}

function onNicknameInput(event: Event): void {
  emit('update:nickname', (event.target as HTMLInputElement).value);
}

function onMessageInput(event: Event): void {
  emit('update:message', (event.target as HTMLTextAreaElement).value);
}

const messageField = ref<HTMLTextAreaElement | null>(null);

function onMessageKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.isComposing) {
    return;
  }
  event.preventDefault();
  emit('send');
}

function appendMention(nickname: string): void {
  emit('update:message', `${props.message} @${nickname} `);
  messageField.value?.focus();
}

function focusMessage(): void {
  messageField.value?.focus();
}

defineExpose({ appendMention, focusMessage });
</script>

<template>
  <div>
    <GwtTable
      :columns="2"
      :rows="[
        [{ cls: 'SquareCssResource-inputAreaLabel' }, {}],
        [{ cls: 'SquareCssResource-inputAreaLabel' }, {}],
      ]"
      :class="['SquareCssResource-inputArea', keke ? 'SquareCssResource-kekeInputArea' : '']"
      :data-input-scope="scope"
    >
      <div class="gwt-Label">{{ i18n.t('nickNamePrompt') }}:</div>
      <div class="SquareCssResource-inputTopBar">
        <input
          type="text"
          class="gwt-TextBox SquareCssResource-nicknameField"
          :maxlength="MAX_NICKNAME_LENGTH"
          style=""
          :disabled="props.nicknameDisabled ? true : undefined"
          :value="props.nickname"
          @input="onNicknameInput"
          @blur="emit('commitNickname', props.nickname)"
        />
        <GwtTable
          :columns="9"
          :spacing="0"
          :padding="0"
          :rows="[[{}, {}, {}, {}, {}, {}, {}, { cls: 'SquareCssResource-submitInputButton' }, {}]]"
          class="SquareCssResource-inputAreaTool"
        >
          <div @click="onTool('emoji', $event)">
            <GwtImage :img="IMG.emoji" pointer />
          </div>
          <div @click="onTool('crowd', $event)">
            <GwtImage :img="IMG.crowdlist" :title="i18n.t('crowdListTitle')" pointer />
          </div>
          <div v-if="props.upload" @click="onTool('upload', $event)">
            <GwtImage
              :img="IMG.upload"
              cls="GlobalCssResource-img24"
              :title="i18n.t('uploadImageTitle')"
              pointer
            />
          </div>
          <span v-else class="gwt-InlineLabel"></span>
          <div v-if="props.forbid" @click="onTool('forbid', $event)">
            <GwtImage :img="IMG.forbid" :title="i18n.t('forbidCrowdTitle')" pointer />
          </div>
          <span v-else class="gwt-InlineLabel"></span>
          <div v-if="props.voteNormal" @click="onTool('voteNormal', $event)">
            <GwtImage :img="IMG.voteNormal" :title="i18n.t('votingCreatorTitle')" pointer />
          </div>
          <span v-else class="gwt-InlineLabel"></span>
          <div v-if="props.voteForbid" @click="onTool('voteForbid', $event)">
            <GwtImage :img="IMG.voteForbid" :title="i18n.t('forbidCrowdTitle')" pointer />
          </div>
          <span v-else class="gwt-InlineLabel"></span>
          <div v-if="props.voteMinKerma" @click="onTool('voteMinKerma', $event)">
            <GwtImage :img="IMG.voteMinKerma" :title="i18n.t('voteMinKermaCreatorTitle')" pointer />
          </div>
          <span v-else class="gwt-InlineLabel"></span>
          <button type="button" class="gwt-Button" @click="emit('send')">
            {{ i18n.t('sendMessageButton') }}
          </button>
          &nbsp;
        </GwtTable>
      </div>
      <div class="gwt-Label">{{ props.prompt }}:</div>
      <div class="SquareCssResource-messageInputArea">
        <div class="gwt-HTML SquareCssResource-quotaStatus">
          <span v-if="props.quotaOk" style="color: green">{{ props.quotaText }}</span>
          <b v-else style="color: red">{{ props.quotaText }}</b>
        </div>
        <textarea
          ref="messageField"
          class="gwt-TextArea SquareCssResource-messageInputField"
          :maxlength="props.maxlength"
          style=""
          :value="props.message"
          @input="onMessageInput"
          @keydown="onMessageKeydown"
        ></textarea>
        <div :class="SMILEY_STOCK_CLASS"></div>
      </div>
    </GwtTable>
  </div>
</template>
