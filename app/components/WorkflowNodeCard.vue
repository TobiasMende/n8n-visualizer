<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { TriggerType } from '#shared/types/graph'

type Kind = 'workflow' | 'credential' | 'nodeType'
const props = defineProps<{
  data: {
    kind: Kind; label: string; triggers: TriggerType[]
    inbound: number; outbound?: number; nodeCount?: number
    dimmed: boolean; selected?: boolean; emphasized?: boolean
  }
}>()

const icons: Record<TriggerType, string> = { webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', unknown: '•' }
const kindIcon: Record<Kind, string> = { workflow: '🗂', credential: '🔑', nodeType: '◆' }
const accent: Record<string, string> = {
  webhook: 'var(--accent)', schedule: 'var(--link)', app: '#b794f6', manual: 'var(--text-dim)', none: 'var(--text-faint)',
}
const PRIORITY: TriggerType[] = ['webhook', 'schedule', 'app', 'manual']
const entryKind = computed(() => PRIORITY.find(k => props.data.triggers.includes(k)) ?? 'none')
const accentColor = computed(() =>
  props.data.kind === 'credential' ? 'var(--warn)'
  : props.data.kind === 'nodeType' ? 'var(--link)'
  : accent[entryKind.value])
const headIcon = computed(() =>
  props.data.kind === 'workflow' ? '🗂' : kindIcon[props.data.kind])
</script>

<template>
  <div class="node" :class="[`kind-${data.kind}`, { dimmed: data.dimmed, selected: data.selected, emphasized: data.emphasized }]">
    <Handle type="target" :position="Position.Left" />
    <div class="accent" :style="{ background: accentColor }" />
    <div class="head">
      <span class="ico">{{ headIcon }}</span>
      <span class="label">{{ data.label }}</span>
      <span v-if="data.kind === 'workflow' && entryKind !== 'none'" class="trig" :data-trigger="entryKind"
        :style="{ background: accentColor }" :title="entryKind">{{ icons[entryKind] }}</span>
    </div>
    <div v-if="data.kind === 'workflow'" class="meta">
      <span v-if="data.nodeCount" class="chip">{{ data.nodeCount }} nodes</span>
      <span v-if="data.outbound" class="chip">→ {{ data.outbound }}</span>
      <span v-if="data.inbound" class="chip">← {{ data.inbound }}</span>
    </div>
    <div class="tip">
      <span v-for="t in data.triggers" :key="t" :data-trigger="t">{{ icons[t] }} {{ t }}</span>
      <span v-if="data.nodeCount != null">{{ data.nodeCount }} nodes · ←{{ data.inbound }} →{{ data.outbound ?? 0 }}</span>
    </div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.node { position: relative; min-width: 150px; max-width: 230px; padding: 0; overflow: visible;
  border: 1px solid var(--border); border-radius: var(--radius-m); background: var(--bg-2); color: var(--text);
  box-shadow: var(--shadow-1); transition: box-shadow var(--dur) var(--ease), opacity var(--dur) var(--ease), transform var(--dur) var(--ease); }
.node:hover { transform: translateY(-1px); box-shadow: var(--shadow-glow); }
.node.emphasized { box-shadow: var(--shadow-glow); }
.node.selected { border-color: var(--accent); box-shadow: var(--shadow-glow); }
.node.dimmed { opacity: 0.22; }
.accent { height: 4px; border-radius: var(--radius-m) var(--radius-m) 0 0; }
.head { display: flex; align-items: center; gap: 7px; padding: 8px 10px 4px; }
.ico { font-size: 13px; }
.label { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { display: flex; gap: 5px; padding: 0 10px 8px; }
.chip { background: var(--bg-3); color: var(--text-dim); font-size: 10.5px; border-radius: 5px; padding: 1px 6px; }
.kind-credential { border-color: var(--warn); }
.kind-credential .accent { display: none; }
.kind-nodeType { border-style: dashed; border-color: var(--link); }
.kind-nodeType .accent { display: none; }
.kind-credential .head, .kind-nodeType .head { padding: 8px 12px; }
.tip { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%);
  display: none; flex-direction: column; gap: 2px; white-space: nowrap;
  background: var(--bg-0); border: 1px solid var(--border); border-radius: var(--radius-s); box-shadow: var(--shadow-1);
  padding: 6px 8px; font-size: 11px; color: var(--text-dim); z-index: 50; pointer-events: none; }
.node:hover .tip { display: flex; }
:deep(.vue-flow__handle) { opacity: 0; width: 1px; height: 1px; min-width: 0; min-height: 0; border: none; }
.trig { margin-left: auto; font-size: 11px; line-height: 1; padding: 2px 5px; border-radius: 6px;
  filter: saturate(1.2); }
</style>
