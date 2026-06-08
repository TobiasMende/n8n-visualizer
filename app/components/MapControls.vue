<script setup lang="ts">
import { ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'

const props = defineProps<{ flowId: string; minimap: boolean }>()
const emit = defineEmits<{ 'update:minimap': [boolean] }>()

const { zoomIn, zoomOut, fitView, setInteractive } = useVueFlow(props.flowId)
const locked = ref(false)
function toggleLock() {
  locked.value = !locked.value
  setInteractive(!locked.value)
}
</script>

<template>
  <div class="ctrl">
    <button @click="zoomIn()"><span class="i">＋</span><span class="t">Zoom in</span></button>
    <button @click="zoomOut()"><span class="i">－</span><span class="t">Zoom out</span></button>
    <button @click="fitView({ padding: 0.2, duration: 300 })"><span class="i">⤢</span><span class="t">Fit view</span></button>
    <button :class="{ on: locked }" @click="toggleLock"><span class="i">{{ locked ? '🔒' : '🔓' }}</span><span class="t">{{ locked ? 'Locked' : 'Lock' }}</span></button>
    <button :class="{ on: minimap }" @click="emit('update:minimap', !minimap)"><span class="i">🗺</span><span class="t">Minimap</span></button>
  </div>
</template>

<style scoped>
.ctrl { position: absolute; left: 14px; bottom: 14px; z-index: 10; display: flex; flex-direction: column; gap: 4px;
  background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--radius-m); padding: 6px; box-shadow: var(--shadow-1); }
button { display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: var(--text-dim);
  font-size: 12px; padding: 6px 10px; border-radius: var(--radius-s); cursor: pointer; transition: all var(--dur) var(--ease); width: 100%; text-align: left; }
button:hover { background: var(--bg-3); color: var(--text); }
button.on { color: var(--accent); }
.i { width: 16px; text-align: center; }
</style>
