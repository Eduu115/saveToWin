import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Marca saveToWin (cuadrado terracota + arco) a PNG, sin dependencias. */

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([len, name, data, crc])
}

function png(size, rgba) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1)
    raw[row] = 0
    rgba.copy(raw, row + 1, y * stride, y * stride + stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [0xa8, 0x47, 0x1c]
const FG = [0xff, 0xfd, 0xfa]

function smooth(sd) {
  return Math.max(0, Math.min(1, 0.5 - sd))
}

/** `maskable` llena el cuadrado (Android recorta en círculo). */
function draw(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4)
  const s = size / 512
  const radius = 112 * s
  const cx = 256 * s
  const cy = 256 * s
  const ring = 148 * s
  const stroke = 36 * s
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const qx = Math.abs(px - size / 2) - (size / 2 - radius)
      const qy = Math.abs(py - size / 2) - (size / 2 - radius)
      const box =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
      const cover = maskable ? 1 : smooth(box)
      if (cover <= 0) continue
      const dist = Math.hypot(px - cx, py - cy)
      const ringSd = Math.abs(dist - ring) - stroke / 2
      const onRing = smooth(ringSd)
      const angle = Math.atan2(py - cy, px - cx)
      const arc = angle >= -Math.PI / 2 && angle <= 0.08 ? 1 : 0.35
      const ink = onRing * arc
      const i = (y * size + x) * 4
      rgba[i] = Math.round(BG[0] * (1 - ink) + FG[0] * ink)
      rgba[i + 1] = Math.round(BG[1] * (1 - ink) + FG[1] * ink)
      rgba[i + 2] = Math.round(BG[2] * (1 - ink) + FG[2] * ink)
      rgba[i + 3] = Math.round(cover * 255)
    }
  }
  return png(size, rgba)
}

function write(path, size, maskable = false) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, draw(size, maskable))
}

write('web/public/icons/icon-192.png', 192)
write('web/public/icons/icon-512.png', 512)
write('web/public/icons/icon-maskable.png', 512, true)
write('web/public/icons/apple-touch-icon.png', 180)
write('extension/icons/icon-16.png', 16)
write('extension/icons/icon-32.png', 32)
write('extension/icons/icon-48.png', 48)
write('extension/icons/icon-128.png', 128)
