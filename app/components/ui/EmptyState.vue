<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>
<template>
  <div class="empty">
    <h3>{{ title }}</h3>
    <p v-if="hint">{{ hint }}</p>
  </div>
</template>
<style scoped>
.empty { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 6px;
  align-items: center; justify-content: center; color: var(--text-faint); text-align: center; }
.empty h3 { color: var(--text-dim); margin: 0; font-weight: 600; }
.empty p { margin: 0; font-size: 13px; }
</style>
