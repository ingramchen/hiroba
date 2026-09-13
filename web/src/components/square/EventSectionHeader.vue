<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title: string; options: { value: string; label: string }[]; selected?: string }>(),
  { selected: '' },
);
const emit = defineEmits<{ select: [value: string] }>();
</script>

<template>
  <div>
    <div class="gwt-HTML SquareCssResource-title GlobalCssResource-zhFont">{{ props.title }}</div>
    <select
      class="gwt-ListBox SquareCssResource-eventSectionModeSelector"
      :value="props.selected === '' ? (props.options[0]?.value ?? '') : props.selected"
      @change="emit('select', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="o in props.options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
</template>
