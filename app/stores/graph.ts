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

  return { graph, loading, error, selectedId, selected, tagFilter, linkTypes, loadFromApi, loadFromUpload }
})
