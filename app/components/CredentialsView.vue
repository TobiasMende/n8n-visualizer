<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { credentialRows, credentialWorkflows } from '~/composables/useCredentialView'
import { matchesQuery, tagsMatch } from '~/composables/useViewFilter'
import { workflowTagsMap } from '~/composables/useGraphLookup'
import { onActivate } from '~/composables/useA11yClick'

const store = useGraphStore()
const expanded = ref<string | null>(null)

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'displayType', label: 'Type' },
  { key: 'workflowCount', label: 'Workflows' },
]

const tagsByWf = computed(() => workflowTagsMap(store.graph))
function credTags(r: { workflowIds: string[] }) {
  return [...new Set(r.workflowIds.flatMap(id => tagsByWf.value.get(id) ?? []))]
}
const rows = computed(() => credentialRows(store.graph).filter(r =>
  tagsMatch(credTags(r), store.tagFilter) &&
  matchesQuery(`${r.name} ${r.displayType}`, store.searchQuery)))

const showUploadHint = computed(() => store.connection === null && rows.value.length > 0)

function rowKey(r: { type: string; name: string; id: string | null }) { return `${r.type}:${r.name}:${r.id}` }
function toggle(key: string) { expanded.value = expanded.value === key ? null : key }
function jumpWorkflow(id: string) { store.goToMapNode({ focusId: id, workflowId: id }) }
function jumpCredential(r: { type: string; name: string; id: string | null }) {
  const credId = `cred:${r.type}:${r.id ?? r.name}`
  store.goToMapNode({ focusId: credId, credId, ensure: 'credentials' })
}
</script>

<template>
  <div class="wrap">
    <p v-if="showUploadHint" class="hint">Connect with an API token to see unused credentials.</p>
    <DataTable :columns="columns" :rows="rows" :row-key="(r) => r.type + ':' + r.name + ':' + r.id" @row-click="jumpCredential">
      <template #cell-name="{ row }">
        <strong>{{ row.name }}</strong>
        <Badge v-if="row.unused" class="unused">unused</Badge>
        <button class="exp" @click.stop="toggle(rowKey(row))">workflows</button>
        <ul v-if="expanded === rowKey(row)" class="wflist">
          <li v-for="w in credentialWorkflows(store.graph, row.id, row.type, row.name)" :key="w.id"
              role="button" tabindex="0"
              @click.stop="jumpWorkflow(w.id)"
              @keydown.stop="onActivate(() => jumpWorkflow(w.id))">↳ {{ w.name }}</li>
        </ul>
      </template>
      <template #cell-displayType="{ row }"><Badge>{{ row.displayType }}</Badge></template>
      <template #cell-workflowCount="{ row }">{{ row.workflowCount }}</template>
    </DataTable>
    <EmptyState v-if="!rows.length" title="No credentials" hint="No credentials referenced by any workflow." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.exp { margin-left: 8px; font-size: 11px; background: none; border: 1px solid var(--border);
  color: var(--text-dim); border-radius: var(--radius-s); cursor: pointer; padding: 1px 6px; }
.wflist { margin: 6px 0 0; padding-left: 14px; color: var(--accent); font-size: 12px; }
.wflist li { cursor: pointer; }
.hint { font-size: 12px; color: var(--text-dim); background: var(--bg-2); border: 1px solid var(--border);
  border-radius: var(--radius-s); padding: 6px 10px; margin: 0 0 10px; }
.unused { margin-left: 8px; background: var(--bg-3); color: var(--text-dim); }
</style>
