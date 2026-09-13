<script setup lang="ts">
import InputArea from './InputArea.vue';
import AnchorBar from './AnchorBar.vue';
import ResizeBox from './ResizeBox.vue';
import ChatMessageRow from './ChatMessageRow.vue';
import { VerticalPanel } from '../../gwt/panels';
import type { ChatRow } from '../../fixtures/types';
import type { RoomType, ToolName } from './InputArea.vue';
import { computed, ref } from 'vue';
import { t } from '../../runtime';
import { LIMITS } from '@hiroba/shared';

const props = withDefaults(
  defineProps<{
    roomType?: RoomType;
    rows?: ChatRow[];
    quotaOk?: boolean;
    quotaText?: string;
    nickname?: string;
    message?: string;
    forbidden?: boolean;
    anchor?: { name: string; href: string } | null;
    anchorable?: boolean;
    kekeRows?: ChatRow[];
    kekeMessage?: string;
    nicknameDisabled?: boolean;
    maxLength?: number;
  }>(),
  {
    roomType: 'FREE',
    rows: () => [],
    quotaOk: true,
    quotaText: '',
    nickname: '',
    message: '',
    forbidden: false,
    anchor: null,
    anchorable: false,
    kekeRows: () => [],
    kekeMessage: '',
    nicknameDisabled: false,
    maxLength: LIMITS.contentClient,
  },
);

const emit = defineEmits<{
  'update:nickname': [value: string];
  'update:message': [value: string];
  'update:kekeMessage': [value: string];
  commitNickname: [value: string];
  send: [];
  sendKeke: [];
  tool: [name: ToolName, scope: string, rect?: DOMRect];
  coAnchors: [];
}>();

const i18n = t();
const keke = computed(() => props.roomType === 'DEGRADE_FREE' || props.roomType === 'CHAT_FREEZE');
const prompt = computed(() =>
  props.roomType === 'DEGRADE_FREE'
    ? i18n.t('kekePrompt')
    : props.roomType === 'CHAT_FREEZE'
      ? i18n.t('chatFreezePrompt')
      : i18n.t('messagePrompt'),
);
const kekePrompt = i18n.t('kekePrompt');
const mainInput = ref<InstanceType<typeof InputArea> | null>(null);

const kekeInput = ref<InstanceType<typeof InputArea> | null>(null);

function onMention(nickname: string): void {
  mainInput.value?.appendMention(nickname);
}

function onKekeMention(nickname: string): void {
  kekeInput.value?.appendMention(nickname);
}
</script>

<template>
  <table v-if="props.anchor" cellspacing="0" cellpadding="0" class="SquareCssResource-chatRoom">
    <tbody>
      <tr>
        <td align="left" style="vertical-align: top">
          <AnchorBar
            :anchor="props.anchor.name"
            :anchor-href="props.anchor.href"
            @co-anchors="emit('coAnchors')"
          />
        </td>
      </tr>
      <tr>
        <td align="left" style="vertical-align: top">
          <div
            v-if="props.anchorable && props.forbidden"
            class="gwt-HTML SquareCssResource-forbiddenArea"
          >
            {{ i18n.t('forbidden') }}
          </div>
          <div v-else>
            <InputArea
              v-if="props.anchorable"
              ref="mainInput"
              room-type="ANCHOR_SQUARE"
              :prompt="prompt"
              :maxlength="LIMITS.contentClient"
              :quota-ok="props.quotaOk"
              :quota-text="props.quotaText"
              :nickname="props.nickname"
              :message="props.message"
              :nickname-disabled="props.nicknameDisabled"
              upload
              forbid
              :vote-forbid="false"
              :vote-min-kerma="false"
              @update:nickname="emit('update:nickname', $event)"
              @update:message="emit('update:message', $event)"
              @commit-nickname="emit('commitNickname', $event)"
              @send="emit('send')"
              @tool="(name, scope, rect) => emit('tool', name, scope, rect)"
            />
          </div>
        </td>
      </tr>
      <tr>
        <td align="left" style="vertical-align: top">
          <ResizeBox>
            <VerticalPanel :table-style="{ width: '100%' }">
              <ChatMessageRow
                v-for="(row, i) in props.rows"
                :key="i"
                :row="row"
                @mention="onMention"
              />
            </VerticalPanel>
          </ResizeBox>
        </td>
      </tr>
      <tr>
        <td align="left" style="vertical-align: top">
          <table cellspacing="0" cellpadding="0" class="SquareCssResource-kekeBar">
            <tbody>
              <tr>
                <td align="left" style="vertical-align: top">
                  <div v-if="props.forbidden" class="gwt-HTML SquareCssResource-forbiddenArea">
                    {{ i18n.t('forbidden') }}
                  </div>
                  <div v-else>
                    <InputArea
                      ref="kekeInput"
                      room-type="CHAT_FREEZE"
                      scope="keke"
                      :nickname="props.nickname"
                      @update:nickname="emit('update:nickname', $event)"
                      @commit-nickname="emit('commitNickname', $event)"
                      :prompt="kekePrompt"
                      :maxlength="LIMITS.contentClient"
                      :quota-ok="true"
                      quota-text=""
                      :message="props.kekeMessage"
                      :upload="false"
                      :vote-normal="false"
                      :vote-forbid="false"
                      :vote-min-kerma="false"
                      @update:message="emit('update:kekeMessage', $event)"
                      @send="emit('sendKeke')"
                      @tool="(name, scope, rect) => emit('tool', name, scope, rect)"
                    />
                  </div>
                </td>
              </tr>
              <tr>
                <td align="left" style="vertical-align: top">
                  <VerticalPanel :table-style="{ width: '100%' }">
                    <ChatMessageRow
                      v-for="(row, i) in props.kekeRows"
                      :key="i"
                      :row="row"
                      @mention="onKekeMention"
                    />
                  </VerticalPanel>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
  <table
    v-else
    cellspacing="0"
    cellpadding="0"
    :class="['SquareCssResource-chatRoom', keke ? 'SquareCssResource-kekeBar' : '']"
  >
    <tbody>
      <tr>
        <td align="left" style="vertical-align: top">
          <div v-if="props.forbidden" class="gwt-HTML SquareCssResource-forbiddenArea">
            {{ i18n.t('forbidden') }}
          </div>
          <InputArea
            v-else
            ref="mainInput"
            :room-type="props.roomType"
            :prompt="prompt"
            :maxlength="props.maxLength"
            :quota-ok="props.quotaOk"
            :quota-text="props.quotaText"
            :nickname="props.nickname"
            :message="props.message"
            :nickname-disabled="props.nicknameDisabled"
            :upload="!keke"
            :vote-normal="!keke"
            :vote-forbid="!keke"
            :vote-min-kerma="!keke"
            @update:nickname="emit('update:nickname', $event)"
            @update:message="emit('update:message', $event)"
            @commit-nickname="emit('commitNickname', $event)"
            @send="emit('send')"
            @tool="(name, scope, rect) => emit('tool', name, scope, rect)"
          />
        </td>
      </tr>
      <tr>
        <td align="left" style="vertical-align: top">
          <VerticalPanel :table-style="{ width: '100%' }">
            <ChatMessageRow
              v-for="(row, i) in props.rows"
              :key="i"
              :row="row"
              @mention="onMention"
            />
          </VerticalPanel>
        </td>
      </tr>
    </tbody>
  </table>
</template>
