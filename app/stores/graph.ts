import type { WorkflowGraph } from '#shared/types/graph'
import { saveConnection, loadConnection, clearConnection, hostOf, type Conn } from '~/composables/useConnectionStorage'
import { defaultVisibility, type Visibility } from '~/composables/useVisibility'

export const useGraphStore = defineStore('graph', () => {
  const graph = ref<WorkflowGraph | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedId = ref<string | null>(null)
  const selectedCredId = ref<string | null>(null)
  const selectedDataTableId = ref<string | null>(null)
  const focusNodeId = ref<string | null>(null)
  const tagFilter = ref<string[]>([])
  const searchQuery = ref('')
  const connection = ref<Conn | null>(null)

  function extractError(e: any): string {
    return e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? 'Request failed'
  }

  async function loadFromApi(baseUrl: string, apiKey: string) {
    loading.value = true; error.value = null
    try {
      graph.value = await $fetch<WorkflowGraph>('/api/ingest/api', { method: 'POST', body: { baseUrl, apiKey } })
      connection.value = { baseUrl, apiKey }
      if (import.meta.client) saveConnection(sessionStorage, connection.value)
    } catch (e) { error.value = extractError(e) } finally { loading.value = false }
  }

  async function loadFromUpload(workflows: unknown, baseUrl: string | null) {
    loading.value = true; error.value = null
    try {
      graph.value = await $fetch<WorkflowGraph>('/api/ingest/upload', { method: 'POST', body: { workflows, baseUrl } })
    } catch (e) { error.value = extractError(e) } finally { loading.value = false }
  }

  function disconnect() {
    connection.value = null
    graph.value = null
    selectedId.value = null
    selectedCredId.value = null
    selectedDataTableId.value = null
    focusNodeId.value = null
    tagFilter.value = []
    searchQuery.value = ''
    error.value = null
    view.value = 'map'
    if (import.meta.client) clearConnection(sessionStorage)
  }

  async function restoreConnection() {
    if (!import.meta.client) return
    const c = loadConnection(sessionStorage)
    if (!c) return
    connection.value = c
    await loadFromApi(c.baseUrl, c.apiKey)
    if (error.value) { connection.value = null; clearConnection(sessionStorage) }
  }

  const connectedHost = computed(() => connection.value ? hostOf(connection.value.baseUrl) : null)

  const selected = computed(() => graph.value?.nodes.find(n => n.id === selectedId.value) ?? null)

  const selectedCredential = computed(() =>
    graph.value?.credentials.find(c => `cred:${c.type}:${c.id ?? c.name}` === selectedCredId.value) ?? null)

  const selectedDataTable = computed(() =>
    graph.value?.dataTables.find(d => `datatable:${d.id}` === selectedDataTableId.value) ?? null)

  type ViewId = 'map' | 'webhooks' | 'schedules' | 'credentials' | 'dataTables'
  const view = ref<ViewId>('map')
  const visibility = ref<Visibility>(defaultVisibility())

  function goToMapNode(opts: {
    focusId: string | null
    workflowId?: string | null
    credId?: string | null
    dataTableId?: string | null
    ensure?: 'credentials' | 'dataTables'
    ensureTrigger?: keyof Visibility['triggerKinds']
  }) {
    selectedId.value = opts.workflowId ?? null
    selectedCredId.value = opts.credId ?? null
    selectedDataTableId.value = opts.dataTableId ?? null
    if (opts.ensure) visibility.value.resources[opts.ensure] = true
    if (opts.ensureTrigger) visibility.value.triggerKinds[opts.ensureTrigger] = true
    focusNodeId.value = opts.focusId
    view.value = 'map'
  }

  if (import.meta.client) {
    const saved = localStorage.getItem('n8nviz.prefs')
    if (saved) {
      try {
        const p = JSON.parse(saved)
        if (p.view) view.value = p.view
        if (p.tagFilter) tagFilter.value = p.tagFilter
        if (p.visibility && typeof p.visibility === 'object') {
          const d = defaultVisibility()
          visibility.value = {
            triggerKinds: { ...d.triggerKinds, ...(p.visibility.triggerKinds ?? {}) },
            hideErrorHandlers: !!p.visibility.hideErrorHandlers,
            linkTypes: { ...d.linkTypes, ...(p.visibility.linkTypes ?? {}) },
            resources: { ...d.resources, ...(p.visibility.resources ?? {}) },
            overlays: { ...d.overlays, ...(p.visibility.overlays ?? {}) },
            hiddenNodeTypes: Array.isArray(p.visibility.hiddenNodeTypes) ? p.visibility.hiddenNodeTypes : [],
          }
        }
      } catch { /* ignore corrupt prefs */ }
    }
    watch([view, tagFilter, visibility], () => {
      localStorage.setItem('n8nviz.prefs', JSON.stringify({ view: view.value, tagFilter: tagFilter.value, visibility: visibility.value }))
    }, { deep: true })
  }

  return { graph, loading, error, selectedId, selected, selectedCredId, selectedCredential, selectedDataTableId, selectedDataTable, focusNodeId, tagFilter, searchQuery, loadFromApi, loadFromUpload, view, visibility, goToMapNode, connection, connectedHost, disconnect, restoreConnection }
})
