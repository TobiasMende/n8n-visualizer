<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
</script>

<template>
  <div class="app">
    <Toolbar />
    <div class="canvas">
      <ClientOnly>
        <WorkflowMap v-if="store.graph" />
      </ClientOnly>
      <p v-if="!store.graph && !store.loading" class="empty">Connect an n8n instance or upload workflow JSON to begin.</p>
      <p v-if="store.loading" class="empty">Loading…</p>
      <SidePanel v-if="store.selected" :node="store.selected" @close="store.selectedId = null" />
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100vh; }
.canvas { position: relative; flex: 1; }
.empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #888; }
</style>
