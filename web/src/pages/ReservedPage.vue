<script setup lang="ts">
import { onMounted } from 'vue';
import BlankPage from './BlankPage.vue';
import { clearLoading } from '../runtime';

onMounted(clearLoading);
</script>

<template><BlankPage /></template>
