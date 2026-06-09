<script setup lang="ts">
import type { CredentialRef } from '#shared/types/graph'
import { prettifyType } from '#shared/prettify'
import { onActivate } from '~/composables/useA11yClick'

defineProps<{ credential: CredentialRef; workflows: { id: string; name: string }[] }>()
defineEmits<{ close: []; select: [id: string] }>()
</script>

<template>
  <BasePanel @close="$emit('close')">
    <template #title><span class="ico" aria-hidden="true">🔑</span> {{ credential.name }}</template>
    <p class="meta"><span class="badge">{{ prettifyType(credential.type) }}</span></p>

    <section>
      <h3>Used by ({{ workflows.length }})</h3>
      <ul>
        <li v-for="w in workflows" :key="w.id" class="link"
            role="button" tabindex="0"
            @click="$emit('select', w.id)"
            @keydown="onActivate(() => $emit('select', w.id))">↳ {{ w.name }}</li>
      </ul>
      <p v-if="!workflows.length" class="muted">No workflows.</p>
    </section>
  </BasePanel>
</template>

<style scoped>
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; background: var(--accent-dim); color: var(--warn); font-size: 12px; }
section h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; color: var(--text-dim); }
.link { cursor: pointer; padding: 3px 4px; border-radius: var(--radius-s); color: var(--accent); }
.link:hover { background: var(--bg-3); }
.muted { color: var(--text-faint); font-size: 12px; }
</style>
