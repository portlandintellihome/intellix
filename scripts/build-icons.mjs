import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '..', 'public')
const svg = readFileSync(resolve(publicDir, 'icon.svg'))

const sizes = [192, 512]

for (const size of sizes) {
  const out = resolve(publicDir, `icon-${size}.png`)
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(out)
  console.log(`wrote ${out}`)
}
