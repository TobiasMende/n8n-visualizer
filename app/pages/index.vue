<script setup lang="ts">
import { onMounted } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { workflowLinks } from '~/composables/useWorkflowLinks'
const store = useGraphStore()

onMounted(() => { store.restoreConnection() })
</script>

<template>
  <AppShell>
    <template #topbar><Toolbar /></template>

    <ClientOnly>
      <WorkflowMap v-if="store.view === 'map' && store.graph" />
      <WebhooksView v-else-if="store.view === 'webhooks' && store.graph" />
      <SchedulesView v-else-if="store.view === 'schedules' && store.graph" />
      <CredentialsView v-else-if="store.view === 'credentials' && store.graph" />
    </ClientOnly>

    <EmptyState v-if="!store.graph && !store.loading"
      title="Connect an n8n instance or upload workflow JSON"
      hint="Use the bar above to load via API or drop a workflow export." />
    <EmptyState v-if="store.loading" title="Loading…" />

    <SidePanel v-if="store.selected && store.view === 'map'" :node="store.selected"
      :links="workflowLinks(store.graph, store.selected.id)"
      @close="store.selectedId = null" @select="store.selectedId = $event" />
  </AppShell>
</template>
