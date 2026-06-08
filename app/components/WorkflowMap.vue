<script setup lang="ts">
import { computed, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import type { Edge, Node } from '@vue-flow/core'
import { computeLayeredLayout } from '~/composables/useLayeredLayout'
import { matchesTags } from '~/composables/useTagFilter'
import { overlayNodesAndEdges } from '~/composables/useMapLayers'
import { visibleGraph } from '~/composables/useVisibility'
import { useGraphStore } from '~/stores/graph'
import { traceFlow } from '~/composables/useTraceFlow'

const store = useGraphStore()

const FLOW_ID = 'main'
const { fitView } = useVueFlow(FLOW_ID)

const edgeStyle: Record<string, Record<string, any>> = {
  execute: { stroke: '#3b82f6' },
  webhookHttp: { stroke: '#10b981', strokeDasharray: '6 4' },
  error: { stroke: '#ef4444' },
}

const visible = computed(() => store.graph
  ? visibleGraph(store.graph, store.visibility)
  : { nodes: [], edges: [] })

const positions = computed(() => computeLayeredLayout(visible.value.nodes, visible.value.edges))

const overlay = computed(() => store.graph
  ? overlayNodesAndEdges(
      { ...store.graph, nodes: visible.value.nodes, edges: visible.value.edges },
      positions.value, store.visibility.overlays, store.visibility.hiddenNodeTypes)
  : { nodes: [], edges: [] })

const flow = computed(() => traceFlow(visible.value.nodes, visible.value.edges, store.selectedId))
const focused = computed(() => store.selectedId != null && flow.value.nodeIds.size > 0)

const nodes = computed<Node[]>(() => {
  const base: Node[] = visible.value.nodes.map(n => ({
    id: n.id, type: 'workflow', position: positions.value.get(n.id) ?? { x: 0, y: 0 },
    data: {
      kind: 'workflow', label: n.name, triggers: n.triggers,
      inbound: n.summary.inbound, outbound: n.summary.outbound, nodeCount: n.summary.nodeCount,
      dimmed: !matchesTags(n, store.tagFilter) || (focused.value && !flow.value.nodeIds.has(n.id)),
      selected: store.selectedId === n.id,
    },
  }))
  const overlayNodes: Node[] = overlay.value.nodes.map(o => ({
    id: o.id, type: 'workflow', position: { x: o.x, y: o.y },
    data: { kind: o.kind, label: o.label, triggers: [], inbound: 0, outbound: 0, nodeCount: 0, dimmed: focused.value, selected: false },
  }))
  return [...base, ...overlayNodes]
})

const edges = computed<Edge[]>(() => {
  const baseEdges: Edge[] = visible.value.edges.map(e => {
    const inFlow = !focused.value || flow.value.edgeIds.has(`${e.source}|${e.target}`)
    return {
      id: `${e.source}|${e.target}|${e.type}`, source: e.source, target: e.target,
      animated: e.type === 'webhookHttp',
      style: { ...edgeStyle[e.type], opacity: inFlow ? 1 : 0.12 },
    }
  })
  const overlayEdges: Edge[] = overlay.value.edges.map(o => ({
    id: o.id, source: o.source, target: o.target,
    style: { stroke: o.kind === 'uses' ? '#ffb454' : '#6aa0ff', strokeDasharray: '4 4', opacity: focused.value ? 0.05 : 0.6 },
  }))
  return [...baseEdges, ...overlayEdges]
})

function onNodeClick({ node }: { node: Node }) {
  if (node.data?.kind === 'workflow') store.selectedId = node.id
}

function onPaneClick() { store.selectedId = null }

watch(() => store.selectedId, (id) => {
  if (id && flow.value.nodeIds.size) {
    const ids = [...flow.value.nodeIds]
    try { fitView({ nodes: ids, padding: 0.3, duration: 400 }) }
    catch { fitView({ padding: 0.2 }) }
  }
})
</script>

<template>
  <VueFlow :id="FLOW_ID" :nodes="nodes" :edges="edges" fit-view-on-init @node-click="onNodeClick" @pane-click="onPaneClick">
    <template #node-workflow="props">
      <WorkflowNodeCard :data="props.data" />
    </template>
    <Background />
    <Controls />
  </VueFlow>
</template>
