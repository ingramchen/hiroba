<script setup lang="ts">
defineProps<{ address: string }>();
</script>

<template>
  <div class="sys-banner sys-deployment-banner">
    Every chatter in this square reaches the site as the same address
    <span class="sys-mono">{{ address }}</span
    >, so no client address is getting through. An address ban here would hit everyone behind that
    hop. Put a proxy in front of the site that forwards the client address, and set the trusted hop
    count to match.
  </div>
</template>
