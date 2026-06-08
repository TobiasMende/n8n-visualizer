import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CatalogCache } from './catalog'

const TTL_MS = 7 * 24 * 60 * 60 * 1000
const DIR = '.cache'

function safe(host: string): string {
  return host.replace(/[^a-z0-9.-]/gi, '_')
}

export function diskCatalogCache(): CatalogCache {
  return {
    async get(host) {
      try {
        const raw = await readFile(join(DIR, `node-catalog-${safe(host)}.json`), 'utf8')
        const parsed = JSON.parse(raw) as { savedAt: number; map: Record<string, string> }
        if (Date.now() - parsed.savedAt > TTL_MS) return null
        return parsed.map
      } catch {
        return null
      }
    },
    async set(host, map) {
      try {
        await mkdir(DIR, { recursive: true })
        await writeFile(
          join(DIR, `node-catalog-${safe(host)}.json`),
          JSON.stringify({ savedAt: Date.now(), map }),
        )
      } catch {
        // cache write is best-effort
      }
    },
  }
}
