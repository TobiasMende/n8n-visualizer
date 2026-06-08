import { describe, it, expect } from 'vitest'
import { saveConnection, loadConnection, clearConnection, hostOf } from './useConnectionStorage'

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
    key: () => null, length: 0,
  } as Storage
}

describe('connection storage', () => {
  it('saves and loads a connection', () => {
    const s = fakeStorage()
    saveConnection(s, { baseUrl: 'https://h', apiKey: 'k' })
    expect(loadConnection(s)).toEqual({ baseUrl: 'https://h', apiKey: 'k' })
  })
  it('returns null when nothing saved or value is malformed', () => {
    const s = fakeStorage()
    expect(loadConnection(s)).toBeNull()
    s.setItem('n8nviz.conn', '{bad json')
    expect(loadConnection(s)).toBeNull()
    s.setItem('n8nviz.conn', '{"baseUrl":"h"}')
    expect(loadConnection(s)).toBeNull()
  })
  it('clears a connection', () => {
    const s = fakeStorage()
    saveConnection(s, { baseUrl: 'https://h', apiKey: 'k' })
    clearConnection(s)
    expect(loadConnection(s)).toBeNull()
  })
  it('hostOf extracts the host, falling back to the raw string', () => {
    expect(hostOf('https://n8n.example.com/x')).toBe('n8n.example.com')
    expect(hostOf('not a url')).toBe('not a url')
  })
})
