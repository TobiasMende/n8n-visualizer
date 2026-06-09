import { describe, it, expect } from 'vitest'
import { originsMatch } from './origin'

describe('originsMatch', () => {
  it('allows a missing Origin header (non-browser / same-origin nav)', () => {
    expect(originsMatch(undefined, 'https://app.example.com')).toBe(true)
    expect(originsMatch('', 'https://app.example.com')).toBe(true)
  })
  it('allows an exact same-origin match', () => {
    expect(originsMatch('https://app.example.com', 'https://app.example.com')).toBe(true)
  })
  it('rejects a different origin', () => {
    expect(originsMatch('https://evil.example.com', 'https://app.example.com')).toBe(false)
    expect(originsMatch('http://app.example.com', 'https://app.example.com')).toBe(false)
  })
  it('rejects an unparseable Origin', () => {
    expect(originsMatch('not-a-url', 'https://app.example.com')).toBe(false)
  })
  it('treats the Origin host as case-insensitive (URL-normalised)', () => {
    expect(originsMatch('https://APP.EXAMPLE.COM', 'https://app.example.com')).toBe(true)
  })
  it('rejects a port mismatch', () => {
    expect(originsMatch('https://app.example.com:8443', 'https://app.example.com')).toBe(false)
  })
})
