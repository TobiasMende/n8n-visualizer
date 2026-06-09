import { describe, it, expect } from 'vitest'
import { Faker } from './fakes'

describe('Faker', () => {
  it('maps the same key to the same fake (workflow names)', () => {
    const f = new Faker()
    const a = f.workflowName('id-1')
    expect(f.workflowName('id-1')).toBe(a)
  })

  it('maps different keys to different fakes', () => {
    const f = new Faker()
    expect(f.workflowName('id-1')).not.toBe(f.workflowName('id-2'))
  })

  it('is deterministic across instances (no RNG)', () => {
    expect(new Faker().workflowName('x')).toBe(new Faker().workflowName('x'))
  })

  it('allocates node names from the node type', () => {
    const f = new Faker()
    const n = f.nodeName('wf1', 'n8n-nodes-base.httpRequest')
    expect(n).toMatch(/HTTP Request/)
  })

  it('keeps credential names stable per key so sharing is preserved', () => {
    const f = new Faker()
    expect(f.credName('cred-9')).toBe(f.credName('cred-9'))
  })

  it('produces a slug for webhook paths', () => {
    const f = new Faker()
    expect(f.webhookPath('p1')).toMatch(/^[a-z0-9-]+$/)
  })

  it('rewrites a url to the demo host, preserving path shape', () => {
    const f = new Faker()
    const out = f.fakeUrl('https://secret.corp.internal/api/orders?id=7')
    expect(out).toContain('demo.example')
    expect(out).not.toContain('secret.corp.internal')
  })

  it('disambiguates repeated node types within a workflow', () => {
    const f = new Faker()
    expect(f.nodeName('wf1', 'n8n-nodes-base.httpRequest')).toBe('HTTP Request')
    expect(f.nodeName('wf1', 'n8n-nodes-base.httpRequest')).toBe('HTTP Request 2')
    expect(f.nodeName('wf2', 'n8n-nodes-base.httpRequest')).toBe('HTTP Request')
  })
})
