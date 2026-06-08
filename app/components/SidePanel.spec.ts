import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SidePanel from './SidePanel.vue'
import type { WorkflowNode } from '#shared/types/graph'

const node: WorkflowNode = {
  id: 'a', name: 'Order Flow', active: true, triggers: ['webhook'], tags: ['prod'],
  webhookPaths: ['orders'], deepLink: 'https://n8n.example.com/workflow/a',
  summary: { nodeCount: 3, nodeTypes: [{ type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request', count: 2 }], credentials: ['My API'], inbound: 1, outbound: 0 },
}

describe('SidePanel', () => {
  it('shows readable node-type names and a deep link', () => {
    const w = mount(SidePanel, { props: { node } })
    expect(w.text()).toContain('Order Flow')
    expect(w.text()).toContain('HTTP Request')
    expect(w.text()).not.toContain('n8n-nodes-base.httpRequest')
    expect(w.find('a.deep-link').attributes('href')).toBe('https://n8n.example.com/workflow/a')
  })
  it('hides the deep link when null', () => {
    const w = mount(SidePanel, { props: { node: { ...node, deepLink: null } } })
    expect(w.find('a.deep-link').exists()).toBe(false)
  })
})
