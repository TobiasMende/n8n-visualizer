import { describe, it, expect } from 'vitest'
import { classifyTriggers } from './triggers'
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
