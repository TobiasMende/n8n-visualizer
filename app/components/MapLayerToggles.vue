<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
</script>
<template>
  <div class="toggles">
    <IconButton :active="store.layers.credentials" title="Toggle credential nodes"
      @click="store.layers.credentials = !store.layers.credentials">🔑 Credentials</IconButton>
    <IconButton :active="store.layers.nodeTypes" title="Toggle node-type nodes"
      @click="store.layers.nodeTypes = !store.layers.nodeTypes">◆ Node types</IconButton>
  </div>
</template>
<style scoped>.toggles { display: flex; gap: 8px; }</style>
