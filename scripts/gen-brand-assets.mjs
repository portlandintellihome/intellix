// One-off: generate icon/splash source images for @capacitor/assets.
// Run from the project root so `sharp` resolves from node_modules.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const BLUE = '#0066cc'
const DARK = '#1d1d1f'
mkdirSync('assets', { recursive: true })

// App icon: a lowercase "x" has no ascenders/descenders, so SVG baseline
// alignment (even dominant-baseline:central) leaves it visually low/off. To
// center it independent of font metrics, render the glyph alone on a
// transparent canvas, trim to its true bounding box, then composite it dead
// center on the white 1024 square via gravity:'center'.
const ICON = 1024
const glyphPng = await sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${ICON}">
     <text x="50%" y="50%" font-family="Montserrat, 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="760" fill="${BLUE}" text-anchor="middle" dominant-baseline="central">x</text>
   </svg>`
)).png().toBuffer()

// Trim to the glyph's true bbox, then scale it up so its longest dimension
// fills ~70% of the canvas (TARGET px, ~150px margin/side) — the rendered
// glyph only occupied ~40%, leaving too much padding.
const TARGET = 720
const glyphTrimmed = await sharp(glyphPng).trim().toBuffer()
const glyphScaled = await sharp(glyphTrimmed)
  .resize({ width: TARGET, height: TARGET, fit: 'inside' })
  .toBuffer()

await sharp({ create: { width: ICON, height: ICON, channels: 4, background: '#ffffff' } })
  .composite([{ input: glyphScaled, gravity: 'center' }])
  .png()
  .toFile('assets/icon-source.png')
console.log('wrote assets/icon-source.png (trimmed + scaled to ~70% + center-composited)')

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#ffffff"/>
  <text x="1366" y="1366" font-family="Montserrat, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="340" text-anchor="middle" dominant-baseline="central"><tspan fill="${DARK}">intelli</tspan><tspan fill="${BLUE}">x</tspan></text>
</svg>`
await sharp(Buffer.from(splashSvg)).png().toFile('assets/splash-source.png')
console.log('wrote assets/splash-source.png')
