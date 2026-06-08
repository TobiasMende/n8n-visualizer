<script setup lang="ts">
import { computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import type { Edge, Node } from '@vue-flow/core'
import { computeLayeredLayout } from '~/composables/useLayeredLayout'
import { matchesTags } from '~/composables/useTagFilter'
import { overlayNodesAndEdges } from '~/composables/useMapLayers'
import { visibleGraph } from '~/composables/useVisibility'
import { useGraphStore } from '~/stores/graph'

const store = useGraphStore()

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

const nodes = computed<Node[]>(() => {
  const base: Node[] = visible.value.nodes.map(n => ({
    id: n.id, type: 'workflow', position: positions.value.get(n.id) ?? { x: 0, y: 0 },
    data: { kind: 'workflow', label: n.name, triggers: n.triggers, inbound: n.summary.inbound, dimmed: !matchesTags(n, store.tagFilter) },
  }))
  const overlayNodes: Node[] = overlay.value.nodes.map(o => ({
    id: o.id, type: 'workflow', position: { x: o.x, y: o.y },
    data: { kind: o.kind, label: o.label, triggers: [], inbound: 0, dimmed: false },
  }))
  return [...base, ...overlayNodes]
})

const edges = computed<Edge[]>(() => {
  const baseEdges: Edge[] = visible.value.edges.map(e => ({
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
