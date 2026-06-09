import type { CatalogSource } from './catalog'
import { stripTrailingSlash } from '#shared/url'

// Best-effort: try the instance's node-types description endpoint.
// Many instances will reject this without editor session auth — that's fine,
// we return null and the resolver falls back to bundled + prettify.
export function instanceCatalogSource(baseUrl: string, apiKey: string): CatalogSource {
  const base = stripTrailingSlash(baseUrl)
  return {
    async fetch(_host) {
      try {
        const res = await fetch(`${base}/types/nodes.json`, {
          headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return null
        const list = (await res.json()) as Array<{ name?: string; displayName?: string }>
        if (!Array.isArray(list)) return null
        const map: Record<string, string> = {}
        for (const n of list) if (n?.name && n?.displayName) map[n.name] = n.displayName
        return Object.keys(map).length ? map : null
      } catch {
        return null
      }
    },
  }
}
