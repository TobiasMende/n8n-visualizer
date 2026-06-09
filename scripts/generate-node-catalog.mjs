#!/usr/bin/env node
// Generates server/catalog/bundled.json — the offline node type → display-name
// map used when no live n8n instance is connected (e.g. JSON upload mode).
//
// Source of truth: the compiled n8n-nodes-base package. Each node's dist file
// declares its node-level `displayName` and `name` at the top of `description`,
// before any property definitions, so the first match of each is the node's own.
//
// Usage:
//   node scripts/generate-node-catalog.mjs [path-to-n8n-nodes-base]
// Default path: ./node_modules/n8n-nodes-base
// To refresh from a specific version without installing it:
//   cd /tmp && npm pack n8n-nodes-base@<ver> && tar -xzf n8n-nodes-base-*.tgz
//   node scripts/generate-node-catalog.mjs /tmp/package

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const pkgDir = process.argv[2] ?? join(root, '..', 'node_modules', 'n8n-nodes-base')
const outFile = join(root, '..', 'server', 'catalog', 'bundled.json')

const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
const nodeFiles = pkg.n8n?.nodes ?? []
if (!nodeFiles.length) {
  console.error(`No n8n.nodes entries in ${pkgDir}/package.json`)
  process.exit(1)
}

const QUOTED = `['"]((?:[^'"\\\\]|\\\\.)*)['"]`
const unescape = (s) => s.replace(/\\(['"\\])/g, '$1')

const map = {}
let skipped = 0
for (const rel of nodeFiles) {
  let text
  try {
    text = readFileSync(join(pkgDir, rel), 'utf8')
  } catch {
    skipped++
    continue
  }
  // Node-level displayName comes first in `description`; the node `name`
  // follows it (property-level name/displayName appear later, in `properties`).
  const dn = text.match(new RegExp(`displayName:\\s*${QUOTED}`))
  if (!dn) { skipped++; continue }
  const after = text.slice(dn.index + dn[0].length)
  const nm = after.match(new RegExp(`\\bname:\\s*${QUOTED}`))
  if (!nm) { skipped++; continue }
  map[`n8n-nodes-base.${unescape(nm[1])}`] = unescape(dn[1])
}

// Curated overrides — keep names matching the current n8n editor UI where the
// compiled base description lags (e.g. versioned nodes).
const overrides = {
  'n8n-nodes-base.set': 'Edit Fields (Set)',
  'n8n-nodes-base.executeWorkflow': 'Execute Sub-workflow',
  // Modular versioned nodes whose description lives in a separate file the
  // first-match heuristic can't see — filled in by hand.
  'n8n-nodes-base.bambooHr': 'BambooHR',
  'n8n-nodes-base.oracleDatabase': 'Oracle Database',
  'n8n-nodes-base.theHiveProject': 'TheHive 5',
}
Object.assign(map, overrides)

const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]))
writeFileSync(outFile, JSON.stringify(sorted, null, 2) + '\n')
console.log(`Wrote ${Object.keys(sorted).length} nodes to ${outFile} (skipped ${skipped})`)
