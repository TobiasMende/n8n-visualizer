export interface Conn { baseUrl: string; apiKey: string }
const KEY = 'n8nviz.conn'

export function saveConnection(s: Storage, conn: Conn): void {
  s.setItem(KEY, JSON.stringify(conn))
}

export function loadConnection(s: Storage): Conn | null {
  try {
    const raw = s.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    return (p && typeof p.baseUrl === 'string' && typeof p.apiKey === 'string') ? p : null
  } catch {
    return null
  }
}

export function clearConnection(s: Storage): void {
  s.removeItem(KEY)
}

export function hostOf(baseUrl: string): string {
  try { return new URL(baseUrl).host } catch { return baseUrl }
}
