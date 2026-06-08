import { describe, it, expect, vi } from 'vitest'
import { buildCatalog } from './catalog'
import type { CatalogCache, CatalogSource } from './catalog'

const bundled = { 'n8n-nodes-base.set': 'Edit Fields (Set)' }
const noCache: CatalogCache = { get: async () => null, set: async () => {} }
const noSource: CatalogSource = { fetch: async () => null }

describe('buildCatalog', () => {
  it('prefers a cached map', async () => {
    const cache: CatalogCache = { get: async () => ({ 'n8n-nodes-base.foo': 'Cached Foo' }), set: async () => {} }
    const cat = await buildCatalog({ host: 'h', cache, source: noSource, bundled })
    expect(cat.displayName('n8n-nodes-base.foo')).toBe('Cached Foo')
  })

  it('fetches live when no cache, and writes it back', async () => {
    const set = vi.fn(async () => {})
    const cache: CatalogCache = { get: async () => null, set }
    const source: CatalogSource = { fetch: async () => ({ 'n8n-nodes-base.bar': 'Live Bar' }) }
    const cat = await buildCatalog({ host: 'h', cache, source, bundled })
    expect(cat.displayName('n8n-nodes-base.bar')).toBe('Live Bar')
    expect(set).toHaveBeenCalledWith('h', { 'n8n-nodes-base.bar': 'Live Bar' })
  })

  it('falls back to bundled, then to prettify', async () => {
    const cat = await buildCatalog({ host: null, cache: noCache, source: noSource, bundled })
    expect(cat.displayName('n8n-nodes-base.set')).toBe('Edit Fields (Set)')   // bundled
    expect(cat.displayName('n8n-nodes-base.httpRequest')).toBe('HTTP Request') // prettify
  })

  it('does not fetch when host is null', async () => {
    const fetch = vi.fn(async () => null)
    await buildCatalog({ host: null, cache: noCache, source: { fetch }, bundled })
    expect(fetch).not.toHaveBeenCalled()
  })
})
