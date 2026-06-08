import { prettifyType } from '#shared/prettify'

export interface NodeCatalog { displayName(type: string): string }
export interface CatalogCache {
  get(host: string): Promise<Record<string, string> | null>
  set(host: string, map: Record<string, string>): Promise<void>
}
export interface CatalogSource {
  fetch(host: string): Promise<Record<string, string> | null>
}

export async function buildCatalog(opts: {
  host: string | null
  cache: CatalogCache
  source: CatalogSource
  bundled: Record<string, string>
}): Promise<NodeCatalog> {
  const { host, cache, source, bundled } = opts
  let live: Record<string, string> | null = null

  if (host) {
    live = await cache.get(host)
    if (!live) {
      live = await source.fetch(host)
      if (live) await cache.set(host, live)
    }
  }

  return {
    displayName(type: string): string {
      return live?.[type] ?? bundled[type] ?? prettifyType(type)
    },
  }
}
