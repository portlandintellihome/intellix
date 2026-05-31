// One-off: generate icon/splash source images for @capacitor/assets.
// Run from the project root so `sharp` resolves from node_modules.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const BLUE = '#0066cc'
const DARK = '#1d1d1f'
mkdirSync('assets', { recursive: true })

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#ffffff"/>
  <text x="512" y="512" font-family="Montserrat, 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="760" fill="${BLUE}" text-anchor="middle" dominant-baseline="central">x</text>
</svg>`
await sharp(Buffer.from(iconSvg)).png().toFile('assets/icon-source.png')
console.log('wrote assets/icon-source.png')

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#ffffff"/>
  <text x="1366" y="1366" font-family="Montserrat, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="340" text-anchor="middle" dominant-baseline="central"><tspan fill="${DARK}">intelli</tspan><tspan fill="${BLUE}">x</tspan></text>
</svg>`
await sharp(Buffer.from(splashSvg)).png().toFile('assets/splash-source.png')
console.log('wrote assets/splash-source.png')
