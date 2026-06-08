<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, getBezierPath, useVueFlow, Position } from '@vue-flow/core'
import { edgeColor } from '~/composables/edgeColors'
import { floatingEdgeParams } from '~/composables/useFloatingEdge'

const props = defineProps<{
  id: string
  source: string
  target: string
  sourceX: number
  sourceY: number
  sourcePosition: Position
  targetX: number
  targetY: number
  targetPosition: Position
  markerEnd?: string
  data?: Record<string, any>
}>()

const POS: Record<string, Position> = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left }

const { findNode } = useVueFlow()

const params = computed(() => {
  const s = findNode(props.source), t = findNode(props.target)
  if (s?.dimensions?.width && t?.dimensions?.width) {
    const p = floatingEdgeParams(
      { x: s.computedPosition.x, y: s.computedPosition.y, width: s.dimensions.width, height: s.dimensions.height },
      { x: t.computedPosition.x, y: t.computedPosition.y, width: t.dimensions.width, height: t.dimensions.height },
    )
    return { sourceX: p.sx, sourceY: p.sy, targetX: p.tx, targetY: p.ty, sourcePosition: POS[p.sourcePos], targetPosition: POS[p.targetPos] }
  }
  return { sourceX: props.sourceX, sourceY: props.sourceY, targetX: props.targetX, targetY: props.targetY, sourcePosition: props.sourcePosition, targetPosition: props.targetPosition }
})

const path = computed(() => getBezierPath(params.value))
const color = computed(() => edgeColor(props.data?.type))
const dimmed = computed(() => !!props.data?.dimmed)
const emphasized = computed(() => !!props.data?.emphasized)
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :class="['flowedge', { dimmed, emphasized }]"
    :style="{ stroke: color, strokeWidth: emphasized ? 3 : 2, opacity: dimmed ? 0.12 : 1 }"
  />
</template>

<style scoped>
@keyframes flowdash { to { stroke-dashoffset: -16; } }
.flowedge :deep(path) { stroke-dasharray: 4 6; animation: flowdash 0.7s linear infinite; }
.flowedge.dimmed :deep(path) { animation: none; }
@media (prefers-reduced-motion: reduce) { .flowedge :deep(path) { animation: none; } }
</style>
