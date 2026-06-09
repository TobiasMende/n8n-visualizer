import { getCookie, unsealSession, useSession, clearSession, type H3Event } from 'h3'
import type { SessionData } from './creds'

const COOKIE_NAME = 'n8nviz_sess'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface AppSessionConfig {
  password: string
  name: string
  maxAge: number
  cookie: { httpOnly: true; secure: boolean; sameSite: 'strict'; maxAge: number }
}

export function sessionConfig(password: string, dev: boolean): AppSessionConfig {
  return {
    password,
    name: COOKIE_NAME,
    maxAge: MAX_AGE,
    cookie: { httpOnly: true, secure: !dev, sameSite: 'strict', maxAge: MAX_AGE },
  }
}

// Read without side effects: never sets a cookie just to check status.
export async function readSession(event: H3Event, config: AppSessionConfig): Promise<SessionData | null> {
  const sealed = getCookie(event, config.name)
  if (!sealed) return null
  try {
    const { data } = await unsealSession(event, config, sealed)
    return data && typeof data.baseUrl === 'string' && typeof data.apiKey === 'string'
      ? { baseUrl: data.baseUrl, apiKey: data.apiKey }
      : null
  } catch {
    return null // rotated password / tampered cookie -> treat as not connected
  }
}

export async function writeSession(event: H3Event, config: AppSessionConfig, data: SessionData): Promise<void> {
  const session = await useSession<SessionData>(event, config)
  await session.update(data)
}

export async function destroySession(event: H3Event, config: AppSessionConfig): Promise<void> {
  await clearSession(event, config)
}
