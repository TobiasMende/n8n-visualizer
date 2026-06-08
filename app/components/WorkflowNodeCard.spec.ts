import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowNodeCard from './WorkflowNodeCard.vue'

const stubs = { Handle: { template: '<div />' } }   // Vue Flow Handle needs a provider; stub in unit test

describe('WorkflowNodeCard', () => {
  it('renders a workflow node with name + trigger icon', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'workflow', label: 'Order Flow', triggers: ['webhook'], inbound: 3, dimmed: false } }, global: { stubs } })
    expect(w.text()).toContain('Order Flow')
    expect(w.find('[data-trigger="webhook"]').exists()).toBe(true)
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
})
