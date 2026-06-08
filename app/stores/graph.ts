import type { WorkflowGraph } from '#shared/types/graph'

export const useGraphStore = defineStore('graph', () => {
  const graph = ref<WorkflowGraph | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedId = ref<string | null>(null)
  const tagFilter = ref<string[]>([])
  const linkTypes = ref<Record<string, boolean>>({ execute: true, webhookHttp: true, error: true })

  function extractError(e: any): string {
    return e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? 'Request failed'
  }

  async function loadFromApi(baseUrl: string, apiKey: string) {
    loading.value = true; error.value = null
    try {
      graph.value = await $fetch<WorkflowGraph>('/api/ingest/api', { method: 'POST', body: { baseUrl, apiKey } })
    } catch (e) { error.value = extractError(e) } finally { loading.value = false }
  }

  async function loadFromUpload(workflows: unknown, baseUrl: string | null) {
    loading.value = true; error.value = null
    try {
      graph.value = await $fetch<WorkflowGraph>('/api/ingest/upload', { method: 'POST', body: { workflows, baseUrl } })
    } catch (e) { error.value = extractError(e) } finally { loading.value = false }
  }

  const selected = computed(() => graph.value?.nodes.find(n => n.id === selectedId.value) ?? null)

  type ViewId = 'map' | 'webhooks' | 'schedules' | 'credentials'
  const view = ref<ViewId>('map')
  const layers = ref<{ credentials: boolean; nodeTypes: boolean }>({ credentials: false, nodeTypes: false })

  if (import.meta.client) {
    const saved = localStorage.getItem('n8nviz.prefs')
    if (saved) {
      try {
        const p = JSON.parse(saved)
        if (p.view) view.value = p.view
        if (p.layers) layers.value = p.layers
        if (p.linkTypes) linkTypes.value = p.linkTypes
        if (p.tagFilter) tagFilter.value = p.tagFilter
      } catch { /* ignore corrupt prefs */ }
    }
    watch([view, layers, linkTypes, tagFilter], () => {
      localStorage.setItem('n8nviz.prefs', JSON.stringify({
        view: view.value, layers: layers.value, linkTypes: linkTypes.value, tagFilter: tagFilter.value,
      }))
    }, { deep: true })
  }

  return { graph, loading, error, selectedId, selected, tagFilter, linkTypes, loadFromApi, loadFromUpload, view, layers }
})
