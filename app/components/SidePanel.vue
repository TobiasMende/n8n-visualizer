<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowNode } from '#shared/types/graph'
import type { LinkItem } from '~/composables/useWorkflowLinks'
import { onActivate } from '~/composables/useA11yClick'
import { safeExternalHref } from '#shared/url'
import BasePanel from './BasePanel.vue'

const props = withDefaults(defineProps<{ node: WorkflowNode; links?: { inbound: LinkItem[]; outbound: LinkItem[] } }>(), {
  links: () => ({ inbound: [], outbound: [] }),
})
defineEmits<{ close: []; select: [id: string] }>()

const safeDeepLink = computed(() => safeExternalHref(props.node.deepLink))
</script>

<template>
  <BasePanel :title="node.name" @close="$emit('close')">
    <p class="meta">
      <span :class="['badge', node.active ? 'on' : 'off']">{{ node.active ? 'active' : 'inactive' }}</span>
      <span v-for="t in node.triggers" :key="t" class="badge">{{ t }}</span>
    </p>

    <a v-if="safeDeepLink" class="deep-link" :href="safeDeepLink" target="_blank" rel="noopener noreferrer">
      Open in n8n ↗
    </a>

    <section v-if="node.tags.length">
      <h3>Tags</h3>
      <span v-for="tag in node.tags" :key="tag" class="badge">{{ tag }}</span>
    </section>

    <section v-if="node.webhookPaths.length">
      <h3>Webhooks</h3>
      <ul><li v-for="p in node.webhookPaths" :key="p"><code>/{{ p }}</code></li></ul>
    </section>

    <section>
      <h3>Nodes ({{ node.summary.nodeCount }})</h3>
      <ul><li v-for="nt in node.summary.nodeTypes" :key="nt.type">{{ nt.count }}× {{ nt.displayName }}</li></ul>
    </section>

    <section v-if="node.summary.credentials.length">
      <h3>Credentials</h3>
      <ul><li v-for="c in node.summary.credentials" :key="c">{{ c }}</li></ul>
    </section>

    <section>
      <h3>Links</h3>
      <div v-if="links.inbound.length" class="lgroup">
        <div class="lsub">Inbound ({{ links.inbound.length }})</div>
        <ul><li v-for="(l, i) in links.inbound" :key="'in' + i" class="link"
            role="button" tabindex="0"
            @click="$emit('select', l.id)"
            @keydown="onActivate(() => $emit('select', l.id))">
          <span class="lt" :data-lt="l.type">{{ l.type }}</span> {{ l.name }}
        </li></ul>
      </div>
      <div v-if="links.outbound.length" class="lgroup">
        <div class="lsub">Outbound ({{ links.outbound.length }})</div>
        <ul><li v-for="(l, i) in links.outbound" :key="'out' + i" class="link"
            role="button" tabindex="0"
            @click="$emit('select', l.id)"
            @keydown="onActivate(() => $emit('select', l.id))">
          {{ l.name }} <span class="lt" :data-lt="l.type">{{ l.type }}</span>
        </li></ul>
      </div>
      <p v-if="!links.inbound.length && !links.outbound.length" class="muted">No links.</p>
    </section>
  </BasePanel>
</template>

<style scoped>
.badge {
  display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 10px;
  background: var(--bg-3); font-size: 12px;
}
.badge.on { background: var(--accent-dim); color: var(--accent); }
.badge.off { background: var(--bg-3); }
.deep-link { display: inline-block; margin: 8px 0; font-weight: 600; }
section h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; color: var(--text-dim); }
.lgroup { margin-bottom: 8px; }
.lsub { font-size: 11px; color: var(--text-faint); margin: 4px 0; }
.link { cursor: pointer; padding: 3px 4px; border-radius: var(--radius-s); color: var(--accent); }
.link:hover { background: var(--bg-3); }
.lt { font-size: 10px; color: var(--text-dim); background: var(--bg-3); border-radius: 4px; padding: 0 5px; margin-right: 4px; }
.muted { color: var(--text-faint); font-size: 12px; }
</style>
