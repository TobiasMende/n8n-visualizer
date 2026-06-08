<script setup lang="ts">
import { computed, ref } from 'vue'

interface Column { key: string; label: string }
const props = defineProps<{ columns: Column[]; rows: Record<string, any>[]; filter?: string }>()
defineEmits<{ rowClick: [row: Record<string, any>] }>()

const sortKey = ref<string | null>(null)
const sortDir = ref<1 | -1>(1)

function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = (sortDir.value === 1 ? -1 : 1)
  else { sortKey.value = key; sortDir.value = 1 }
}

const view = computed(() => {
  const f = (props.filter ?? '').trim().toLowerCase()
  let r = props.rows
  if (f) r = r.filter(row => props.columns.some(c => String(row[c.key] ?? '').toLowerCase().includes(f)))
  if (sortKey.value) {
    const k = sortKey.value
    r = [...r].sort((a, b) => String(a[k] ?? '').localeCompare(String(b[k] ?? ''), undefined, { numeric: true }) * sortDir.value)
  }
  return r
})
</script>

<template>
  <table class="dt">
    <thead>
      <tr>
        <th v-for="c in columns" :key="c.key" @click="toggleSort(c.key)">
          {{ c.label }}<span v-if="sortKey === c.key">{{ sortDir === 1 ? ' ▲' : ' ▼' }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in view" :key="i" @click="$emit('rowClick', row)">
        <td v-for="c in columns" :key="c.key"><slot :name="`cell-${c.key}`" :row="row">{{ row[c.key] }}</slot></td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.dt { width: 100%; border-collapse: collapse; font-size: 13px; color: var(--text); }
thead th { text-align: left; padding: 8px 10px; background: var(--bg-2); color: var(--text-dim);
  font-size: 11px; text-transform: uppercase; letter-spacing: .04em; cursor: pointer; user-select: none;
  position: sticky; top: 0; }
tbody td { padding: 8px 10px; border-top: 1px solid var(--border-soft); }
tbody tr { cursor: pointer; transition: background var(--dur) var(--ease); }
tbody tr:hover { background: var(--bg-2); }
</style>
