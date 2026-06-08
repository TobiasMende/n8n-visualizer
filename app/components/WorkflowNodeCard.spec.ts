import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowNodeCard from './WorkflowNodeCard.vue'

// NOTE: @vue-flow/core's <Handle> requires a VueFlow provider context injected via
// provide/inject. Mounting it in isolation throws:
//   TypeError: Cannot read properties of undefined (reading 'dimensions')
// at vue-flow-core.mjs:7009. We stub it here so the node card itself can be unit-tested
// independently of the Vue Flow graph context.
const mountOptions = {
  global: { stubs: { Handle: { template: '<div />' } } },
}

const baseData = {
  label: 'Order Flow', triggers: ['webhook'], inbound: 3, dimmed: false,
}

describe('WorkflowNodeCard', () => {
  it('renders the workflow name and a trigger icon', () => {
    const w = mount(WorkflowNodeCard, { props: { data: baseData }, ...mountOptions })
    expect(w.text()).toContain('Order Flow')
    expect(w.find('[data-trigger="webhook"]').exists()).toBe(true)
  })

  it('applies a dimmed class when data.dimmed is true', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { ...baseData, dimmed: true } }, ...mountOptions })
    expect(w.classes()).toContain('dimmed')
  })
})
