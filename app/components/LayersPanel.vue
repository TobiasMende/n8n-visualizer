<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { allNodeTypes } from '~/composables/useMapLayers'
import type { TriggerKind } from '#shared/types/graph'

const store = useGraphStore()
const open = ref(false)

const triggerLabels: Record<TriggerKind, string> = {
  webhook: 'Webhook', schedule: 'Schedule', manual: 'Manual', app: 'App', form: 'Form',
}
const linkLabels: Record<string, string> = { execute: 'Execute', webhookHttp: 'Webhook → HTTP', error: 'Error' }
const types = computed(() => allNodeTypes(store.graph))

function typeVisible(t: string) { return !store.visibility.hiddenNodeTypes.includes(t) }
function toggleType(t: string) {
  const h = store.visibility.hiddenNodeTypes
  store.visibility.hiddenNodeTypes = h.includes(t) ? h.filter(x => x !== t) : [...h, t]
}
</script>

<template>
  <div class="layers">
    <IconButton :active="open" title="Layers" @click="open = !open">☰ Layers</IconButton>
    <div v-if="open" class="panel">
      <div class="grp">Triggers</div>
      <label v-for="(label, kind) in triggerLabels" :key="kind" class="item">
        <input type="checkbox" v-model="store.visibility.triggerKinds[kind]" /> {{ label }}
      </label>
      <label class="item"><input type="checkbox" v-model="store.visibility.hideErrorHandlers" /> Hide error handlers</label>

      <div class="grp">Edges</div>
      <label v-for="(label, t) in linkLabels" :key="t" class="item">
        <input type="checkbox" v-model="store.visibility.linkTypes[t]" /> {{ label }}
      </label>

      <div class="grp">Overlays</div>
      <label class="item"><input type="checkbox" v-model="store.visibility.overlays.credentials" /> Credentials</label>
      <label class="item"><input type="checkbox" v-model="store.visibility.overlays.nodeTypes" /> Node types</label>
      <div v-if="store.visibility.overlays.nodeTypes" class="sub">
        <label v-for="t in types" :key="t.type" class="item">
          <input type="checkbox" :checked="typeVisible(t.type)" @change="toggleType(t.type)" /> {{ t.displayName }}
        </label>
        <p v-if="!types.length" class="empty">No node types.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layers { position: relative; }
.panel { position: absolute; top: 100%; right: 0; margin-top: 6px; width: 250px; max-height: 70vh; overflow: auto;
  background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-m); box-shadow: var(--shadow-1);
  padding: 8px; z-index: 30; }
.grp { color: var(--text-dim); text-transform: uppercase; font-size: 10px; letter-spacing: .05em; margin: 8px 2px 4px; }
.grp:first-child { margin-top: 0; }
.item { display: flex; align-items: center; gap: 8px; padding: 3px 2px; font-size: 13px; color: var(--text); cursor: pointer; }
.sub { margin-left: 14px; border-left: 1px solid var(--border-soft); padding-left: 8px; }
.empty { color: var(--text-faint); font-size: 12px; }
</style>
