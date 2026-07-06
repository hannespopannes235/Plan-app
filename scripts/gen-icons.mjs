// Erzeugt die PWA-Icons (PNG) ohne externe Abhängigkeiten.
// Zeichnet das „Plan"-Logo: amber-farbenes, abgerundetes Quadrat mit weißer Karte.
//   node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

function hexToRgb(hex) {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

// Abstand eines Punktes von einem abgerundeten Rechteck (für Anti-Aliasing-freie Maske)
function insideRoundedRect(x, y, x0, y0, w, h, r) {
  const dx = Math.max(x0 - x, 0, x - (x0 + w));
  const dy = Math.max(y0 - y, 0, y - (y0 + h));
  // Eckenradius
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r);
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
  const inCornerBox =
    (x < x0 + r || x > x0 + w - r) && (y < y0 + r || y > y0 + h - r);
  if (dx > 0 || dy > 0) return false;
  if (inCornerBox) {
    const dist = Math.hypot(x - cx, y - cy);
    return dist <= r;
  }
  return true;
}

function renderIcon(size) {
  const bg = hexToRgb("#f59e0b");
  const card = hexToRgb("#fffbf5");
  const clip = hexToRgb("#d97706");
  const line = hexToRgb("#f59e0b");

  const data = Buffer.alloc(size * size * 4);
  const s = size / 64; // Skalierung relativ zum 64er-Design

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r, g, b, a = 255;
      const ux = x / s;
      const uy = y / s;

      // Hintergrund-Quadrat (rund)
      if (insideRoundedRect(ux, uy, 0, 0, 64, 64, 16)) {
        [r, g, b] = bg;
      } else {
        r = g = b = 0;
        a = 0;
      }

      // Weiße Karte
      if (insideRoundedRect(ux, uy, 16, 12, 32, 40, 6)) {
        [r, g, b] = card;
      }
      // Clip oben
      if (insideRoundedRect(ux, uy, 24, 8, 16, 8, 4)) {
        [r, g, b] = clip;
      }
      // Linien
      const onLine = (ly, lx0, lx1) => uy >= ly - 1.5 && uy <= ly + 1.5 && ux >= lx0 && ux <= lx1;
      if (onLine(26, 23, 41) || onLine(34, 23, 41) || onLine(42, 23, 34)) {
        [r, g, b] = line;
      }

      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return data;
}

// --- Minimaler PNG-Encoder (RGBA, 8-bit) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rest 0

  // Scanlines mit Filter-Byte 0
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ["pwa-192x192.png", 192],
  ["pwa-512x512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const png = encodePNG(size, renderIcon(size));
  writeFileSync(resolve(publicDir, name), png);
  console.log(`✓ ${name} (${size}×${size}, ${png.length} Bytes)`);
}
