// Haptic feedback adapter. Native uses @capacitor/haptics (Taptic Engine on
// iOS); web is a silent no-op. All methods are async and never throw — a
// failed/absent haptic must never break the calling interaction. The plugin
// is dynamically imported so the web bundle never loads it.
import { Capacitor } from '@capacitor/core'

const isNative = () =>
  typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.()

async function impact(style) {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle[style] })
  } catch { /* ignore — haptics are best-effort */ }
}

async function notify(type) {
  if (!isNative()) return
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType[type] })
  } catch { /* ignore */ }
}

// Subtle tap — form interactions, toggles.
export const light = () => impact('Light')
// Standard confirmation — Save, Send, primary actions.
export const medium = () => impact('Medium')
// Emphasized — Delete, Complete, irreversible actions.
export const heavy = () => impact('Heavy')
// Success notification pattern.
export const success = () => notify('Success')
// Error notification pattern.
export const error = () => notify('Error')

export default { light, medium, heavy, success, error }
