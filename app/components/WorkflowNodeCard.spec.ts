import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowNodeCard from './WorkflowNodeCard.vue'

const stubs = { Handle: { template: '<div />' } }   // Vue Flow Handle needs a provider; stub in unit test

describe('WorkflowNodeCard', () => {
  it('renders a workflow node with name', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'workflow', label: 'Order Flow', triggers: ['webhook'], inbound: 3, dimmed: false } }, global: { stubs } })
    expect(w.text()).toContain('Order Flow')
    expect(w.find('.kind-workflow').exists()).toBe(true)
  })

  it('renders a standalone trigger node with its kind class and icon', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook', triggers: [], inbound: 0, dimmed: false } }, global: { stubs } })
    expect(w.text()).toContain('Webhook')
    expect(w.find('.kind-trigger').exists()).toBe(true)
    expect(w.text()).toContain('⚡')
  })

  it('renders a credential node with a distinct kind class', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'credential', label: 'My API', triggers: [], inbound: 0, dimmed: false } }, global: { stubs } })
    expect(w.text()).toContain('My API')
    expect(w.find('.kind-credential').exists()).toBe(true)
  })

  it('applies dimmed class', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'workflow', label: 'X', triggers: [], inbound: 0, dimmed: true } }, global: { stubs } })
    expect(w.classes()).toContain('dimmed')
  })

  it('shows an unsecured badge on an open webhook trigger', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook', triggers: [], inbound: 0, dimmed: false, secured: false } }, global: { stubs } })
    expect(w.find('.unsecured').exists()).toBe(true)
    expect(w.text()).toContain('🔓')
  })

  it('shows no unsecured badge on a secured webhook trigger', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook', triggers: [], inbound: 0, dimmed: false, secured: true } }, global: { stubs } })
    expect(w.find('.unsecured').exists()).toBe(false)
  })
})
