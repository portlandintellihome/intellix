// Persistence adapter: native uses Capacitor Preferences (survives app
// updates, lives outside the WebView's localStorage which iOS can evict),
// web uses localStorage. All methods are async so callers have one
// consistent API regardless of platform.
import { Capacitor } from '@capacitor/core'

const isNative = () =>
  typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.()

export async function getItem(key) {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key })
    return value ?? null
  }
  return Promise.resolve(window.localStorage.getItem(key))
}

export async function setItem(key, value) {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key, value })
    return
  }
  return Promise.resolve(window.localStorage.setItem(key, value))
}

export async function removeItem(key) {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key })
    return
  }
  return Promise.resolve(window.localStorage.removeItem(key))
}
