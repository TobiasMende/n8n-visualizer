import { describe, it, expect } from 'vitest'
import type { RawWorkflow } from '#shared/types/graph'
import { anonymizeWorkflows, assertNoLeak, anonymizeBundle, assertBundleNoLeak } from './anonymize'

const sample: RawWorkflow[] = [{
  id: 'wf-1',
  name: 'ACME Secret Order Flow',
  active: true,
  nodes: [
    { id: 'n1', name: 'Get Orders', type: 'n8n-nodes-base.httpRequest',
      parameters: { url: 'https://secret.corp.internal/orders' },
      credentials: { httpHeaderAuth: { id: 'c-9', name: 'Corp Token' } } },
    { id: 'n2', name: 'Cron', type: 'n8n-nodes-base.scheduleTrigger',
      parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 6 }] } } },
  ],
  connections: { 'Get Orders': { main: [[{ node: 'Cron', type: 'main', index: 0 }]] } },
  tags: [{ id: 't1', name: 'confidential' }],
}]

describe('anonymizeWorkflows — names & structure', () => {
  const out = anonymizeWorkflows(sample)

  it('preserves ids, node ids, types, active', () => {
    expect(out[0].id).toBe('wf-1')
    expect(out[0].nodes[0].id).toBe('n1')
    expect(out[0].nodes[0].type).toBe('n8n-nodes-base.httpRequest')
    expect(out[0].active).toBe(true)
  })

  it('replaces the workflow name', () => {
    expect(out[0].name).not.toBe('ACME Secret Order Flow')
    expect(out[0].name.length).toBeGreaterThan(0)
  })

  it('replaces node and credential and tag names', () => {
    expect(out[0].nodes[0].name).not.toBe('Get Orders')
    expect(out[0].nodes[0].credentials!.httpHeaderAuth.name).not.toBe('Corp Token')
    const tag0 = out[0].tags![0]
    expect(typeof tag0 === 'object' && tag0.name).not.toBe('confidential')
  })

  it('preserves cron rule untouched', () => {
    expect(out[0].nodes[1].parameters!.rule).toEqual(sample[0].nodes[1].parameters!.rule)
  })

  it('does not mutate the input', () => {
    expect(sample[0].name).toBe('ACME Secret Order Flow')
  })

  it('is deterministic', () => {
    expect(anonymizeWorkflows(sample)).toEqual(anonymizeWorkflows(sample))
  })
})

describe('anonymizeWorkflows — parameter scrubbing', () => {
  const out = anonymizeWorkflows(sample)

  it('rewrites url params to the demo host', () => {
    const url = out[0].nodes[0].parameters!.url as string
    expect(url).toContain('demo.example')
    expect(url).not.toContain('secret.corp.internal')
  })

  it('replaces webhook path params with a slug', () => {
    const wf: RawWorkflow[] = [{
      id: 'wf-2', name: 'x', nodes: [
        { id: 'h', name: 'Hook', type: 'n8n-nodes-base.webhook',
          parameters: { path: 'super-secret-customer-endpoint', httpMethod: 'POST' } },
      ],
    }]
    const r = anonymizeWorkflows(wf)
    expect(r[0].nodes[0].parameters!.path).not.toBe('super-secret-customer-endpoint')
    expect(r[0].nodes[0].parameters!.httpMethod).toBe('POST')
  })

  it('scrubs long free-text params', () => {
    const wf: RawWorkflow[] = [{
      id: 'wf-3', name: 'x', nodes: [
        { id: 's', name: 'Set', type: 'n8n-nodes-base.set',
          parameters: { text: 'Confidential: customer Jane Doe, card 4111 1111 1111 1111' } },
      ],
    }]
    const r = anonymizeWorkflows(wf)
    const t = r[0].nodes[0].parameters!.text as string
    expect(t).not.toContain('Jane Doe')
    expect(t).not.toContain('4111')
  })
})

