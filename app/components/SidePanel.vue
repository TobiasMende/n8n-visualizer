<script setup lang="ts">
import type { WorkflowNode } from '#shared/types/graph'

defineProps<{ node: WorkflowNode }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <aside class="panel">
    <header>
      <h2>{{ node.name }}</h2>
      <button @click="$emit('close')">×</button>
    </header>

    <p class="meta">
      <span :class="['badge', node.active ? 'on' : 'off']">{{ node.active ? 'active' : 'inactive' }}</span>
      <span v-for="t in node.triggers" :key="t" class="badge">{{ t }}</span>
    </p>

    <a v-if="node.deepLink" class="deep-link" :href="node.deepLink" target="_blank" rel="noopener noreferrer">
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
      <ul><li v-for="nt in node.summary.nodeTypes" :key="nt.type">{{ nt.count }}× {{ nt.type }}</li></ul>
    </section>

    <section v-if="node.summary.credentials.length">
      <h3>Credentials</h3>
      <ul><li v-for="c in node.summary.credentials" :key="c">{{ c }}</li></ul>
    </section>

    <section>
      <h3>Links</h3>
      <p>Inbound: {{ node.summary.inbound }} · Outbound: {{ node.summary.outbound }}</p>
    </section>
  </aside>
</template>

<style scoped>
.panel { position: absolute; top: 0; right: 0; width: 320px; height: 100%; overflow-y: auto;
  background: #fff; border-left: 1px solid #ddd; padding: 16px; box-shadow: -2px 0 8px rgba(0,0,0,.06); }
header { display: flex; justify-content: space-between; align-items: center; }
.badge { display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 10px; background: #eee; font-size: 12px; }
.badge.on { background: #d6f5d6; } .badge.off { background: #f5d6d6; }
.deep-link { display: inline-block; margin: 8px 0; font-weight: 600; }
section h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; color: #666; }
</style>
