import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SidePanel from './SidePanel.vue'
import type { WorkflowNode } from '#shared/types/graph'

const node: WorkflowNode = {
  id: 'a', name: 'Order Flow', active: true, triggers: ['webhook'], tags: ['prod'],
  webhookPaths: ['orders'], deepLink: 'https://n8n.example.com/workflow/a',
  summary: { nodeCount: 3, nodeTypes: [{ type: 'n8n-nodes-base.httpRequest', count: 2 }], credentials: ['My API'], inbound: 1, outbound: 0 },
}

describe('SidePanel', () => {
  it('renders summary and an Open in n8n link to the deep link', () => {
    const w = mount(SidePanel, { props: { node } })
    expect(w.text()).toContain('Order Flow')
    expect(w.text()).toContain('n8n-nodes-base.httpRequest')
    const link = w.find('a.deep-link')
    expect(link.attributes('href')).toBe('https://n8n.example.com/workflow/a')
  })

  it('hides the deep link when node.deepLink is null', () => {
    const w = mount(SidePanel, { props: { node: { ...node, deepLink: null } } })
    expect(w.find('a.deep-link').exists()).toBe(false)
  })
})
