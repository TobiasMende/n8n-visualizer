<script setup lang="ts">
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import type { Edge, Node } from '@vue-flow/core'
import { computeLayout } from '~/composables/useForceLayout'
import { matchesTags } from '~/composables/useTagFilter'
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

const nodes = computed<Node[]>(() => {
  const g = store.graph
  if (!g) return []
  const pos = positions.value
  return g.nodes.map(n => ({
    id: n.id,
    type: 'workflow',
    position: pos.get(n.id) ?? { x: 0, y: 0 },
    data: {
      label: n.name,
      triggers: n.triggers,
      inbound: n.summary.inbound,
      dimmed: !matchesTags(n, store.tagFilter),
    },
  }))
})

const edges = computed<Edge[]>(() => {
  const g = store.graph
  if (!g) return []
  return g.edges
    .filter(e => store.linkTypes[e.type])
    .map(e => ({
      id: `${e.source}|${e.target}|${e.type}`, source: e.source, target: e.target,
      animated: e.type === 'webhookHttp', style: edgeStyle[e.type],
    }))
})

function onNodeClick({ node }: { node: Node }) {
  store.selectedId = node.id
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
