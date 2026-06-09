<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { dataTableRows, dataTableWorkflows } from '~/composables/useDataTableView'
import { matchesQuery, tagsMatch } from '~/composables/useViewFilter'
import { workflowTagsMap } from '~/composables/useGraphLookup'
import { onActivate } from '~/composables/useA11yClick'

const store = useGraphStore()
const expanded = ref<string | null>(null)

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'operations', label: 'Operations' },
  { key: 'columnCount', label: 'Columns' },
  { key: 'workflowCount', label: 'Workflows' },
]

const tagsByWf = computed(() => workflowTagsMap(store.graph))
function tableTags(r: { workflowIds: string[] }) {
  return [...new Set(r.workflowIds.flatMap(id => tagsByWf.value.get(id) ?? []))]
}
const rows = computed(() => dataTableRows(store.graph).filter(r =>
  tagsMatch(tableTags(r), store.tagFilter) &&
  matchesQuery(`${r.name} ${r.operations.join(' ')}`, store.searchQuery)))

const showUploadHint = computed(() => !store.connected && rows.value.length > 0)

function toggle(id: string) { expanded.value = expanded.value === id ? null : id }
function jumpWorkflow(id: string) { store.goToMapNode({ focusId: id, workflowId: id }) }
function jumpDataTable(r: { id: string }) {
  const dtId = `datatable:${r.id}`
  store.goToMapNode({ focusId: dtId, dataTableId: dtId, ensure: 'dataTables' })
}
</script>

<template>
  <div class="wrap">
    <p v-if="showUploadHint" class="hint">Connect with an API token to see unused tables and column details.</p>
    <DataTable :columns="columns" :rows="rows" :row-key="(r) => r.id" @row-click="jumpDataTable">
      <template #cell-name="{ row }">
        <strong>{{ row.name }}</strong>
        <Badge v-if="row.unused" class="unused">unused</Badge>
        <button class="exp" @click.stop="toggle(row.id)">workflows</button>
        <ul v-if="expanded === row.id" class="wflist">
          <li v-for="w in dataTableWorkflows(store.graph, row.id)" :key="w.id"
              role="button" tabindex="0"
              @click.stop="jumpWorkflow(w.id)"
              @keydown.stop="onActivate(() => jumpWorkflow(w.id))">↳ {{ w.name }}</li>
        </ul>
      </template>
      <template #cell-operations="{ row }">
        <Badge v-for="op in row.operations" :key="op">{{ op }}</Badge>
        <span v-if="!row.operations.length" class="muted">—</span>
      </template>
      <template #cell-columnCount="{ row }">{{ row.columnCount || '—' }}</template>
      <template #cell-workflowCount="{ row }">{{ row.workflowCount }}</template>
    </DataTable>
    <EmptyState v-if="!rows.length" title="No data tables" hint="No data tables referenced by any workflow." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.hint { font-size: 12px; color: var(--text-dim); background: var(--bg-2); border: 1px solid var(--border);
  border-radius: var(--radius-s); padding: 6px 10px; margin: 0 0 10px; }
.unused { margin-left: 8px; background: var(--bg-3); color: var(--text-dim); }
.exp { margin-left: 8px; font-size: 11px; background: none; border: 1px solid var(--border);
  color: var(--text-dim); border-radius: var(--radius-s); cursor: pointer; padding: 1px 6px; }
.wflist { margin: 6px 0 0; padding-left: 14px; color: var(--accent); font-size: 12px; }
.wflist li { cursor: pointer; }
.muted { color: var(--text-faint); }
</style>
