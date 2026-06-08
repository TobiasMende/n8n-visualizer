<script setup lang="ts">
defineProps<{ tone?: 'default' | 'accent' | 'warn' | 'danger' }>()
</script>
<template>
  <span class="badge" :class="tone ?? 'default'"><slot /></span>
</template>
<style scoped>
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;
  font-size: 12px; background: var(--bg-3); color: var(--text); border: 1px solid var(--border); }
.accent { background: var(--accent-dim); color: var(--accent); border-color: transparent; }
.warn { color: var(--warn); } .danger { color: var(--danger); }
</style>
