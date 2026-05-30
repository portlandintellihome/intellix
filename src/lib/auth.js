// Auth token access.
//
// Why this exists: the token is read SYNCHRONOUSLY in ~20 places across the
// app (e.g. `authHeaders()` spread inline into a fetch's headers object).
// Capacitor Preferences — the durable native store we want on iOS — is
// async-only. To get durable native persistence without rewriting every
// call site (and every transitive fetch helper) to be async, we keep an
// in-memory cache that is hydrated once at boot via initToken(), expose a
// synchronous getToken() for those call sites, and write through to the
// persistence adapter on set/clear.
import { Capacitor } from '@capacitor/core'
import * as storage from './storage'

export const TOKEN_KEY = 'intellix_token'

let cachedToken = null

const isNative = () =>
  typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.()

// Hydrate the in-memory token from durable storage. Must be awaited at boot
// before any authenticated request is made. On native it also performs a
// one-time migration of a token previously kept in the WebView's
// localStorage into Preferences, so users who logged in before this change
// aren't silently signed out on their first launch of the native build.
export async function initToken() {
  if (isNative()) {
    let token = await storage.getItem(TOKEN_KEY) // Preferences on native
    if (!token) {
      const legacy = window.localStorage.getItem(TOKEN_KEY)
      if (legacy) {
        await storage.setItem(TOKEN_KEY, legacy) // copy into Preferences
        window.localStorage.removeItem(TOKEN_KEY)
        token = legacy
      }
    }
    cachedToken = token
  } else {
    cachedToken = await storage.getItem(TOKEN_KEY) // localStorage on web
  }
  return cachedToken
}

// Synchronous read for the many inline fetch-header call sites.
export function getToken() {
  return cachedToken
}

// Authorization header helper — returns {} when unauthenticated so it can be
// spread unconditionally into a headers object.
export function authHeader() {
  return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {}
}

export async function setToken(token) {
  cachedToken = token
  await storage.setItem(TOKEN_KEY, token)
}

export async function clearToken() {
  cachedToken = null
  await storage.removeItem(TOKEN_KEY)
}
