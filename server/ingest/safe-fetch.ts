import { lookup as dnsLookup } from 'node:dns/promises'
import { Agent, fetch as undiciFetch } from 'undici'

export type SafeFetchErrorKind =
  | 'invalid_url'
  | 'blocked'
  | 'unreachable'
  | 'too_large'
  | 'too_many_redirects'

export class SafeFetchError extends Error {
  constructor(public kind: SafeFetchErrorKind, message: string) {
    super(message)
    this.name = 'SafeFetchError'
  }
}

const MAX_REDIRECTS = 3
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024 // 10 MB

export function assertSafeUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new SafeFetchError('invalid_url', 'URL is not valid')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    throw new SafeFetchError('invalid_url', 'Only http(s) URLs are allowed')
  if (u.username || u.password)
    throw new SafeFetchError('invalid_url', 'Embedded credentials are not allowed')
  return u
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const o = Number(p)
    if (o > 255) return null
    n = n * 256 + o
  }
  return n >>> 0
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → treat as unsafe
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)!
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (n & mask) === (b & mask)
  }
  return (
    inRange('0.0.0.0', 8) ||        // this-network / unspecified
    inRange('10.0.0.0', 8) ||       // private
    inRange('100.64.0.0', 10) ||    // CGNAT
    inRange('127.0.0.0', 8) ||      // loopback
    inRange('169.254.0.0', 16) ||   // link-local + cloud metadata
    inRange('172.16.0.0', 12) ||    // private
    inRange('192.0.0.0', 24) ||     // IETF protocol assignments
    inRange('192.168.0.0', 16) ||   // private
    inRange('198.18.0.0', 15) ||    // benchmarking
    inRange('224.0.0.0', 4) ||      // multicast
    inRange('240.0.0.0', 4)         // reserved / broadcast
  )
}

export function isBlockedIp(ip: string): boolean {
  const addr = ip.trim()
  if (!addr) return true

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) return isBlockedIpv4(addr)

  // Anything that is not a dotted-quad and has no colon is not a valid IP
  // literal — treat as unsafe rather than assume it is fine.
  if (!addr.includes(':')) return true

  // IPv6 (may be zone-suffixed or IPv4-mapped)
  const bare = addr.split('%')[0].toLowerCase()

  // IPv4-mapped / -embedded (e.g. ::ffff:127.0.0.1, ::127.0.0.1)
  const mappedV4 = bare.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/)
  if (mappedV4) return isBlockedIpv4(mappedV4[1])

  if (bare === '::1') return true // loopback
  if (bare === '::' || bare === '') return true // unspecified

  if (bare.startsWith('fc') || bare.startsWith('fd')) return true // fc00::/7 unique-local
  if (/^fe[89ab]/.test(bare)) return true // fe80::/10 link-local
  if (bare.startsWith('ff')) return true // ff00::/8 multicast

  return false
}

export interface ResolvedAddr { address: string; family: number }

// Resolver returns raw addresses for a hostname (no validation). Injectable for
// tests; production default uses node DNS.
export type Resolver = (hostname: string) => Promise<ResolvedAddr[]>

const defaultResolver: Resolver = async (hostname) => {
  try {
    return await dnsLookup(hostname, { all: true })
  } catch {
    throw new SafeFetchError('unreachable', 'Host could not be resolved')
  }
}

async function resolveAndValidate(hostname: string, resolve: Resolver): Promise<ResolvedAddr[]> {
  const addrs = await resolve(hostname)
  if (!addrs.length) throw new SafeFetchError('unreachable', 'Host could not be resolved')
  for (const a of addrs)
    if (isBlockedIp(a.address))
      throw new SafeFetchError('blocked', 'Host resolves to a disallowed address')
  return addrs
}

// Pins the connection to the already-validated IP so a DNS rebind between
// validation and connect cannot swap in a private address.
function pinnedAgent(addrs: ResolvedAddr[]): Agent {
  return new Agent({
    connect: {
      lookup(_hostname: string, options: any, cb: any) {
        const a = addrs[0]
        if (options && options.all) cb(null, [{ address: a.address, family: a.family }])
        else cb(null, a.address, a.family)
      },
    },
  })
}

// Performs the actual HTTP request pinned to validated IPs. Injectable for tests.
export type PinnedFetch = (url: URL, init: { headers?: Record<string, string>; signal?: AbortSignal; addrs: ResolvedAddr[] }) => Promise<Response>

// Use undici's own fetch (not the global) so the dispatcher and the request
// handler come from the same undici version — mixing a separately-installed
// undici Agent with Node's built-in fetch throws "invalid onRequestStart".
const defaultPinnedFetch: PinnedFetch = async (url, init) => {
  const agent = pinnedAgent(init.addrs)
  try {
    return (await undiciFetch(url, {
      headers: init.headers,
      signal: init.signal,
      redirect: 'manual',
      dispatcher: agent,
    })) as unknown as Response
  } finally {
    agent.close().catch(() => {})
  }
}

async function readCapped(res: Response, cap: number): Promise<string> {
  const lenHeader = res.headers.get('content-length')
  if (lenHeader && Number(lenHeader) > cap)
    throw new SafeFetchError('too_large', 'Response exceeds size limit')

  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    if (received > cap) {
      await reader.cancel()
      throw new SafeFetchError('too_large', 'Response exceeds size limit')
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(received)
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.length }
  return new TextDecoder().decode(buf)
}

export interface SafeResponse {
  status: number
  ok: boolean
  headers: Headers
  text(): Promise<string>
  json(): Promise<any>
}

export interface SafeFetchOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
  maxResponseBytes?: number
}

export interface SafeFetchDeps {
  resolve?: Resolver
  fetchImpl?: PinnedFetch
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308])

export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {},
  deps: SafeFetchDeps = {},
): Promise<SafeResponse> {
  const cap = opts.maxResponseBytes ?? MAX_RESPONSE_BYTES
  const resolve = deps.resolve ?? defaultResolver
  const doFetch = deps.fetchImpl ?? defaultPinnedFetch
  let url = assertSafeUrl(rawUrl)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const addrs = await resolveAndValidate(url.hostname, resolve)
    const res = await doFetch(url, { headers: opts.headers, signal: opts.signal, addrs })

    if (REDIRECT_CODES.has(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) return toSafeResponse(res, cap)
      url = assertSafeUrl(new URL(loc, url).toString())
      continue
    }

    return toSafeResponse(res, cap)
  }

  throw new SafeFetchError('too_many_redirects', 'Too many redirects')
}

function toSafeResponse(res: Response, cap: number): SafeResponse {
  let cached: string | null = null
  const body = async () => {
    if (cached === null) cached = await readCapped(res, cap)
    return cached
  }
  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    text: body,
    json: async () => JSON.parse(await body()),
  }
}
