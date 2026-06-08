<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { TriggerType } from '#shared/types/graph'

const props = defineProps<{
  data: { label: string; triggers: TriggerType[]; inbound: number; dimmed: boolean }
}>()

const icons: Record<TriggerType, string> = {
  webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', unknown: '•',
}
const size = computed(() => 36 + Math.min(props.data.inbound, 12) * 6)
</script>

<template>
  <div class="node" :class="{ dimmed: data.dimmed }"
       :style="{ minWidth: size + 'px' }">
    <Handle type="target" :position="Position.Left" />
    <span v-for="t in data.triggers" :key="t" class="ico" :data-trigger="t">{{ icons[t] }}</span>
    <span class="label">{{ data.label }}</span>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.node { display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  border: 1px solid #888; border-radius: 8px; background: #fff; font-size: 13px; }
.node.dimmed { opacity: 0.25; }
.label { font-weight: 600; }
</style>
