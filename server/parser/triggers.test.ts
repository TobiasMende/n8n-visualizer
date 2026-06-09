import { describe, it, expect } from 'vitest'
import { classifyTriggers, extractTriggerNodes } from './triggers'
import type { RawWorkflow } from '#shared/types/graph'

const wf = (nodes: { type: string }[]): RawWorkflow =>
  ({ id: 'w1', name: 'W', nodes: nodes.map((n, i) => ({ name: `n${i}`, type: n.type })) })

describe('classifyTriggers', () => {
  it('detects webhook, schedule, manual', () => {
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.webhook' }]))).toEqual(['webhook'])
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.scheduleTrigger' }]))).toEqual(['schedule'])
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.manualTrigger' }]))).toEqual(['manual'])
  })

  it('treats other *Trigger nodes as app triggers', () => {
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.slackTrigger' }]))).toEqual(['app'])
  })

  it('returns multiple distinct types and ignores non-trigger nodes', () => {
    const got = classifyTriggers(wf([
      { type: 'n8n-nodes-base.webhook' },
      { type: 'n8n-nodes-base.scheduleTrigger' },
      { type: 'n8n-nodes-base.set' },
    ]))
    expect(got.sort()).toEqual(['schedule', 'webhook'])
  })
})

const wfFull = (nodes: any[]): RawWorkflow => ({ id: 'w1', name: 'W', nodes })

describe('classifyTriggers — executeWorkflowTrigger', () => {
  it('does NOT classify executeWorkflowTrigger as an app trigger', () => {
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.executeWorkflowTrigger' }]))).toEqual([])
  })
})

describe('extractTriggerNodes', () => {
  const cat = { displayName: (t: string) => t.split('.').pop() ?? t }

  it('emits a webhook trigger node with method + path label', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'orders', httpMethod: 'POST' } },
    ]), cat)
    expect(got).toEqual([
      { id: 'trig:w1:hook#0', workflowId: 'w1', kind: 'webhook', label: 'POST /orders' },
    ])
  })

  it('emits one schedule trigger node per cadence', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'cron', type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule: { interval: [
        { field: 'days', triggerAtHour: 9, triggerAtMinute: 0 },
      ] } } },
    ]), cat)
    expect(got).toEqual([
      { id: 'trig:w1:cron#0', workflowId: 'w1', kind: 'schedule', label: 'Every day at 09:00' },
    ])
  })

  it('emits a manual trigger node', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'm', type: 'n8n-nodes-base.manualTrigger' },
    ]), cat)
    expect(got).toEqual([{ id: 'trig:w1:m#0', workflowId: 'w1', kind: 'manual', label: 'Manual' }])
  })

  it('emits an app trigger node using the catalog display name', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 's', type: 'n8n-nodes-base.slackTrigger' },
    ]), cat)
    expect(got).toEqual([{ id: 'trig:w1:s#0', workflowId: 'w1', kind: 'app', label: 'slackTrigger' }])
  })

  it('emits a form trigger node', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'f', type: 'n8n-nodes-base.formTrigger', parameters: { path: 'signup' } },
    ]), cat)
    expect(got).toEqual([{ id: 'trig:w1:f#0', workflowId: 'w1', kind: 'form', label: 'Form /signup' }])
  })

  it('excludes executeWorkflowTrigger and non-trigger nodes', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'sub', type: 'n8n-nodes-base.executeWorkflowTrigger' },
      { name: 'set', type: 'n8n-nodes-base.set' },
    ]), cat)
    expect(got).toEqual([])
  })

  it('emits multiple trigger nodes for one workflow', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'a', httpMethod: 'GET' } },
      { name: 'm', type: 'n8n-nodes-base.manualTrigger' },
    ]), cat)
    expect(got.map(t => t.kind)).toEqual(['webhook', 'manual'])
  })
})
