/**
 * Empaqueta la extensión con los archivos en la raíz del zip
 * (formato que piden Chrome Web Store y `web-ext`).
 *
 *   node scripts/pack-extension.mjs
 *   → web/public/savetowin-extension.zip
 *   → extension/dist/savetowin-extension.zip
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const src = join(root, 'extension')
const outDir = join(root, 'extension', 'dist')
const publicZip = join(root, 'web', 'public', 'savetowin-extension.zip')
const distZip = join(outDir, 'savetowin-extension.zip')

mkdirSync(outDir, { recursive: true })
mkdirSync(join(root, 'web', 'public'), { recursive: true })

const staging = mkdtempSync(join(tmpdir(), 'stw-ext-'))
const files = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'popup.js',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
]

for (const file of files) {
  const dest = join(staging, file)
  mkdirSync(join(dest, '..'), { recursive: true })
  copyFileSync(join(src, file), dest)
}

rmSync(distZip, { force: true })
rmSync(publicZip, { force: true })

const zip = spawnSync('zip', ['-r', distZip, '.', '-x', '*.DS_Store'], {
  cwd: staging,
  stdio: 'inherit',
})
if (zip.status !== 0) process.exit(zip.status ?? 1)

copyFileSync(distZip, publicZip)
rmSync(staging, { recursive: true, force: true })
console.log('ok', distZip)
console.log('ok', publicZip)
