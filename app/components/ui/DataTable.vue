<script setup lang="ts" generic="Row extends object">
import { computed, ref } from 'vue'
import { onActivate } from '~/composables/useA11yClick'

interface Column { key: string; label: string }
const props = defineProps<{ columns: Column[]; rows: Row[]; rowKey?: (row: Row) => string | number }>()
const emit = defineEmits<{ rowClick: [row: Row] }>()

const sortKey = ref<string | null>(null)
const sortDir = ref<1 | -1>(1)

function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = (sortDir.value === 1 ? -1 : 1)
  else { sortKey.value = key; sortDir.value = 1 }
}

function cell(row: Row, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

const view = computed(() => {
  if (sortKey.value) {
    const k = sortKey.value
    return [...props.rows].sort((a, b) => String(cell(a, k) ?? '').localeCompare(String(cell(b, k) ?? ''), undefined, { numeric: true }) * sortDir.value)
  }
  return props.rows
})
</script>

<template>
  <table class="dt">
    <thead>
      <tr>
        <th v-for="c in columns" :key="c.key"
            role="button" tabindex="0"
            :aria-sort="sortKey === c.key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'"
            @click="toggleSort(c.key)"
            @keydown="onActivate(() => toggleSort(c.key))">
          {{ c.label }}<span v-if="sortKey === c.key">{{ sortDir === 1 ? ' ▲' : ' ▼' }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in view" :key="rowKey ? rowKey(row) : i"
          role="button" tabindex="0"
          @click="emit('rowClick', row)"
          @keydown="onActivate(() => emit('rowClick', row))">
        <td v-for="c in columns" :key="c.key"><slot :name="`cell-${c.key}`" :row="row">{{ cell(row, c.key) }}</slot></td>
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
