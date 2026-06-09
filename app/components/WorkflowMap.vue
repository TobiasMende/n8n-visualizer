<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import type { Edge, Node } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/minimap/dist/style.css'
import { computeLayeredLayout } from '~/composables/useLayeredLayout'
import { tagScopedNodeIds } from '~/composables/useTagScope'
import { overlayNodesAndEdges } from '~/composables/useMapLayers'
import { visibleGraph } from '~/composables/useVisibility'
import { useGraphStore } from '~/stores/graph'
import { traceFlow } from '~/composables/useTraceFlow'
import { edgeColor } from '~/composables/edgeColors'
import { neighbors } from '~/composables/useNeighbors'

const store = useGraphStore()

const FLOW_ID = 'main'
const { fitView } = useVueFlow(FLOW_ID)

const showMinimap = ref(true)
function miniColor(node: Node) {
  return node.data?.kind === 'credential' ? '#ffb454'
    : node.data?.kind === 'nodeType' ? '#6aa0ff'
    : node.data?.kind === 'trigger' ? '#f5a623'
    : node.data?.kind === 'dataTable' ? '#b48cff'
    : '#3ddc97'
}

const visible = computed(() => store.graph
  ? visibleGraph(store.graph, store.visibility)
  : { nodes: [], edges: [], triggerNodes: [] })

// When a tag filter is active, restrict the graph to the connected cluster(s)
// the tag participates in (tagged workflows + everything reachable from them),
// removing unrelated nodes so the layout compacts instead of graying out.
const scoped = computed(() => {
  const keep = tagScopedNodeIds(visible.value.nodes, visible.value.edges, store.tagFilter)
  return {
    nodes: visible.value.nodes.filter(n => keep.has(n.id)),
    edges: visible.value.edges.filter(e => keep.has(e.source) && keep.has(e.target)),
    triggerNodes: (visible.value.triggerNodes ?? []).filter(t => keep.has(t.workflowId)),
  }
})

const triggerNodes = computed(() => scoped.value.triggerNodes)
const triggerEdges = computed(() =>
  triggerNodes.value.map(t => ({ source: t.id, target: t.workflowId })))

const positions = computed(() => computeLayeredLayout(
  [...scoped.value.nodes, ...triggerNodes.value],
  [...scoped.value.edges, ...triggerEdges.value],
))

const overlay = computed(() => store.graph
  ? overlayNodesAndEdges(
      { ...store.graph, nodes: scoped.value.nodes, edges: scoped.value.edges },
      positions.value, store.visibility.overlays, store.visibility.hiddenNodeTypes)
  : { nodes: [], edges: [] })

const flow = computed(() => traceFlow(scoped.value.nodes, scoped.value.edges, store.selectedId))
const focused = computed(() => store.selectedId != null && flow.value.nodeIds.size > 0)

const hoveredId = ref<string | null>(null)
const hover = computed(() => neighbors(scoped.value.edges, focused.value ? null : hoveredId.value))
const hovering = computed(() => !focused.value && hoveredId.value != null && hover.value.nodeIds.size > 0)

const nodes = computed<Node[]>(() => {
  const base: Node[] = scoped.value.nodes.map(n => ({
    id: n.id, type: 'workflow', position: positions.value.get(n.id) ?? { x: 0, y: 0 },
    data: {
      kind: 'workflow', label: n.name, triggers: n.triggers,
      inbound: n.summary.inbound, outbound: n.summary.outbound, nodeCount: n.summary.nodeCount,
      dimmed: focused.value && !flow.value.nodeIds.has(n.id),
      selected: store.selectedId === n.id,
      emphasized: hovering.value && hover.value.nodeIds.has(n.id),
    },
  }))
  const trigNodes: Node[] = triggerNodes.value.map(t => ({
    id: t.id, type: 'workflow', position: positions.value.get(t.id) ?? { x: 0, y: 0 },
    data: {
      kind: 'trigger', triggerKind: t.kind, label: t.label, triggers: [],
      workflowId: t.workflowId, inbound: 0, outbound: 0, nodeCount: 0,
      dimmed: focused.value && !flow.value.nodeIds.has(t.workflowId),
      selected: store.selectedId === t.workflowId,
    },
  }))
  const overlayNodes: Node[] = overlay.value.nodes.map(o => ({
    id: o.id, type: 'workflow', position: { x: o.x, y: o.y },
    data: { kind: o.kind, label: o.label, triggers: [], inbound: 0, outbound: 0, nodeCount: 0, dimmed: focused.value, selected: o.id === store.selectedCredId || o.id === store.selectedDataTableId },
  }))
  return [...base, ...trigNodes, ...overlayNodes]
})

