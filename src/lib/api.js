import { authHeader, clearToken, getToken } from './auth'

const BASE = import.meta.env.VITE_API_URL || ''

// Every /api data route requires a login (server/middleware/apiGate.js), so
// this always sends the session token. A 401 means the session is gone or
// expired: drop the token and reload, which lands on the login screen instead
// of leaving the page silently empty.
export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeader() })
  if (res.status === 401 && getToken()) {
    await clearToken()
    window.location.reload()
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
