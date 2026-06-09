<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { TriggerType, TriggerKind } from '#shared/types/graph'

type Kind = 'workflow' | 'credential' | 'nodeType' | 'trigger' | 'dataTable'
const props = defineProps<{
  data: {
    kind: Kind; label: string; triggers: TriggerType[]; triggerKind?: TriggerKind
    inbound: number; outbound?: number; nodeCount?: number
    dimmed: boolean; selected?: boolean; emphasized?: boolean; secured?: boolean
  }
}>()

const triggerIcons: Record<string, string> = { webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', form: '📝' }
const kindIcon: Record<Kind, string> = { workflow: '🗂', credential: '🔑', nodeType: '◆', trigger: '⚡', dataTable: '🗄' }
const accentColor = computed(() =>
  props.data.kind === 'credential' ? 'var(--warn)'
  : props.data.kind === 'nodeType' ? 'var(--link)'
  : props.data.kind === 'trigger' ? '#f5a623'
  : props.data.kind === 'dataTable' ? '#b48cff'
  : 'var(--accent)')
const showUnsecured = computed(() =>
  props.data.kind === 'trigger'
  && (props.data.triggerKind === 'webhook' || props.data.triggerKind === 'form')
  && props.data.secured === false)
const headIcon = computed(() =>
  props.data.kind === 'trigger' ? (triggerIcons[props.data.triggerKind ?? ''] ?? '⚡')
  : props.data.kind === 'workflow' ? '🗂'
  : kindIcon[props.data.kind])
</script>

<template>
  <div class="node" :class="[`kind-${data.kind}`, { dimmed: data.dimmed, selected: data.selected, emphasized: data.emphasized }]">
    <span v-if="showUnsecured" class="unsecured" title="Unsecured webhook — no authentication" aria-label="Unsecured webhook">🔓</span>
    <Handle type="target" :position="Position.Left" />
    <div class="accent" :style="{ background: accentColor }" />
    <div class="head">
      <span class="ico" aria-hidden="true">{{ headIcon }}</span>
      <span class="label">{{ data.label }}</span>
    </div>
    <div v-if="data.kind === 'workflow'" class="meta">
      <span v-if="data.nodeCount" class="chip">{{ data.nodeCount }} nodes</span>
      <span v-if="data.outbound" class="chip">→ {{ data.outbound }}</span>
      <span v-if="data.inbound" class="chip">← {{ data.inbound }}</span>
    </div>
    <div v-if="data.kind === 'workflow'" class="tip">
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
.kind-dataTable { border-color: #b48cff; }
.kind-dataTable .accent { display: none; }
.kind-dataTable .head { padding: 8px 12px; }
.kind-trigger { border-color: #f5a623; min-width: 0; }
.kind-trigger .head { padding: 6px 10px; }
.kind-trigger .label { font-size: 12px; }
.tip { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%);
  display: none; flex-direction: column; gap: 2px; white-space: nowrap;
  background: var(--bg-0); border: 1px solid var(--border); border-radius: var(--radius-s); box-shadow: var(--shadow-1);
  padding: 6px 8px; font-size: 11px; color: var(--text-dim); z-index: 50; pointer-events: none; }
.node:hover .tip { display: flex; }
.unsecured { position: absolute; top: -8px; right: -8px; z-index: 2; font-size: 13px;
  background: var(--bg-0); border: 1px solid var(--warn); border-radius: 999px; padding: 0 3px; line-height: 1.4; }
:deep(.vue-flow__handle) { opacity: 0; width: 1px; height: 1px; min-width: 0; min-height: 0; border: none; }
</style>
