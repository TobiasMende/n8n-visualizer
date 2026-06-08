<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, getBezierPath } from '@vue-flow/core'
import type { Position } from '@vue-flow/core'
import { edgeColor } from '~/composables/edgeColors'

const props = defineProps<{
  id: string
  sourceX: number
  sourceY: number
  sourcePosition: Position
  targetX: number
  targetY: number
  targetPosition: Position
  markerEnd?: string
  data?: Record<string, any>
}>()

const path = computed(() => getBezierPath({
  sourceX: props.sourceX, sourceY: props.sourceY, sourcePosition: props.sourcePosition,
  targetX: props.targetX, targetY: props.targetY, targetPosition: props.targetPosition,
}))
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
