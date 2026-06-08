<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { credentialRows, credentialWorkflows } from '~/composables/useCredentialView'

const store = useGraphStore()
const filter = ref('')
const expanded = ref<string | null>(null)

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'displayType', label: 'Type' },
  { key: 'workflowCount', label: 'Workflows' },
]
const rows = computed(() => credentialRows(store.graph))

function rowKey(r: { type: string; name: string; id: string | null }) { return `${r.type}:${r.name}:${r.id}` }
function toggle(key: string) { expanded.value = expanded.value === key ? null : key }
function jump(id: string) { store.selectedId = id; store.view = 'map' }
</script>

<template>
  <div class="wrap">
    <div class="bar"><input v-model="filter" class="search" placeholder="Filter credentials…" /></div>
    <DataTable :columns="columns" :rows="rows" :filter="filter">
      <template #cell-name="{ row }">
        <strong>{{ row.name }}</strong>
        <button class="exp" @click.stop="toggle(rowKey(row))">workflows</button>
        <ul v-if="expanded === rowKey(row)" class="wflist">
          <li v-for="w in credentialWorkflows(store.graph, row.id, row.type, row.name)" :key="w.id"
              @click.stop="jump(w.id)">↳ {{ w.name }}</li>
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
.bar { margin-bottom: 10px; }
.search { width: 280px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
  border-radius: var(--radius-m); padding: 8px 10px; }
.exp { margin-left: 8px; font-size: 11px; background: none; border: 1px solid var(--border);
  color: var(--text-dim); border-radius: var(--radius-s); cursor: pointer; padding: 1px 6px; }
.wflist { margin: 6px 0 0; padding-left: 14px; color: var(--accent); font-size: 12px; }
.wflist li { cursor: pointer; }
</style>
