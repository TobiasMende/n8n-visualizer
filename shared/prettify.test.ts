import { describe, it, expect } from 'vitest'
import { prettifyType } from './prettify'

describe('prettifyType', () => {
  it('strips the base package prefix and title-cases', () => {
    expect(prettifyType('n8n-nodes-base.set')).toBe('Set')
  })
  it('splits camelCase words', () => {
    expect(prettifyType('n8n-nodes-base.noOp')).toBe('No Op')
  })
  it('fixes known acronyms', () => {
    expect(prettifyType('n8n-nodes-base.httpRequest')).toBe('HTTP Request')
  })
  it('handles scoped community packages', () => {
    expect(prettifyType('@acme/n8n-nodes-foo.myCoolNode')).toBe('My Cool Node')
  })
  it('falls back to the raw string when there is no dot', () => {
    expect(prettifyType('weird')).toBe('Weird')
  })
})