describe('anonymizeWorkflows — hardening (review fixes)', () => {
  it('fakes webhookId', () => {
    const wf: RawWorkflow[] = [{ id: 'w', name: 'n', nodes: [
      { id: 'h', name: 'Hook', type: 'n8n-nodes-base.webhook', webhookId: 'real-uuid-1234-secret', parameters: { path: '' } },
    ] }]
    const out = anonymizeWorkflows(wf)
    expect(out[0].nodes[0].webhookId).toBeDefined()
    expect(out[0].nodes[0].webhookId).not.toBe('real-uuid-1234-secret')
  })

  it('scrubs non-http URIs and emails in params', () => {
    const wf: RawWorkflow[] = [{ id: 'w', name: 'n', nodes: [
      { id: 's', name: 'Set', type: 'n8n-nodes-base.set',
        parameters: { mongo: 'mongodb://prod-db:27017', ftp: 'ftp://files.corp.net', email: 'jane@acme-corp.com' } },
    ] }]
    const out = anonymizeWorkflows(wf)
    const p = out[0].nodes[0].parameters!
    expect(p.mongo).not.toContain('prod-db')
    expect(p.ftp).not.toContain('files.corp.net')
    expect(p.email).not.toContain('acme-corp')
  })

  it('anonymizes settings and remaps errorWorkflow name', () => {
    const wf: RawWorkflow[] = [
      { id: 'wf-err', name: 'Internal Alert Flow', nodes: [] },
      { id: 'wf-main', name: 'Main', nodes: [],
        settings: { errorWorkflow: 'Internal Alert Flow', secretField: 'ACME confidential internal note here' } },
    ]
    const out = anonymizeWorkflows(wf)
    const s = out[1].settings!
    expect(s.errorWorkflow).toBe(out[0].name)            // remapped to faked name
    expect(s.errorWorkflow).not.toBe('Internal Alert Flow')
    expect(JSON.stringify(s)).not.toContain('ACME confidential')
  })

  it('preserves errorWorkflow when it is an id (no matching name)', () => {
    const wf: RawWorkflow[] = [{ id: 'wf-main', name: 'Main', nodes: [],
      settings: { errorWorkflow: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789' } }]
    const out = anonymizeWorkflows(wf)
    expect(out[0].settings!.errorWorkflow).toBe('a1b2c3d4-e5f6-7890-abcd-ef0123456789')
  })

  it('assertNoLeak catches a nested-array host leak', () => {
    const wf: RawWorkflow[] = [{ id: 'w', name: 'n', nodes: [
      { id: 's', name: 'Set', type: 'n8n-nodes-base.set',
        parameters: { hosts: ['https://secret.corp.internal/x'] } },
    ] }]
    const out = anonymizeWorkflows(wf)
    // plant the original host back into the output to simulate a scrubbing miss
    ;(out[0].nodes[0].parameters!.hosts as string[])[0] = 'https://secret.corp.internal/x'
    expect(() => assertNoLeak(wf, out)).toThrow(/leak/i)
  })

  it('assertNoLeak catches a surviving webhookId', () => {
    const wf: RawWorkflow[] = [{ id: 'w', name: 'n', nodes: [
      { id: 'h', name: 'Hook', type: 'n8n-nodes-base.webhook', webhookId: 'real-uuid-1234-secret', parameters: {} },
    ] }]
    const out = anonymizeWorkflows(wf)
    out[0].nodes[0].webhookId = 'real-uuid-1234-secret'
    expect(() => assertNoLeak(wf, out)).toThrow(/leak/i)
  })
})

describe('assertNoLeak', () => {
  it('passes for properly anonymized output', () => {
    expect(() => assertNoLeak(sample, anonymizeWorkflows(sample))).not.toThrow()
  })

  it('throws when an original name survives in the output', () => {
    const leaked = anonymizeWorkflows(sample)
    leaked[0].name = 'ACME Secret Order Flow'
    expect(() => assertNoLeak(sample, leaked)).toThrow(/leak/i)
  })

  it('throws when an original host survives', () => {
    const leaked = anonymizeWorkflows(sample)
    leaked[0].nodes[0].parameters!.url = 'https://secret.corp.internal/orders'
    expect(() => assertNoLeak(sample, leaked)).toThrow(/leak/i)
  })
})

describe('anonymizeWorkflows — names embedded in parameters (cachedResultName)', () => {
  it('scrubs a workflow name referenced in another workflow’s resource locator', () => {
    const wf: RawWorkflow[] = [
      { id: 'wf-target', name: 'Map Refresh Read Replica', nodes: [] },
      { id: 'wf-caller', name: 'Caller', nodes: [
        { id: 'n', name: 'Exec', type: 'n8n-nodes-base.executeWorkflow',
          parameters: { workflowId: { __rl: true, mode: 'list', value: 'wf-target', cachedResultName: 'Map Refresh Read Replica' } } },
      ] },
    ]
    const out = anonymizeWorkflows(wf)
    expect(JSON.stringify(out)).not.toContain('Map Refresh Read Replica')
    expect(() => assertNoLeak(wf, out)).not.toThrow()
  })

  it('scrubs a node name (≤24 chars) referenced in an expression', () => {
    const wf: RawWorkflow[] = [{ id: 'w', name: 'W', nodes: [
      { id: 'a', name: 'Read Replica', type: 'n8n-nodes-base.set', parameters: {} },
      { id: 'b', name: 'Use', type: 'n8n-nodes-base.set', parameters: { ref: "={{ $('Read Replica').item }}" } },
    ] }]
    const out = anonymizeWorkflows(wf)
    expect(JSON.stringify(out)).not.toContain('Read Replica')
    expect(() => assertNoLeak(wf, out)).not.toThrow()
  })
})

describe('anonymizeWorkflows — drops undeclared API fields (pinData/staticData/notes)', () => {
  it('does not leak names hiding in fields the app never reads', () => {
    const wf = [{
      id: 'w', name: 'Map Refresh Read Replica',
      nodes: [{ id: 'n', name: 'Set', type: 'n8n-nodes-base.set', parameters: {}, notes: 'see Map Refresh Read Replica' }],
      pinData: { Set: [{ json: { ref: 'Map Refresh Read Replica' } }] },
      staticData: { last: 'Map Refresh Read Replica' },
      meta: { templateId: 'Map Refresh Read Replica' },
    }] as unknown as RawWorkflow[]
    const out = anonymizeWorkflows(wf)
    const json = JSON.stringify(out)
    expect(json).not.toContain('Map Refresh Read Replica')
    expect(json).not.toContain('pinData')
    expect(json).not.toContain('staticData')
    expect(json).not.toContain('notes')
    expect(() => assertNoLeak(wf, out)).not.toThrow()
  })
})

describe('anonymizeWorkflows — generic name collisions are not false leaks', () => {
  it('does not abort when a node named "Tool" collides with a type-derived fake', () => {
    const wf: RawWorkflow[] = [{ id: 'w', name: 'W', nodes: [
      { id: 'a', name: 'Tool', type: 'n8n-nodes-base.set', parameters: {} },
      { id: 'b', name: 'wf', type: '@n8n/n8n-nodes-langchain.toolWorkflow', parameters: {} },
    ] }]
    const out = anonymizeWorkflows(wf)
    expect(() => assertNoLeak(wf, out)).not.toThrow()
  })

  it('still catches a genuinely identifying multi-word name that survives', () => {
    const wf: RawWorkflow[] = [{ id: 'w', name: 'Acme Quarterly Revenue Reconciler', nodes: [] }]
    const out = anonymizeWorkflows(wf)
    out[0].name = 'Acme Quarterly Revenue Reconciler'
    expect(() => assertNoLeak(wf, out)).toThrow(/leak/i)
  })
})

describe('anonymizeWorkflows — generic single-word names are not secrets', () => {
  it('does not abort on a node named "Message" colliding with a sendMessage type', () => {
    const wf: RawWorkflow[] = [{ id: 'w', name: 'W', nodes: [
      { id: 'a', name: 'Message', type: 'n8n-nodes-base.set', parameters: { operation: 'sendMessage' } },
      { id: 'b', name: 'Send', type: 'n8n-nodes-base.telegram', parameters: { operation: 'sendMessage' } },
    ] }]
    const out = anonymizeWorkflows(wf)
    expect(() => assertNoLeak(wf, out)).not.toThrow()
  })
})

describe('anonymizeWorkflows — sensitive ids in URL paths are dropped', () => {
  it('does not leak a Google Sheets document id carried in a URL path', () => {
    const docId = '1EMDjzzQ4gN8PQYrx67Pycl2LUfd5pf90KGSy4pJxUmM'
    const wf: RawWorkflow[] = [{ id: 'w', name: 'W', nodes: [
      { id: 'n', name: 'Sheets', type: 'n8n-nodes-base.googleSheets', parameters: {
        documentId: { __rl: true, mode: 'list', value: docId,
          cachedResultUrl: `https://docs.google.com/spreadsheets/d/${docId}/edit`,
          cachedResultName: 'Q3 Revenue' } } },
    ] }]
    const out = anonymizeWorkflows(wf)
    expect(JSON.stringify(out)).not.toContain(docId)
    expect(() => assertNoLeak(wf, out)).not.toThrow()
  })
})

describe('anonymizeBundle — credentials & data tables', () => {
  it('fakes credential names, keeps type, drops timestamps', () => {
    const bundle = {
      workflows: [] as RawWorkflow[],
      credentials: [{ id: 'c1', name: 'Acme Prod Postgres', type: 'postgres', createdAt: '2020', updatedAt: '2021' }],
      dataTables: null,
    }
    const out = anonymizeBundle(bundle)
    expect(out.credentials![0].name).not.toBe('Acme Prod Postgres')
    expect(out.credentials![0].type).toBe('postgres')
    expect((out.credentials![0] as Record<string, unknown>).createdAt).toBeUndefined()
  })

  it('keeps credential-name fakes consistent with the workflow nodes (same id)', () => {
    const bundle = {
      workflows: [{ id: 'w', name: 'W', nodes: [
        { id: 'n', name: 'PG', type: 'n8n-nodes-base.postgres', parameters: {},
          credentials: { postgres: { id: 'c1', name: 'Acme Prod Postgres' } } },
      ] }] as RawWorkflow[],
      credentials: [{ id: 'c1', name: 'Acme Prod Postgres', type: 'postgres' }],
      dataTables: null,
    }
    const out = anonymizeBundle(bundle)
    const nodeCredName = out.workflows[0].nodes[0].credentials!.postgres.name
    expect(out.credentials![0].name).toBe(nodeCredName)
  })

  it('fakes data table + column names and keeps the table linked to its workflow', () => {
    const id = 'dt_abc123'
    const bundle = {
      workflows: [{ id: 'w', name: 'W', nodes: [
        { id: 'n', name: 'DT', type: 'n8n-nodes-base.dataTable', parameters: {
          operation: 'insert',
          dataTableId: { __rl: true, mode: 'list', value: id, cachedResultName: 'Customer PII Vault' } } },
      ] }] as RawWorkflow[],
      credentials: null,
      dataTables: [{ id, name: 'Customer PII Vault', columns: [
        { id: 'col1', name: 'social_security_number', type: 'string', index: 0 },
      ] }],
    }
    const out = anonymizeBundle(bundle)
    const json = JSON.stringify(out)
    expect(json).not.toContain('Customer PII Vault')
    expect(json).not.toContain('social_security_number')
    // id preserved on both sides so the view can link them
    expect(out.dataTables![0].id).toBe(id)
    expect(out.workflows[0].nodes[0].parameters!.dataTableId).toMatchObject({ value: id })
    // cached name on the workflow node matches the data table's faked name
    const cached = (out.workflows[0].nodes[0].parameters!.dataTableId as Record<string, unknown>).cachedResultName
    expect(cached).toBe(out.dataTables![0].name)
    expect(() => assertBundleNoLeak(bundle, out)).not.toThrow()
  })

  it('catches a leaked data table name via assertBundleNoLeak', () => {
    const bundle = {
      workflows: [] as RawWorkflow[], credentials: null,
      dataTables: [{ id: 'd', name: 'Quarterly Revenue Ledger', columns: [] }],
    }
    const out = anonymizeBundle(bundle)
    out.dataTables![0].name = 'Quarterly Revenue Ledger'
    expect(() => assertBundleNoLeak(bundle, out)).toThrow(/leak/i)
  })
})
