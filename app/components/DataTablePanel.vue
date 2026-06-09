<script setup lang="ts">
import { computed } from 'vue'
import type { DataTableRef } from '#shared/types/graph'
import { onActivate } from '~/composables/useA11yClick'
import { safeExternalHref } from '#shared/url'
import { useGraphStore } from '~/stores/graph'

const props = defineProps<{ dataTable: DataTableRef; workflows: { id: string; name: string }[] }>()
defineEmits<{ close: []; select: [id: string] }>()

const store = useGraphStore()
const deepLink = computed(() => {
  const base = store.connection?.baseUrl?.replace(/\/+$/, '')
  if (!base || !props.dataTable.projectId) return null
  return safeExternalHref(`${base}/projects/${props.dataTable.projectId}/datatables/${props.dataTable.id}`)
})
</script>

<template>
  <BasePanel @close="$emit('close')">
    <template #title><span class="ico" aria-hidden="true">🗄</span> {{ dataTable.name }}</template>
    <p class="meta">
      <span v-for="op in dataTable.operations" :key="op" class="badge">{{ op }}</span>
      <span v-if="!dataTable.workflowIds.length" class="badge unused">unused</span>
    </p>

    <a v-if="deepLink" class="deep-link" :href="deepLink" target="_blank" rel="noopener noreferrer">Open in n8n ↗</a>

    <section v-if="dataTable.columns?.length">
      <h3>Columns ({{ dataTable.columns.length }})</h3>
      <ul><li v-for="c in dataTable.columns" :key="c.name">{{ c.name }} <span class="muted">{{ c.type }}</span></li></ul>
    </section>

    <section>
      <h3>Used by ({{ workflows.length }})</h3>
      <ul>
        <li v-for="w in workflows" :key="w.id" class="link"
            role="button" tabindex="0"
            @click="$emit('select', w.id)"
            @keydown="onActivate(() => $emit('select', w.id))">↳ {{ w.name }}</li>
      </ul>
      <p v-if="!workflows.length" class="muted">No workflows.</p>
    </section>
  </BasePanel>
</template>

<style scoped>
.badge { display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 10px; background: var(--bg-3); font-size: 12px; }
.badge.unused { background: var(--accent-dim); color: var(--text-dim); }
.deep-link { display: inline-block; margin: 8px 0; font-weight: 600; }
section h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; color: var(--text-dim); }
.link { cursor: pointer; padding: 3px 4px; border-radius: var(--radius-s); color: var(--accent); }
.link:hover { background: var(--bg-3); }
.muted { color: var(--text-faint); font-size: 12px; }
</style>
