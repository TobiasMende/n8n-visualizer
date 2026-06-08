<script setup lang="ts">
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import type { Edge, Node } from '@vue-flow/core'
import { computeLayout } from '~/composables/useForceLayout'
import { matchesTags } from '~/composables/useTagFilter'
import { overlayNodesAndEdges } from '~/composables/useMapLayers'
import { useGraphStore } from '~/stores/graph'

const store = useGraphStore()

const edgeStyle: Record<string, Record<string, any>> = {
  execute: { stroke: '#3b82f6' },
  webhookHttp: { stroke: '#10b981', strokeDasharray: '6 4' },
  error: { stroke: '#ef4444' },
}

const positions = computed(() =>
  store.graph ? computeLayout(store.graph) : new Map<string, { x: number; y: number }>()
)

const overlay = computed(() => store.graph
  ? overlayNodesAndEdges(store.graph, positions.value, store.layers, store.hiddenNodeTypes)
  : { nodes: [], edges: [] })

const nodes = computed<Node[]>(() => {
  const g = store.graph
  if (!g) return []
  const pos = positions.value
  const base: Node[] = g.nodes.map(n => ({
    id: n.id, type: 'workflow', position: pos.get(n.id) ?? { x: 0, y: 0 },
    data: { kind: 'workflow', label: n.name, triggers: n.triggers, inbound: n.summary.inbound, dimmed: !matchesTags(n, store.tagFilter) },
  }))
  const overlayNodes: Node[] = overlay.value.nodes.map(o => ({
    id: o.id, type: 'workflow', position: { x: o.x, y: o.y },
    data: { kind: o.kind, label: o.label, triggers: [], inbound: 0, dimmed: false },
  }))
  return [...base, ...overlayNodes]
})

const edges = computed<Edge[]>(() => {
  const g = store.graph
  if (!g) return []
  const baseEdges: Edge[] = g.edges.filter(e => store.linkTypes[e.type]).map(e => ({
    id: `${e.source}|${e.target}|${e.type}`, source: e.source, target: e.target,
    animated: e.type === 'webhookHttp', style: edgeStyle[e.type],
  }))
  const overlayEdges: Edge[] = overlay.value.edges.map(o => ({
    id: o.id, source: o.source, target: o.target,
    style: { stroke: o.kind === 'uses' ? '#ffb454' : '#6aa0ff', strokeDasharray: '4 4', opacity: 0.6 },
  }))
  return [...baseEdges, ...overlayEdges]
})

function onNodeClick({ node }: { node: Node }) {
  if (node.data?.kind === 'workflow') store.selectedId = node.id
}
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" fit-view-on-init @node-click="onNodeClick">
    <template #node-workflow="props">
      <WorkflowNodeCard :data="props.data" />
    </template>
    <Background />
    <Controls />
  </VueFlow>
</template>
