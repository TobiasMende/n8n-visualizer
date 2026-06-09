<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
const views = [
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'webhooks', icon: '🔗', label: 'Webhooks' },
  { id: 'schedules', icon: '⏰', label: 'Schedules' },
  { id: 'credentials', icon: '🔑', label: 'Credentials' },
  { id: 'dataTables', icon: '🗄️', label: 'Data Tables' },
] as const
</script>
<template>
  <div class="shell">
    <nav class="rail">
      <div class="brand">n8viz</div>
      <button v-for="v in views" :key="v.id" class="navbtn" :class="{ active: store.view === v.id }"
        :title="v.label" @click="store.view = v.id">
        <span class="i">{{ v.icon }}</span><span class="t">{{ v.label }}</span>
      </button>
      <a class="navbtn ghlink" href="https://github.com/TobiasMende/n8n-visualizer" target="_blank"
        rel="noopener noreferrer" title="View on GitHub" aria-label="View on GitHub">
        <svg class="i" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
            0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
            1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
            0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27
            2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
            1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01
            2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg><span class="t">GitHub</span>
      </a>
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
.ghlink { margin-top: auto; text-decoration: none; }
.ghlink .i { display: inline-flex; }
.body { position: relative; flex: 1; min-height: 0; }
</style>
