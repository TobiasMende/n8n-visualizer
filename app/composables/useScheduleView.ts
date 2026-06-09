import type { WorkflowGraph, CadenceGroup } from '#shared/types/graph'

const ORDER: CadenceGroup[] = ['sub-minute', 'minutes', 'hourly', 'daily', 'weekly', 'monthly', 'cron']

export interface ScheduleRow { workflowId: string; workflow: string; cadenceText: string; nextFire: string | null; active: boolean }
export interface ScheduleGroupView { group: CadenceGroup; rows: ScheduleRow[] }

export function scheduleGroups(graph: WorkflowGraph | null): ScheduleGroupView[] {
  if (!graph) return []
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const byGroup = new Map<CadenceGroup, ScheduleRow[]>()
  for (const s of graph.schedules) {
    const wf = nodeById.get(s.workflowId)
    const row: ScheduleRow = { workflowId: s.workflowId, workflow: wf?.name ?? s.workflowId, cadenceText: s.cadenceText, nextFire: s.nextFire, active: wf?.active ?? false }
    const list = byGroup.get(s.cadenceGroup) ?? []
    list.push(row)
    byGroup.set(s.cadenceGroup, list)
  }
  return ORDER.filter(g => byGroup.has(g)).map(g => ({ group: g, rows: byGroup.get(g)! }))
}

export function formatCountdown(nextFire: string | null, now: string): string {
  if (!nextFire) return '—'
  const delta = new Date(nextFire).getTime() - new Date(now).getTime()
  if (delta <= 0) return 'due'
  const mins = Math.round(delta / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`
  return `in ${Math.floor(hrs / 24)}d ${hrs % 24}h`
}
