<script setup lang="ts">
import type { CredentialRef } from '#shared/types/graph'
import { prettifyType } from '#shared/prettify'

defineProps<{ credential: CredentialRef; workflows: { id: string; name: string }[] }>()
defineEmits<{ close: []; select: [id: string] }>()
</script>

<template>
  <aside class="panel">
    <header>
      <h2><span class="ico">🔑</span> {{ credential.name }}</h2>
      <button @click="$emit('close')">×</button>
    </header>
    <p class="meta"><span class="badge">{{ prettifyType(credential.type) }}</span></p>

    <section>
      <h3>Used by ({{ workflows.length }})</h3>
      <ul>
        <li v-for="w in workflows" :key="w.id" class="link" @click="$emit('select', w.id)">↳ {{ w.name }}</li>
      </ul>
      <p v-if="!workflows.length" class="muted">No workflows.</p>
    </section>
  </aside>
</template>

<style scoped>
.panel { position: absolute; top: 0; right: 0; width: 320px; height: 100%; overflow-y: auto;
  background: var(--bg-2); border-left: 1px solid var(--border); color: var(--text); padding: 16px; box-shadow: -2px 0 8px rgba(0,0,0,.3); }
header { display: flex; justify-content: space-between; align-items: center; }
h2 { font-size: 16px; display: flex; align-items: center; gap: 7px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; background: var(--accent-dim); color: var(--warn); font-size: 12px; }
section h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; color: var(--text-dim); }
.link { cursor: pointer; padding: 3px 4px; border-radius: var(--radius-s); color: var(--accent); }
.link:hover { background: var(--bg-3); }
.muted { color: var(--text-faint); font-size: 12px; }
button { background: none; border: none; color: var(--text-dim); font-size: 18px; cursor: pointer; }
</style>
