<script setup lang="ts">
defineProps<{ title: string }>()
defineEmits<{ close: [] }>()
</script>
<template>
  <aside class="panel">
    <header>
      <h2><slot name="title">{{ title }}</slot></h2>
      <button class="close" aria-label="Close panel" @click="$emit('close')">×</button>
    </header>
    <slot />
  </aside>
</template>
<style scoped>
.panel { position: absolute; top: 0; right: 0; width: 320px; height: 100%; overflow-y: auto;
  background: var(--bg-2); border-left: 1px solid var(--border); color: var(--text); padding: 16px; box-shadow: -2px 0 8px rgba(0,0,0,.3); }
header { display: flex; justify-content: space-between; align-items: center; }
h2 { font-size: 16px; display: flex; align-items: center; gap: 7px; margin: 0; }
.close { background: none; border: none; color: var(--text-dim); font-size: 18px; cursor: pointer; }
</style>
