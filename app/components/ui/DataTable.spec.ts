import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTable from './DataTable.vue'

const columns = [{ key: 'name', label: 'Name' }, { key: 'count', label: 'Count' }]
const rows = [{ name: 'Beta', count: 2 }, { name: 'Alpha', count: 5 }]

describe('DataTable', () => {
  it('renders headers and rows', () => {
    const w = mount(DataTable, { props: { columns, rows } })
    expect(w.text()).toContain('Name')
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })

  it('sorts ascending when a header is clicked', async () => {
    const w = mount(DataTable, { props: { columns, rows } })
    await w.findAll('th')[0].trigger('click')
    expect(w.findAll('tbody tr')[0].text()).toContain('Alpha')
  })

  it('uses rowKey prop for stable row keys', () => {
    const w = mount(DataTable, { props: { columns, rows, rowKey: (r) => r.name } })
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })
})
