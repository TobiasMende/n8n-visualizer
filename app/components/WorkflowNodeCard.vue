<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { TriggerType } from '#shared/types/graph'

type Kind = 'workflow' | 'credential' | 'nodeType'
const props = defineProps<{
  data: { kind: Kind; label: string; triggers: TriggerType[]; inbound: number; dimmed: boolean }
}>()

const icons: Record<TriggerType, string> = { webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', unknown: '•' }
const kindIcon: Record<Kind, string> = { workflow: '', credential: '🔑', nodeType: '◆' }
const size = computed(() => 36 + Math.min(props.data.inbound, 12) * 6)
</script>

<template>
  <div class="node" :class="[`kind-${data.kind}`, { dimmed: data.dimmed }]" :style="{ minWidth: size + 'px' }">
    <Handle type="target" :position="Position.Left" />
    <span v-if="kindIcon[data.kind]" class="kindico">{{ kindIcon[data.kind] }}</span>
    <span v-for="t in data.triggers" :key="t" class="ico" :data-trigger="t">{{ icons[t] }}</span>
    <span class="label">{{ data.label }}</span>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.node { display: flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 13px;
  border: 1px solid var(--border); border-radius: var(--radius-m); background: var(--bg-3); color: var(--text);
  box-shadow: var(--shadow-1); transition: box-shadow var(--dur) var(--ease), opacity var(--dur) var(--ease); }
.node:hover { box-shadow: var(--shadow-glow); }
.node.dimmed { opacity: 0.22; }
.kind-credential { border-color: var(--warn); border-radius: 999px; }
.kind-nodeType { border-style: dashed; border-color: var(--link); }
.label { font-weight: 600; }
.kindico { opacity: .85; }
</style>
