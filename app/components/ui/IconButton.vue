<script setup lang="ts">
defineProps<{ active?: boolean; title?: string }>()
</script>
<template>
  <button class="ib" :class="{ active }" :title="title"><slot /></button>
</template>
<style scoped>
.ib { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--bg-2); color: var(--text-dim); border: 1px solid var(--border);
  border-radius: var(--radius-m); padding: 8px 10px; cursor: pointer; transition: all var(--dur) var(--ease); }
.ib:hover { color: var(--text); border-color: var(--accent-dim); }
.ib.active { color: var(--accent); border-color: var(--accent); box-shadow: var(--shadow-glow); }
</style>
