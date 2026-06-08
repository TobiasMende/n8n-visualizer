<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
const views = [
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'webhooks', icon: '🔗', label: 'Webhooks' },
  { id: 'schedules', icon: '⏰', label: 'Schedules' },
  { id: 'credentials', icon: '🔑', label: 'Credentials' },
] as const
</script>
<template>
  <div class="shell">
    <nav class="rail">
      <div class="brand">n8n</div>
      <button v-for="v in views" :key="v.id" class="navbtn" :class="{ active: store.view === v.id }"
        :title="v.label" @click="store.view = v.id">
        <span class="i">{{ v.icon }}</span><span class="t">{{ v.label }}</span>
      </button>
    </nav>
    <div class="main">
      <header class="topbar">
        <slot name="topbar" />
        <div class="spacer" />
        <LayersPanel v-if="store.view === 'map' && store.graph" />
      </header>
      <div class="body"><slot /></div>
    </div>
  </div>
</template>
<style scoped>
.shell { display: flex; height: 100vh; }
.rail { width: 76px; background: var(--bg-1); border-right: 1px solid var(--border); display: flex;
  flex-direction: column; align-items: stretch; padding: 12px 8px; gap: 6px; }
.brand { color: var(--accent); font-weight: 800; text-align: center; margin-bottom: 10px; letter-spacing: .04em; }
.navbtn { display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: none;
  color: var(--text-faint); cursor: pointer; padding: 8px 4px; border-radius: var(--radius-m); transition: all var(--dur) var(--ease); }
.navbtn .i { font-size: 18px; } .navbtn .t { font-size: 10px; }
.navbtn:hover { color: var(--text-dim); background: var(--bg-2); }
.navbtn.active { color: var(--accent); background: var(--bg-2); box-shadow: inset 2px 0 0 var(--accent); }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border);
  background: var(--bg-1); }
.spacer { flex: 1; }
.body { position: relative; flex: 1; min-height: 0; }
</style>
