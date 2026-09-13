<script setup lang="ts">
import { barWidth, type VoteChartRow } from './voteChart';

const props = defineProps<{
  rows: readonly VoteChartRow[];
  total: number;
  optionHeader: string;
  countHeader: string;
}>();
</script>

<template>
  <div class="google-visualization-table">
    <table cellspacing="0" class="google-visualization-table-table">
      <thead>
        <tr>
          <th>{{ props.optionHeader }}</th>
          <th>{{ props.countHeader }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in props.rows"
          :key="row.option"
          :class="
            index % 2 === 0
              ? 'google-visualization-table-tr-even'
              : 'google-visualization-table-tr-odd'
          "
        >
          <td>{{ row.option }}</td>
          <td>
            <span
              style="
                display: inline-block;
                width: 60%;
                height: 12px;
                vertical-align: middle;
                background-color: #ccc;
              "
            >
              <span
                style="display: block; height: 12px; background-color: #3366cc"
                :style="{ width: barWidth(row.count, props.total) }"
              ></span>
            </span>
            <span style="padding-left: 5px">{{ row.count }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
