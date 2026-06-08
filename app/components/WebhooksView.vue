<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { webhookRows, callersOf } from '~/composables/useWebhookView'

const store = useGraphStore()
const filter = ref('')
const expanded = ref<string | null>(null)

const columns = [
  { key: 'method', label: 'Method' },
  { key: 'url', label: 'URL' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'active', label: 'State' },
]
const rows = computed(() => webhookRows(store.graph))

function jump(row: { workflowId: string }) { store.selectedId = row.workflowId; store.view = 'map' }
function copy(url: string) { if (import.meta.client) navigator.clipboard?.writeText(url) }
function toggle(id: string) { expanded.value = expanded.value === id ? null : id }
</script>

<template>
  <div class="wrap">
    <div class="bar"><input v-model="filter" class="search" placeholder="Filter webhooks…" /></div>
    <DataTable :columns="columns" :rows="rows" :filter="filter" @row-click="jump">
      <template #cell-method="{ row }"><Badge :tone="row.method === 'POST' ? 'accent' : 'warn'">{{ row.method }}</Badge></template>
      <template #cell-url="{ row }">
        <code class="url" @click.stop="copy(row.url)" :title="'Click to copy: ' + row.url">{{ row.url }}</code>
        <button class="callers" @click.stop="toggle(row.workflowId)">callers</button>
        <ul v-if="expanded === row.workflowId" class="callerlist">
          <li v-for="c in callersOf(store.graph, row.workflowId)" :key="c.id">↳ {{ c.name }}</li>
          <li v-if="!callersOf(store.graph, row.workflowId).length" class="none">no internal callers</li>
        </ul>
      </template>
      <template #cell-workflow="{ row }"><a class="wf" @click.stop="jump(row)">{{ row.workflow }}</a></template>
      <template #cell-active="{ row }"><span :class="row.active ? 'on' : 'off'">●</span></template>
    </DataTable>
    <EmptyState v-if="!rows.length" title="No webhooks" hint="No webhook triggers found in this instance." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.bar { margin-bottom: 10px; }
.search { width: 280px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
  border-radius: var(--radius-m); padding: 8px 10px; }
.url { font-family: var(--font-mono); color: var(--link); cursor: pointer; }
.callers { margin-left: 8px; font-size: 11px; background: none; border: 1px solid var(--border);
  color: var(--text-dim); border-radius: var(--radius-s); cursor: pointer; padding: 1px 6px; }
.callerlist { margin: 6px 0 0; padding-left: 14px; color: var(--text-dim); font-size: 12px; }
.callerlist .none { color: var(--text-faint); }
.wf { color: var(--accent); cursor: pointer; }
.on { color: var(--accent); } .off { color: var(--text-faint); }
</style>
