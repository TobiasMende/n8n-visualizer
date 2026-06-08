<script setup lang="ts">
import { ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
const showTypes = ref(false)

function toggleNodeTypes() {
  store.layers.nodeTypes = !store.layers.nodeTypes
  if (!store.layers.nodeTypes) showTypes.value = false
}
</script>
<template>
  <div class="toggles">
    <IconButton :active="store.layers.credentials" title="Toggle credential nodes"
      @click="store.layers.credentials = !store.layers.credentials">🔑 Credentials</IconButton>
    <div class="wrap">
      <IconButton :active="store.layers.nodeTypes" title="Toggle node-type nodes"
        @click="toggleNodeTypes">◆ Node types</IconButton>
      <IconButton v-if="store.layers.nodeTypes" :active="showTypes" title="Choose visible node types"
        @click="showTypes = !showTypes">⋯</IconButton>
      <NodeTypeLayerPanel v-if="store.layers.nodeTypes && showTypes" />
    </div>
  </div>
</template>
<style scoped>
.toggles { display: flex; gap: 8px; }
.wrap { position: relative; display: flex; gap: 6px; }
</style>
