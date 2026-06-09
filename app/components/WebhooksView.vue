<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { webhookRows, callersOf } from '~/composables/useWebhookView'
import { matchesQuery, tagsMatch } from '~/composables/useViewFilter'
import { workflowTagsMap } from '~/composables/useGraphLookup'
import { onActivate } from '~/composables/useA11yClick'
import { triggerNodeId } from '~/composables/useTriggerFocus'

const store = useGraphStore()
const rowKey = (row: { workflowId: string; path: string }) => row.workflowId + '|' + row.path
const expanded = ref<string | null>(null)
const expandedCallers = computed(() =>
  expanded.value ? callersOf(store.graph, expanded.value.split('|')[0]!) : [])

const columns = [
  { key: 'method', label: 'Method' },
  { key: 'security', label: 'Security' },
  { key: 'url', label: 'URL' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'active', label: 'State' },
]

const tagsByWf = computed(() => workflowTagsMap(store.graph))
const rows = computed(() => webhookRows(store.graph).filter(r =>
  tagsMatch(tagsByWf.value.get(r.workflowId) ?? [], store.tagFilter) &&
  matchesQuery(`${r.method} ${r.url} ${r.workflow} ${r.path} ${r.secured ? 'secured' : 'unsecured open'} ${r.authLabel}`, store.searchQuery)))

const openCount = computed(() => rows.value.filter(r => !r.secured).length)

function jump(row: { workflowId: string; method: string; path: string }) {
  const trigId = triggerNodeId(store.graph, row.workflowId, 'webhook', `${row.method} /${row.path}`)
  store.goToMapNode({ focusId: trigId ?? row.workflowId, workflowId: row.workflowId, ensureTrigger: 'webhook' })
}
function jumpWorkflow(id: string) { store.goToMapNode({ focusId: id, workflowId: id }) }
function copy(url: string) { if (import.meta.client) navigator.clipboard?.writeText(url) }
function toggle(key: string) { expanded.value = expanded.value === key ? null : key }
</script>

<template>
  <div class="wrap">
    <p v-if="openCount" class="open-summary">{{ openCount }} of {{ rows.length }} webhooks open</p>
    <DataTable :columns="columns" :rows="rows" :row-key="rowKey" @row-click="jump">
      <template #cell-method="{ row }"><Badge :tone="row.method === 'POST' ? 'accent' : 'warn'">{{ row.method }}</Badge></template>
      <template #cell-security="{ row }">
        <Badge :tone="row.secured ? 'accent' : 'warn'" :title="row.secured ? row.authLabel : 'No authentication'">
          {{ row.secured ? '🔒 Secured' : '🔓 Open' }}
        </Badge>
      </template>
      <template #cell-url="{ row }">
        <code class="url" role="button" tabindex="0" aria-label="Copy URL"
          @click.stop="copy(row.url)" :title="'Click to copy: ' + row.url"
          @keydown.stop="onActivate(() => copy(row.url))">{{ row.url }}</code>
        <button class="callers" @click.stop="toggle(rowKey(row))">callers</button>
        <ul v-if="expanded === rowKey(row)" class="callerlist">
          <li v-for="c in expandedCallers" :key="c.id">↳ {{ c.name }}</li>
          <li v-if="!expandedCallers.length" class="none">no internal callers</li>
        </ul>
      </template>
      <template #cell-workflow="{ row }">
        <a class="wf" role="button" tabindex="0"
          @click.stop="jumpWorkflow(row.workflowId)"
          @keydown.stop="onActivate(() => jumpWorkflow(row.workflowId))">{{ row.workflow }}</a>
      </template>
      <template #cell-active="{ row }"><span :class="row.active ? 'on' : 'off'">●</span></template>
    </DataTable>
    <EmptyState v-if="!rows.length" title="No webhooks" hint="No webhook triggers found in this instance." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.open-summary { margin: 0 0 8px; color: var(--warn); font-size: 12px; }
.url { font-family: var(--font-mono); color: var(--link); cursor: pointer; }
.callers { margin-left: 8px; font-size: 11px; background: none; border: 1px solid var(--border);
  color: var(--text-dim); border-radius: var(--radius-s); cursor: pointer; padding: 1px 6px; }
.callerlist { margin: 6px 0 0; padding-left: 14px; color: var(--text-dim); font-size: 12px; }
.callerlist .none { color: var(--text-faint); }
.wf { color: var(--accent); cursor: pointer; }
.on { color: var(--accent); } .off { color: var(--text-faint); }
</style>
