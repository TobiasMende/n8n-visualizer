<script setup lang="ts">
import { useVueFlow } from '@vue-flow/core'

const props = defineProps<{ flowId: string; minimap: boolean }>()
const emit = defineEmits<{ 'update:minimap': [boolean] }>()

const { zoomIn, zoomOut } = useVueFlow(props.flowId)
</script>

<template>
  <div class="ctrl">
    <button aria-label="Zoom in" @click="zoomIn()"><span class="i">＋</span><span class="t">Zoom in</span></button>
    <button aria-label="Zoom out" @click="zoomOut()"><span class="i">－</span><span class="t">Zoom out</span></button>
    <button :aria-label="minimap ? 'Hide minimap' : 'Show minimap'" :class="{ on: minimap }" @click="emit('update:minimap', !minimap)"><span class="i">🗺</span><span class="t">Minimap</span></button>
  </div>
</template>

<style scoped>
.ctrl { position: absolute; left: 14px; bottom: 14px; z-index: 10; display: flex; flex-direction: column; gap: 4px;
  background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--radius-m); padding: 6px; box-shadow: var(--shadow-1); }
button { display: flex; align-items: center; background: transparent; border: none; color: var(--text-dim);
  font-size: 12px; padding: 6px; border-radius: var(--radius-s); cursor: pointer; text-align: left;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease); }
button:hover { background: var(--bg-3); color: var(--text); }
button.on { color: var(--accent); }
.i { width: 16px; text-align: center; flex: none; }
.t { max-width: 0; overflow: hidden; white-space: nowrap; opacity: 0; box-sizing: border-box;
  transition: max-width var(--dur) var(--ease), opacity var(--dur) var(--ease), padding-left var(--dur) var(--ease); }
.ctrl:hover .t, .ctrl:focus-within .t { max-width: 90px; opacity: 1; padding-left: 8px; }
</style>