const edges = computed<Edge[]>(() => {
  const baseEdges: Edge[] = scoped.value.edges.map(e => {
    const inFlow = !focused.value || flow.value.edgeIds.has(`${e.source}|${e.target}`)
    return {
      id: `${e.source}|${e.target}|${e.type}`, source: e.source, target: e.target, type: 'flow',
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(e.type) },
      data: { type: e.type, dimmed: !inFlow, emphasized: hovering.value && hover.value.edgeIds.has(`${e.source}|${e.target}`) },
    }
  })
  const trigEdges: Edge[] = triggerNodes.value.map(t => ({
    id: `trig-edge:${t.id}`, source: t.id, target: t.workflowId, type: 'flow',
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor('trigger') },
    data: { type: 'trigger', dimmed: focused.value && !flow.value.nodeIds.has(t.workflowId), emphasized: false },
  }))
  const overlayEdges: Edge[] = overlay.value.edges.map(o => ({
    id: o.id, source: o.source, target: o.target,
    style: { stroke: o.id.includes(':datatable:') ? '#b48cff' : o.kind === 'uses' ? '#ffb454' : '#6aa0ff', strokeDasharray: '4 4', opacity: focused.value ? 0.05 : 0.6 },
  }))
  return [...baseEdges, ...trigEdges, ...overlayEdges]
})

function onNodeClick({ node }: { node: Node }) {
  if (node.data?.kind === 'workflow') { store.selectedId = node.id; store.selectedCredId = null; store.selectedDataTableId = null }
  else if (node.data?.kind === 'trigger') { store.selectedId = node.data.workflowId; store.selectedCredId = null; store.selectedDataTableId = null }
  else if (node.data?.kind === 'credential') { store.selectedCredId = node.id; store.selectedId = null; store.selectedDataTableId = null }
  else if (node.data?.kind === 'dataTable') { store.selectedDataTableId = node.id; store.selectedId = null; store.selectedCredId = null }
}

function onPaneClick() { store.selectedId = null; store.selectedCredId = null; store.selectedDataTableId = null }

function onNodeEnter({ node }: { node: Node }) { if (node.data?.kind === 'workflow') hoveredId.value = node.id }
function onNodeLeave() { hoveredId.value = null }

function focusSelected() {
  if (store.selectedId && flow.value.nodeIds.size) {
    const ids = [...flow.value.nodeIds]
    try { fitView({ nodes: ids, padding: 0.3, duration: 400 }) } catch { fitView({ padding: 0.2 }) }
  }
}

watch(() => store.selectedId, () => focusSelected())
onMounted(() => nextTick(() => focusSelected()))

watch(() => scoped.value.nodes, (nodes) => {
  if (store.selectedId && !nodes.some(n => n.id === store.selectedId)) store.selectedId = null
})
</script>

<template>
  <VueFlow :id="FLOW_ID" :nodes="nodes" :edges="edges" fit-view-on-init @node-click="onNodeClick" @pane-click="onPaneClick" @nodeMouseEnter="onNodeEnter" @nodeMouseLeave="onNodeLeave">
    <template #node-workflow="props">
      <WorkflowNodeCard :data="props.data" />
    </template>
    <template #edge-flow="props">
      <FlowEdge v-bind="props" />
    </template>
    <Background :variant="BackgroundVariant.Dots" :gap="22" :size="1.2" pattern-color="#1c2640" />
    <MiniMap v-if="showMinimap" pannable zoomable :node-color="miniColor" mask-color="rgba(11,15,26,0.7)" />
    <MapControls :flow-id="FLOW_ID" v-model:minimap="showMinimap" />
  </VueFlow>
</template>
