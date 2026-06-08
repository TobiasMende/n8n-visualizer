<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { scheduleGroups, formatCountdown } from '~/composables/useScheduleView'

const store = useGraphStore()
const filter = ref('')
const activeOnly = ref(false)
const now = ref(new Date().toISOString())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = new Date().toISOString() }, 30000) })
onUnmounted(() => clearInterval(timer))

const groups = computed(() => {
  const base = scheduleGroups(store.graph)
  const f = filter.value.trim().toLowerCase()
  return base
    .map(g => ({ group: g.group, rows: g.rows.filter(r =>
      (!activeOnly.value || r.active) && (!f || r.workflow.toLowerCase().includes(f) || r.cadenceText.toLowerCase().includes(f))) }))
    .filter(g => g.rows.length)
})
const labels: Record<string, string> = {
  'sub-minute': 'Sub-minute', minutes: 'Minutes', hourly: 'Hourly',
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', cron: 'Custom cron',
}
function jump(id: string) { store.selectedId = id; store.view = 'map' }
</script>

<template>
  <div class="wrap">
    <div class="bar">
      <input v-model="filter" class="search" placeholder="Filter schedules…" />
      <label class="chk"><input type="checkbox" v-model="activeOnly" /> active only</label>
    </div>
    <div v-for="g in groups" :key="g.group" class="group">
      <div class="ghead">{{ labels[g.group] }}</div>
      <Panel>
        <div v-for="r in g.rows" :key="r.workflowId + r.cadenceText" class="row" @click="jump(r.workflowId)">
          <span class="dot" :class="r.active ? 'on' : 'off'">●</span>
          <span class="wf">{{ r.workflow }}</span>
          <span class="cadence">{{ r.cadenceText }}</span>
          <span class="next">{{ formatCountdown(r.nextFire, now) }}</span>
        </div>
      </Panel>
    </div>
    <EmptyState v-if="!groups.length" title="No schedules" hint="No schedule or cron triggers found." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.bar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.search { width: 280px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
  border-radius: var(--radius-m); padding: 8px 10px; }
.chk { color: var(--text-dim); font-size: 13px; }
.group { margin-bottom: 16px; }
.ghead { color: var(--text-dim); text-transform: uppercase; font-size: 11px; letter-spacing: .05em; margin: 0 0 6px 4px; }
.row { display: grid; grid-template-columns: 18px 1fr 1fr 90px; gap: 10px; align-items: center;
  padding: 10px 12px; border-bottom: 1px solid var(--border-soft); cursor: pointer; transition: background var(--dur) var(--ease); }
.row:last-child { border-bottom: none; }
.row:hover { background: var(--bg-3); }
.dot.on { color: var(--accent); } .dot.off { color: var(--text-faint); }
.wf { font-weight: 600; }
.cadence { color: var(--text-dim); }
.next { color: var(--accent); text-align: right; font-variant-numeric: tabular-nums; }
</style>
