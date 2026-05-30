// Photo capture adapter. Native uses the Capacitor Camera plugin (lets the
// user pick Take Photo or Choose from Library); web falls back to a hidden
// <input type="file" accept="image/*" capture="environment">. Both paths
// resolve to the same shape — { dataUrl } — so callers don't branch on
// platform. Resolves to null if the user cancels.
import { Capacitor } from '@capacitor/core'

const isNative = () =>
  typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.()

async function capturePhotoNative() {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt, // user chooses camera vs photo library
      quality: 80,
    })
    return photo?.dataUrl ? { dataUrl: photo.dataUrl } : null
  } catch {
    // Plugin throws on user cancel — treat as "no photo".
    return null
  }
}

function capturePhotoWeb() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => resolve({ dataUrl: String(reader.result) })
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    // No reliable cross-browser "cancel" event for file inputs; if the user
    // dismisses the picker the promise simply never resolves, which is fine
    // (the caller's await just doesn't proceed).
    input.click()
  })
}

// Returns Promise<{ dataUrl: string } | null>.
export function capturePhoto() {
  return isNative() ? capturePhotoNative() : capturePhotoWeb()
}

// Convert a data URL to a Blob for multipart/form-data uploads (the Support
// backend expects a file part, not a base64 string).
export function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(meta)?.[1] || 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
