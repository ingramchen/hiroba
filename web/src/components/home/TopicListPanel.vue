<script setup lang="ts">
import NoOfCrowdBox from '../NoOfCrowdBox.vue';
import { VerticalPanel, GwtTable } from '../../gwt/panels';
import type { TopicRow } from '../../fixtures/types';

const props = withDefaults(
  defineProps<{ title: string; topics: TopicRow[]; rightPanel?: boolean }>(),
  { rightPanel: false },
);
</script>

<template>
  <table
    cellspacing="0"
    cellpadding="0"
    :class="['HomeCssResource-topics', props.rightPanel ? 'HomeCssResource-rightPanel' : '']"
  >
    <tbody>
      <tr>
        <td align="left" style="vertical-align: top">
          <div class="gwt-HTML HomeCssResource-title">{{ props.title }}</div>
        </td>
      </tr>
      <tr>
        <td align="left" style="vertical-align: top">
          <table cellspacing="0" cellpadding="0" style="width: 100%">
            <tbody>
              <tr v-for="topic in props.topics" :key="topic.topic">
                <td align="left" style="vertical-align: top">
                  <GwtTable
                    :columns="3"
                    :spacing="5"
                    :table-style="{ width: '100%' }"
                    :rows="[
                      [
                        { align: 'center', width: '10%', valign: 'top' },
                        { align: 'left', valign: 'top' },
                        { width: '15%' },
                      ],
                    ]"
                  >
                    <NoOfCrowdBox :crowd="topic.crowd" />
                    <VerticalPanel>
                      <div class="gwt-HTML HomeCssResource-topicLink GlobalCssResource-zhFont">
                        <a :title="topic.topic" :href="'/' + topic.topic">{{ topic.label }}</a>
                      </div>
                      <div
                        v-for="(m, i) in topic.messages"
                        :key="i"
                        class="gwt-HTML HomeCssResource-chatMessage"
                      >
                        » {{ m }}
                      </div>
                    </VerticalPanel>
                    <div>
                      <img
                        v-if="topic.thumb"
                        class="gwt-Image"
                        :src="topic.thumb.src"
                        :width="topic.thumb.width"
                        :height="topic.thumb.height"
                      />
                    </div>
                  </GwtTable>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</template>
