<script setup lang="ts">
import type { AnchorRect } from '../gwt/relativePosition';
import StatusPanel from '../components/StatusPanel.vue';
import NoOfCrowdBox from '../components/NoOfCrowdBox.vue';
import Footer from '../components/Footer.vue';
import ChatRoomPanel from '../components/square/ChatRoomPanel.vue';
import StickyPosterPanel from '../components/square/StickyPosterPanel.vue';
import LightningVotePanel from '../components/square/LightningVotePanel.vue';
import MediaFlowPanel from '../components/square/MediaFlowPanel.vue';
import type { MediaItem } from '../components/square/MediaWidget.vue';
import { supportPosterIcon, type MediaMode } from '../live/medias';
import type { PosterDisplayMode } from '../poster/render';
import type { PosterView } from '../poster/poster';
import type { VotePanelView } from '../live/voteState';
import { HorizontalPanel, VerticalPanel } from '../gwt/panels';
import type { MenuEntry } from '../gwt/types';
import type { ChatRow } from '../fixtures/types';
import type { RoomType, ToolName } from '../components/square/InputArea.vue';
import { LIMITS } from '@hiroba/shared';

const props = withDefaults(
  defineProps<{
    topic?: string;
    host?: string;
    hostHref?: string;
    crowd?: number;
    rows?: ChatRow[];
    roomType?: RoomType;
    quotaOk?: boolean;
    quotaText?: string;
    medias?: MediaItem[];
    menuItems?: MenuEntry[];
    menuSelected?: number;
    eventSectionTop?: boolean;
    anchor?: { name: string; href: string } | null;
    anchorable?: boolean;
    kekeRows?: ChatRow[];
    kekeMessage?: string;
    nickname?: string;
    message?: string;
    forbidden?: boolean;
    voteVisible?: boolean;
    voteTitle?: string;
    voteCountdown?: string;
    posterVisible?: boolean;
    mediaMode?: MediaMode;
    poster?: PosterView | null;
    posterMode?: PosterDisplayMode;
    posterFade?: boolean;
    locale?: string;
    nicknameDisabled?: boolean;
    voteTitleRed?: boolean;
    voteEnded?: boolean;
    voteChartVisible?: boolean;
    votePanel?: VotePanelView | null;
    maxLength?: number;
  }>(),
  {
    topic: 'reference',
    host: 'localhost',
    hostHref: 'http://localhost:8080',
    crowd: 1,
    rows: () => [],
    roomType: 'FREE',
    quotaOk: true,
    quotaText: '',
    medias: () => [],
    menuItems: () => [],
    menuSelected: -1,
    eventSectionTop: false,
    anchor: null,
    anchorable: false,
    kekeRows: () => [],
    kekeMessage: '',
    nickname: '',
    message: '',
    forbidden: false,
    voteVisible: false,
    voteTitle: '',
    voteCountdown: '',
    posterVisible: false,
    mediaMode: 'SHOW',
    poster: null,
    posterMode: 'SMALL',
    posterFade: false,
    locale: 'zh-TW',
    nicknameDisabled: false,
    voteTitleRed: false,
    voteEnded: false,
    voteChartVisible: true,
    votePanel: null,
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
  menu: [index: number];
  mediaMode: [value: MediaMode];
  mediaRemove: [index: number];
  mediaEnlarge: [index: number, src: string];
  mediaPoster: [index: number];
  mediaVoteForbid: [index: number, anchor: AnchorRect];
  posterMode: [value: PosterDisplayMode];
  posterEnlarge: [src: string];
  voteChartVisible: [value: boolean];
  openBallot: [];
  forbidCreator: [anchor?: AnchorRect];
  about: [];
}>();
</script>

<template>
  <table cellspacing="0" cellpadding="0" class="SquareCssResource-dockPanel">
    <tbody>
      <tr>
        <td align="left" width="" height="" colspan="2" style="vertical-align: top">
          <StatusPanel
            :items="props.menuItems"
            :selected="props.menuSelected"
            square
            @select="emit('menu', $event)"
          />
        </td>
      </tr>
      <tr>
        <td align="left" width="" height="" colspan="2" style="vertical-align: top">
          <HorizontalPanel
            valign="middle"
            class="SquareCssResource-squareHeader GlobalCssResource-zhFont"
          >
            <NoOfCrowdBox :crowd="props.crowd" />
            <div class="gwt-HTML SquareCssResource-squareHeaderAddress">
              <a :href="props.hostHref">{{ props.host }}</a
              >/{{ props.topic }}
            </div>
          </HorizontalPanel>
        </td>
      </tr>
      <tr v-if="props.eventSectionTop">
        <td
          align="left"
          width=""
          height=""
          colspan="2"
          style="vertical-align: top"
          class="SquareCssResource-dockPanelEventSectionTop"
        >
          <StickyPosterPanel
            :visible="props.posterVisible"
            :poster="props.poster"
            :mode="props.posterMode"
            :fade="props.posterFade"
            :locale="props.locale"
            @mode="emit('posterMode', $event)"
            @enlarge="emit('posterEnlarge', $event)"
          />
        </td>
      </tr>
      <tr v-if="props.eventSectionTop">
        <td
          align="left"
          width=""
          height=""
          colspan="2"
          style="vertical-align: top"
          class="SquareCssResource-dockPanelEventSectionTop"
        >
          <LightningVotePanel
            :visible="props.voteVisible"
            :title="props.voteTitle"
            :countdown="props.voteCountdown"
            :title-red="props.voteTitleRed"
            :ended="props.voteEnded"
            :chart-visible="props.voteChartVisible"
            :panel="props.votePanel"
            @chart-visible="emit('voteChartVisible', $event)"
            @poster-enlarge="emit('posterEnlarge', $event)"
            @open-ballot="emit('openBallot')"
            @forbid-creator="emit('forbidCreator', $event)"
          />
        </td>
      </tr>
      <tr>
        <td
          align="left"
          width=""
          height=""
          style="vertical-align: top"
          class="SquareCssResource-dockPanelCenter"
        >
          <ChatRoomPanel
            :room-type="props.roomType"
            :max-length="props.maxLength"
            :rows="props.rows"
            :quota-ok="props.quotaOk"
            :quota-text="props.quotaText"
            :anchor="props.anchor"
            :anchorable="props.anchorable"
            :keke-rows="props.kekeRows"
            :keke-message="props.kekeMessage"
            :nickname="props.nickname"
            :message="props.message"
            :forbidden="props.forbidden"
            :nickname-disabled="props.nicknameDisabled"
            @update:nickname="emit('update:nickname', $event)"
            @update:message="emit('update:message', $event)"
            @update:keke-message="emit('update:kekeMessage', $event)"
            @commit-nickname="emit('commitNickname', $event)"
            @send="emit('send')"
            @send-keke="emit('sendKeke')"
            @tool="(name, scope, rect) => emit('tool', name, scope, rect)"
            @co-anchors="emit('coAnchors')"
          />
        </td>
        <td
          align="left"
          width=""
          height=""
          rowspan="1"
          style="vertical-align: top"
          class="SquareCssResource-dockPanelRight"
        >
          <VerticalPanel :table-style="{ width: '100%' }">
            <StickyPosterPanel
              v-if="!props.eventSectionTop"
              :visible="props.posterVisible"
              :poster="props.poster"
              :mode="props.posterMode"
              :fade="props.posterFade"
              :locale="props.locale"
              @mode="emit('posterMode', $event)"
              @enlarge="emit('posterEnlarge', $event)"
            />
            <LightningVotePanel
              v-if="!props.eventSectionTop"
              :visible="props.voteVisible"
              :title="props.voteTitle"
              :countdown="props.voteCountdown"
              :title-red="props.voteTitleRed"
              :ended="props.voteEnded"
              :chart-visible="props.voteChartVisible"
              :panel="props.votePanel"
              @chart-visible="emit('voteChartVisible', $event)"
              @poster-enlarge="emit('posterEnlarge', $event)"
              @open-ballot="emit('openBallot')"
              @forbid-creator="emit('forbidCreator', $event)"
            />
            <MediaFlowPanel
              :medias="props.medias"
              :interactive="props.roomType === 'FREE'"
              :poster-icon="supportPosterIcon(props.roomType, props.forbidden, props.anchorable)"
              :mode="props.mediaMode"
              @mode="emit('mediaMode', $event)"
              @remove="emit('mediaRemove', $event)"
              @enlarge="(index, src) => emit('mediaEnlarge', index, src)"
              @poster="emit('mediaPoster', $event)"
              @vote-forbid="(index, anchor) => emit('mediaVoteForbid', index, anchor)"
            />
          </VerticalPanel>
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
