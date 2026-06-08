<script setup lang="ts">
import { computed } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { allNodeTypes } from '~/composables/useMapLayers'

const store = useGraphStore()
const types = computed(() => allNodeTypes(store.graph))

function visible(type: string) { return !store.hiddenNodeTypes.includes(type) }
function toggle(type: string) {
  store.hiddenNodeTypes = visible(type)
    ? [...store.hiddenNodeTypes, type]
    : store.hiddenNodeTypes.filter(t => t !== type)
}
function showAll() { store.hiddenNodeTypes = [] }
function hideAll() { store.hiddenNodeTypes = types.value.map(t => t.type) }
</script>

<template>
  <div class="panel">
    <div class="head">
      <span>Node types</span>
      <span class="acts"><button @click="showAll">all</button><button @click="hideAll">none</button></span>
    </div>
    <label v-for="t in types" :key="t.type" class="item">
      <input type="checkbox" :checked="visible(t.type)" @change="toggle(t.type)" />
      <span>{{ t.displayName }}</span>
    </label>
    <p v-if="!types.length" class="empty">No node types in graph.</p>
  </div>
</template>

<style scoped>
.panel { position: absolute; top: 100%; right: 0; margin-top: 6px; width: 240px; max-height: 320px; overflow: auto;
  background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-m); box-shadow: var(--shadow-1);
  padding: 8px; z-index: 20; }
.head { display: flex; justify-content: space-between; align-items: center; color: var(--text-dim);
  font-size: 11px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
.acts button { background: none; border: 1px solid var(--border); color: var(--text-dim); border-radius: var(--radius-s);
  font-size: 10px; padding: 1px 6px; margin-left: 4px; cursor: pointer; }
.item { display: flex; align-items: center; gap: 8px; padding: 3px 2px; font-size: 13px; color: var(--text); cursor: pointer; }
.empty { color: var(--text-faint); font-size: 12px; }
</style>
