<script setup lang="ts">
import { onMounted } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { workflowLinks } from '~/composables/useWorkflowLinks'
import { workflowResources } from '~/composables/useWorkflowResources'
import { credentialWorkflows } from '~/composables/useCredentialView'
import { dataTableWorkflows } from '~/composables/useDataTableView'
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
      <DataTablesView v-else-if="store.view === 'dataTables' && store.graph" />
    </ClientOnly>

    <EmptyState v-if="!store.graph && !store.loading"
      title="Connect an n8n instance or upload workflow JSON"
      hint="Use the bar above to load via API or drop a workflow export." />
    <EmptyState v-if="store.loading" title="Loading…" />

    <SidePanel v-if="store.selected && store.view === 'map'" :node="store.selected"
      :links="workflowLinks(store.graph, store.selected.id)"
      :resources="workflowResources(store.graph, store.selected.id)"
      @close="store.selectedId = null" @select="(id) => store.goToMapNode({ focusId: id, workflowId: id })"
      @select-cred="(id) => store.goToMapNode({ focusId: id, credId: id, ensure: 'credentials' })"
      @select-data-table="(id) => store.goToMapNode({ focusId: id, dataTableId: id, ensure: 'dataTables' })"
      @select-trigger="(id) => { store.focusNodeId = id }" />
    <CredentialPanel v-if="store.selectedCredential && store.view === 'map'"
      :credential="store.selectedCredential"
      :workflows="credentialWorkflows(store.graph, store.selectedCredential.id, store.selectedCredential.type, store.selectedCredential.name)"
      @close="store.selectedCredId = null"
      @select="(id) => store.goToMapNode({ focusId: id, workflowId: id })" />
    <DataTablePanel v-if="store.selectedDataTable && store.view === 'map'"
      :data-table="store.selectedDataTable"
      :workflows="dataTableWorkflows(store.graph, store.selectedDataTable.id)"
      @close="store.selectedDataTableId = null"
      @select="(id) => store.goToMapNode({ focusId: id, workflowId: id })" />
  </AppShell>
</template>
