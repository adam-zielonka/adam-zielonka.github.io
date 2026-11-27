#!/usr/bin/env node
// Generates the CRT displacement map used by the SVG filters in index.html.
//
//   node scripts/crt-map.mjs            prints the data URI
//   node scripts/crt-map.mjs --write    also replaces every feImage map in index.html
//
// Each pixel samples the normalized position at its centre, x = (i + 0.5) / N * 2 - 1,
// which is how browsers stretch and sample a feImage. R encodes 0.5 + 0.5 * x * y²
// and G encodes 0.5 + 0.5 * y * x², so both axes stay straight and the corners bend
// inward. Beyond the outermost pixel centres (|x| > 16/17) browsers clamp the map, so
// the outer 3% of each edge keeps the edge value: at the 8 px text-mode cap the
// extreme corners bend up to about 0.8 px less than the model, which no one sees.
// Only IHDR, IDAT and IEND are written: without gAMA, sRGB or iCCP chunks, colour
// management cannot shift the encoded values.
import { readFileSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const SIZE = 17;

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

export function displacementMap(size = SIZE) {
  const stride = 1 + 3 * size;
  const raw = Buffer.alloc(size * stride);
  for (let row = 0; row < size; row++) {
    const y = ((row + 0.5) / size) * 2 - 1;
    // Filter type 0: every scanline is stored as is.
    raw[row * stride] = 0;
    for (let column = 0; column < size; column++) {
      const x = ((column + 0.5) / size) * 2 - 1;
      const offset = row * stride + 1 + 3 * column;
      raw[offset] = Math.round(127.5 + 127.5 * x * y * y);
      raw[offset + 1] = Math.round(127.5 + 127.5 * y * x * x);
      raw[offset + 2] = 0;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const uri = `data:image/png;base64,${displacementMap().toString("base64")}`;
console.log(uri);

if (process.argv.includes("--write")) {
  const path = new URL("../index.html", import.meta.url);
  const html = readFileSync(path, "utf8");
  let count = 0;
  const updated = html.replace(
    /(<feImage\b[^>]*?\bhref=")[^"]*(")/g,
    (_match, start, end) => {
      count++;
      return `${start}${uri}${end}`;
    },
  );
  writeFileSync(path, updated);
  console.error(`Updated ${count} feImage map(s) in index.html.`);
}
