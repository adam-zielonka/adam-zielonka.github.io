// Original 32 px artwork, using the classic Windows 16-color palette plus
// two grays for raised edges. All geometry lands on whole pixels; no fonts,
// external assets, filters or shared SVG IDs are needed.
const palette = {
  black: "#000000",
  charcoal: "#404040",
  gray: "#808080",
  silver: "#c0c0c0",
  light: "#dfdfdf",
  white: "#ffffff",
  navy: "#000080",
  blue: "#0000ff",
  teal: "#008080",
  cyan: "#00ffff",
  green: "#008000",
  lime: "#00ff00",
  maroon: "#800000",
  red: "#ff0000",
  olive: "#808000",
  yellow: "#ffff00",
  purple: "#800080",
  magenta: "#ff00ff",
} as const;

const p = palette;
const art = (...parts: string[]) => parts.join("");

function rect(x: number, y: number, w: number, h: number, fill: string) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

function path(d: string, fill: string) {
  return `<path d="${d}" fill="${fill}"/>`;
}

function bevel(
  x: number,
  y: number,
  w: number,
  h: number,
  face: string = p.silver,
  light: string = p.white,
  shade: string = p.gray,
) {
  if (w < 5 || h < 5) {
    return art(
      rect(x, y, w, h, p.black),
      rect(x, y, w - 1, 1, light),
      rect(x, y, 1, h - 1, light),
      rect(x + 1, y + 1, w - 2, h - 2, face),
    );
  }
  return art(
    rect(x, y, w, h, p.black),
    rect(x + 1, y + 1, w - 2, h - 2, light),
    rect(x + 2, y + 2, w - 3, h - 3, shade),
    rect(x + 2, y + 2, w - 4, h - 4, face),
  );
}

function windowFrame(
  x: number,
  y: number,
  w: number,
  h: number,
  face: string = p.white,
) {
  return art(
    rect(x + 2, y + 2, w, h, p.charcoal),
    bevel(x, y, w, h),
    rect(x + 2, y + 2, w - 4, h - 4, face),
    rect(x + 2, y + 2, w - 4, 4, p.navy),
    rect(x + w - 6, y + 3, 3, 2, p.silver),
    rect(x + 3, y + 3, 3, 2, p.white),
  );
}

// Small hand-set glyphs stay legible without relying on a system font.
function pixels(
  rows: readonly string[],
  x: number,
  y: number,
  fill: string,
  size = 1,
) {
  return rows
    .flatMap((row, dy) =>
      [...row].map((cell, dx) =>
        cell === "#"
          ? rect(x + dx * size, y + dy * size, size, size, fill)
          : "",
      ),
    )
    .join("");
}

const documentIcon = art(
  path("M8 4h13v1h2v2h2v2h2v22H8Z", p.charcoal),
  path("M5 1h14v2h2v2h2v2h2v22H5Z", p.black),
  path("M6 2h12v7h6v19H6Z", p.white),
  rect(7, 26, 16, 2, p.silver),
  path("M18 2h1v2h2v2h2v2h-5Z", p.silver),
  rect(9, 12, 11, 1, p.navy),
  rect(9, 16, 12, 1, p.gray),
  rect(9, 19, 10, 1, p.gray),
  rect(9, 22, 12, 1, p.gray),
);

const icons: Readonly<Record<string, string>> = {
  computer: art(
    rect(6, 4, 24, 21, p.charcoal),
    bevel(3, 1, 24, 22),
    rect(6, 4, 18, 15, p.gray),
    rect(7, 5, 17, 14, p.black),
    rect(8, 6, 15, 11, p.teal),
    rect(10, 8, 8, 6, p.silver),
    rect(11, 9, 6, 1, p.navy),
    rect(11, 11, 5, 2, p.white),
    rect(21, 20, 2, 1, p.lime),
    rect(12, 23, 7, 3, p.gray),
    rect(11, 24, 7, 2, p.silver),
    bevel(1, 26, 29, 5),
    rect(4, 28, 13, 1, p.gray),
    rect(21, 28, 5, 1, p.black),
  ),
  folder: art(
    path("M4 9h12v3h15v17H4Z", p.charcoal),
    path("M2 5h11v1h2v3h14v18H2Z", p.black),
    path("M3 6h9v1h2v3h14v15H3Z", p.olive),
    path("M3 6h9v1h1v4H3Z", p.yellow),
    rect(4, 12, 23, 2, p.yellow),
    path("M1 13h23v-1h7v5h-1v5h-1v5H1Z", p.black),
    path("M2 14h23v-1h5v3h-1v5h-1v5H2Z", p.yellow),
    rect(3, 14, 21, 1, p.white),
    rect(2, 25, 26, 1, p.olive),
  ),
  games: art(
    path("M5 22h22v2h4v6H5Z", p.charcoal),
    path("M5 18h20v2h3v2h2v7H2v-7h1v-2h2Z", p.black),
    path("M6 19h18v2h3v2h2v4H3v-4h1v-2h2Z", p.silver),
    path("M6 19h18v1H6v2H4v2H3v-2h1v-2h2Z", p.white),
    rect(3, 25, 26, 2, p.gray),
    rect(11, 9, 5, 13, p.black),
    rect(12, 10, 2, 11, p.gray),
    path("M10 2h7v1h2v2h1v5h-2v2h-9v-2H7V5h1V3h2Z", p.black),
    path("M10 3h7v1h1v2h1v3h-2v2h-7V9H8V5h2Z", p.maroon),
    rect(10, 3, 6, 5, p.red),
    rect(10, 4, 2, 2, p.white),
    bevel(21, 21, 5, 4, p.red, p.white, p.maroon),
    rect(6, 23, 3, 1, p.black),
  ),
  tools: art(
    path(
      "M23 2h6v7h-2v3h-4v3h-3v3h-3v3h-3v3h-3v5H6v-1H4v-5h3v-3h3v-3h3v-3h3v-3h2V5h2V3h3Z",
      p.charcoal,
    ),
    path(
      "M21 1h5v2h-3v4h4V4h2v6h-2v2h-5v3h-3v3h-3v3h-3v3h-3v4H5v-1H3v-5h3v-3h3v-3h3v-3h3v-3h2V5h2V3h2Z",
      p.black,
    ),
    path(
      "M20 4h2v4h5v2h-6v3h-3v3h-3v3h-3v3H9v4H5v-3h2v-3h3v-3h3v-3h3v-3h3V5h1Z",
      p.silver,
    ),
    path(
      "M5 23h2v2H5Zm14-17h1v5h-2v3h-3v3h-3v3h-2v-2h3v-3h3v-3h2V8h1Z",
      p.white,
    ),
    path(
      "M3 2h4v2h2v2h2v3h2v3h3v3h3v3h3v2h4v2h2v2h2v4h-2v2h-4v-2h-2v-2h-2v-4h-2v-3h-3v-3h-3v-3H9v-2H6V9H4V7H2V3h1Z",
      p.black,
    ),
    path("M3 3h3v2h2v2h2v3H8V8H6V6H4V5H3Z", p.silver),
    path("M10 10h2v3h3v3h3v3h3v2h-2v-2h-3v-3h-3v-3h-3Z", p.gray),
    path("M21 21h4v2h2v2h2v2h-2v2h-2v-2h-2v-2h-2Z", p.yellow),
    path("M22 23h2v2h2v2h-2v-2h-2Z", p.olive),
  ),
  web: art(
    path(
      "M12 2h10v2h4v3h3v5h2v11h-2v4h-4v3H12v-2H7v-3H4V13h2V8h3V4h3Z",
      p.charcoal,
    ),
    path(
      "M11 1h10v2h4v3h3v5h2v10h-2v5h-3v3h-4v2H11v-2H7v-3H4v-5H2V11h2V6h3V3h4Z",
      p.black,
    ),
    path(
      "M11 2h10v2h4v3h2v5h2v8h-2v5h-3v3h-4v2h-8v-2H8v-3H5v-5H3v-8h2V7h3V4h3Z",
      p.blue,
    ),
    path("M11 2h7v3h-3v3h-4v4H8v3H4v-3h1V7h3V4h3Z", p.cyan),
    path(
      "M20 5h4v3h3v6h-5v-2h-4V8h2ZM8 16h7v3h4v5h-3v5h-4v-5h-2v-3H8Z",
      p.green,
    ),
    path(
      "M8 5h1v5H8v12h1v4H8v-3H7V9h1Zm14 0h1v4h1v14h-1v3h-1v-5h1V11h-1Z",
      p.teal,
    ),
    rect(15, 3, 1, 26, p.teal),
    rect(4, 15, 24, 1, p.teal),
    rect(6, 9, 20, 1, p.teal),
    rect(6, 22, 20, 1, p.teal),
    rect(10, 4, 3, 1, p.white),
  ),
  shutdown: art(
    rect(6, 5, 24, 21, p.charcoal),
    bevel(3, 2, 24, 22),
    rect(6, 5, 18, 15, p.black),
    rect(8, 7, 14, 11, p.navy),
    rect(12, 24, 7, 3, p.gray),
    bevel(7, 27, 17, 4),
    bevel(17, 16, 14, 14, p.red, p.white, p.maroon),
    path("M20 20h2v5h4v-5h2v7h-8Z", p.white),
    rect(23, 18, 2, 5, p.white),
  ),
  terminal: art(
    windowFrame(1, 3, 28, 25, p.black),
    path("M5 12h2v2h2v2h2v2H9v2H7v2H5v-2h2v-2h2v-2H7v-2H5Z", p.lime),
    rect(14, 21, 8, 2, p.lime),
    rect(5, 10, 9, 1, p.teal),
  ),
  mail: art(
    rect(3, 9, 28, 20, p.charcoal),
    bevel(1, 6, 28, 21, p.white),
    path(
      "M3 9h2v2h3v2h3v2h3v2h2v-2h3v-2h3v-2h3V9h2v3h-3v2h-3v2h-3v2h-6v-2H9v-2H6v-2H3Z",
      p.navy,
    ),
    path(
      "M3 23h2v-2h3v-2h3v-2h2v2h-2v2H8v2H5v2H3Zm15-6h2v2h3v2h3v2h1v2h-2v-2h-3v-2h-3v-2h-1Z",
      p.gray,
    ),
    rect(23, 8, 3, 3, p.cyan),
  ),
  info: art(
    path("M12 3h10v2h5v4h3v15h-3v4h-5v3H12v-2H7v-4H4V11h3V6h5Z", p.charcoal),
    path("M10 1h11v2h5v4h3v16h-3v4h-5v3H10v-3H5v-4H2V7h3V3h5Z", p.black),
    path("M10 2h11v2h5v4h2v14h-3v4h-5v3h-9v-3H6v-4H3V8h3V4h4Z", p.navy),
    path("M10 2h11v1H10v2H6v4H4v13H3V8h3V4h4Z", p.cyan),
    rect(13, 6, 5, 4, p.white),
    path("M11 13h7v10h3v2H10v-2h3v-8h-2Z", p.white),
  ),
  start: art(
    path("M4 5h10V3h6v2h10v22H20v2h-6v-2H4Z", p.charcoal),
    path("M2 3h10V1h6v2h11v23H18v2h-6v-2H2Z", p.black),
    path("M3 4h9V3h2v10h-2v1H3Z", p.red),
    path("M16 2h1v2h11v9H18v-1h-2Z", p.green),
    path("M3 16h10v-1h1v11h-1v-1H3Z", p.blue),
    path("M16 15h2v1h10v9H18v1h-2Z", p.yellow),
    rect(4, 5, 6, 1, p.white),
    rect(18, 5, 8, 1, p.lime),
    rect(4, 17, 7, 1, p.cyan),
    rect(18, 17, 8, 1, p.white),
    rect(4, 23, 7, 1, p.navy),
    rect(19, 23, 8, 1, p.olive),
  ),
  recycle: art(
    path("M6 10h24v5h-2v10h-2v5H10v-3H8V16H6Z", p.charcoal),
    path("M3 7h25v6h-2v10h-2v6H8v-3H6V13H3Z", p.black),
    path("M5 10h21v3h-2v10h-2v4H9v-4H8V13H5Z", p.silver),
    rect(9, 12, 14, 12, p.white),
    rect(10, 12, 1, 12, p.gray),
    rect(21, 12, 1, 12, p.gray),
    rect(9, 25, 13, 1, p.gray),
    bevel(2, 6, 27, 5),
    rect(9, 3, 13, 3, p.black),
    rect(10, 4, 11, 2, p.silver),
    path(
      "M14 12h4v2h2v3h-4v-2h-1v2h-3v-2h2Zm7 7v4h-6v-3h2v1h2v-2Zm-10-1h3v3h1v3h-4v-2H9v-2h2Z",
      p.green,
    ),
  ),
  "server-status": art(
    rect(4, 4, 19, 26, p.charcoal),
    bevel(1, 1, 19, 27),
    bevel(4, 4, 13, 6, p.gray),
    bevel(4, 11, 13, 6, p.gray),
    bevel(4, 18, 13, 6, p.gray),
    rect(6, 6, 5, 1, p.black),
    rect(6, 13, 5, 1, p.black),
    rect(6, 20, 5, 1, p.black),
    rect(13, 6, 2, 2, p.lime),
    rect(13, 13, 2, 2, p.lime),
    rect(13, 20, 2, 2, p.yellow),
    windowFrame(12, 14, 18, 15, p.black),
    path("M15 24h3v-2h3v-2h2v4h2v-2h2v2h-1v2h-4v-3h-1v1h-2v2h-4Z", p.lime),
  ),
  questions: art(
    rect(7, 4, 20, 27, p.charcoal),
    bevel(4, 1, 20, 28, p.white),
    bevel(9, 1, 10, 5),
    pixels(
      [".###.", "#...#", "....#", "..##.", "..#..", ".....", "..#.."],
      9,
      8,
      p.navy,
      2,
    ),
    rect(8, 25, 12, 1, p.gray),
  ),
  soma: art(
    path(
      "M15 3h6v2h2v5h-2v2h5v2h2v8h-3v-5h-2v13h-5v-8h-1v8h-5V17h-2v5H7v-8h2v-2h6v-2h-2V5h2Z",
      p.charcoal,
    ),
    path(
      "M13 1h6v2h2v5h-2v2h5v2h2v8h-4v-5h-1v15h-5V20h-1v10h-5V15H9v5H5v-8h2v-2h6V8h-2V3h2Z",
      p.black,
    ),
    path(
      "M13 2h6v1h1v4h-2v4h6v2h1v6h-2v-6h-3v16h-3V19h-3v10h-3V13H8v6H6v-6h2v-2h6V7h-2V3h1Z",
      p.light,
    ),
    rect(13, 3, 2, 3, p.white),
    rect(12, 12, 7, 6, p.cyan),
    path("M15 12h1v1h1v-1h2v3h-1v1h-1v1h-1v-1h-1Z", p.red),
    rect(13, 18, 5, 2, p.yellow),
    rect(12, 21, 2, 6, p.teal),
    rect(18, 21, 1, 6, p.teal),
  ),
  "game-of-life": art(
    rect(4, 4, 27, 27, p.charcoal),
    bevel(1, 1, 27, 27, p.gray),
    ...Array.from({ length: 5 }, (_, row) =>
      Array.from({ length: 5 }, (_, col) =>
        rect(4 + col * 4, 4 + row * 4, 3, 3, p.black),
      ).join(""),
    ),
    ...[
      [2, 1],
      [3, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ].map(([col, row]) =>
      art(
        rect(4 + col * 4, 4 + row * 4, 3, 3, p.green),
        rect(4 + col * 4, 4 + row * 4, 2, 2, p.lime),
      ),
    ),
  ),
  portfolio: art(
    windowFrame(1, 3, 28, 24),
    bevel(4, 11, 9, 12, p.teal),
    rect(7, 13, 3, 4, p.yellow),
    path("M6 18h5v1h1v3H5v-3h1Z", p.navy),
    rect(16, 11, 8, 2, p.navy),
    rect(16, 16, 9, 1, p.gray),
    rect(16, 19, 6, 1, p.gray),
    rect(16, 22, 8, 1, p.gray),
    path("M22 21h2v2h2v2h2v2h2v2h-4v2h-2v-6h-2Z", p.black),
    path("M23 23h1v2h2v2h2v1h-3v1h-1v-4h-1Z", p.white),
  ),
  "frontend-tutorial": art(
    path("M4 9h9v2h6V9h12v21H19v1h-4v-1H4Z", p.charcoal),
    path("M1 6h11v1h3v2h2V7h3V6h10v22H19v2h-6v-2H1Z", p.black),
    path("M2 7h10v1h2v2h1v17h-2v-1H2Z", p.white),
    path("M17 10h2V8h2V7h8v19H19v1h-2Z", p.light),
    rect(15, 11, 1, 17, p.gray),
    rect(3, 9, 7, 2, p.navy),
    rect(3, 14, 8, 1, p.teal),
    rect(3, 17, 9, 1, p.teal),
    rect(3, 20, 7, 1, p.teal),
    rect(3, 23, 8, 1, p.gray),
    pixels([".#...#.", "#.....#", ".#...#."], 19, 15, p.navy),
    path("M23 4h4v9h-1v-1h-2v1h-1Z", p.red),
  ),
  "unit-converter": art(
    rect(4, 4, 11, 27, p.charcoal),
    bevel(1, 1, 11, 28, p.yellow, p.white, p.olive),
    ...[5, 9, 13, 17, 21, 25].map((y, i) =>
      rect(3, y, i % 2 === 0 ? 5 : 3, 1, p.black),
    ),
    windowFrame(14, 3, 15, 12, p.black),
    pixels(["#.#", "###", "..#", "..#", "..#"], 18, 10, p.lime),
    path("M14 19h10v-3h2v2h2v2h2v1h-2v2h-2v2h-2v-3H14Z", p.navy),
    path("M15 26h2v-2h2v3h10v3H19v2h-2v-2h-2v-1h-2v-1h2Z", p.teal),
    rect(15, 19, 8, 1, p.cyan),
    rect(20, 27, 8, 1, p.cyan),
  ),
  paintaz: art(
    path("M10 5h13v2h5v4h3v10h-2v3h-4v5H11v-2H6v-3H3V13h2V9h5Z", p.charcoal),
    path("M8 3h13v2h5v4h3v10h-2v3h-4v5H9v-2H4v-3H1V11h2V7h5Z", p.black),
    path("M8 4h13v2h5v4h2v8h-2v3h-4v5H9v-2H4v-3H2V12h2V8h4Z", p.yellow),
    path("M8 4h13v1H8v3H4v4H2v-1h1V7h5Z", p.white),
    rect(6, 10, 4, 4, p.red),
    rect(12, 6, 4, 4, p.blue),
    rect(20, 9, 4, 4, p.green),
    rect(6, 18, 4, 4, p.magenta),
    rect(13, 21, 4, 3, p.teal),
    bevel(16, 15, 6, 6, p.teal, p.olive, p.white),
    path(
      "M27 1h4v6h-2v4h-2v4h-2v4h-2v4h-3v3h-4v-5h2v-4h3v-4h2V9h2V5h2Z",
      p.black,
    ),
    path("M28 2h2v4h-2v4h-2v4h-2v3h-2v-3h2v-4h2V6h2Z", p.olive),
    path("M21 16h2v2h-2v3h-3v-3h3Z", p.silver),
    path("M18 21h3v2h-2v2h-2v-3h1Z", p.navy),
  ),
  "dos-pascal-docker": art(
    rect(4, 10, 26, 20, p.charcoal),
    bevel(1, 8, 27, 20, p.teal, p.cyan, p.navy),
    bevel(4, 3, 7, 7, p.blue, p.cyan, p.navy),
    bevel(12, 3, 7, 7, p.blue, p.cyan, p.navy),
    bevel(20, 3, 7, 7, p.blue, p.cyan, p.navy),
    rect(5, 12, 1, 11, p.cyan),
    rect(9, 12, 1, 11, p.cyan),
    rect(13, 12, 1, 11, p.cyan),
    windowFrame(13, 14, 17, 15, p.black),
    pixels(["##.", "#.#", "##.", "#..", "#.."], 16, 22, p.white),
    rect(22, 26, 4, 1, p.lime),
  ),
  "analytic-hierarchy-process": art(
    rect(16, 9, 2, 7, p.charcoal),
    rect(5, 16, 24, 2, p.charcoal),
    rect(5, 16, 2, 6, p.charcoal),
    rect(16, 16, 2, 6, p.charcoal),
    rect(27, 16, 2, 6, p.charcoal),
    rect(14, 8, 2, 7, p.gray),
    rect(3, 14, 24, 2, p.gray),
    rect(3, 15, 2, 6, p.gray),
    rect(14, 15, 2, 6, p.gray),
    rect(25, 15, 2, 6, p.gray),
    rect(12, 3, 10, 8, p.charcoal),
    bevel(10, 1, 10, 8, p.yellow, p.white, p.olive),
    rect(3, 22, 8, 8, p.charcoal),
    rect(14, 22, 8, 8, p.charcoal),
    rect(25, 22, 6, 8, p.charcoal),
    bevel(1, 20, 8, 8, p.cyan, p.white, p.teal),
    bevel(12, 20, 8, 8, p.lime, p.white, p.green),
    bevel(23, 20, 8, 8, p.magenta, p.white, p.purple),
  ),
  tiles: art(
    rect(4, 4, 27, 27, p.charcoal),
    bevel(1, 1, 27, 27),
    bevel(4, 4, 9, 9, p.blue, p.cyan, p.navy),
    bevel(15, 4, 9, 9, p.green, p.lime, p.teal),
    bevel(4, 15, 9, 9, p.olive, p.yellow, p.maroon),
    bevel(15, 15, 9, 9, p.purple, p.magenta, p.navy),
    pixels(["#", "#", "#"], 8, 7, p.white),
    pixels(["##", ".#", "##"], 18, 7, p.white),
    rect(6, 18, 5, 1, p.white),
    rect(6, 21, 3, 1, p.yellow),
    rect(17, 18, 3, 1, p.white),
    rect(17, 21, 5, 1, p.magenta),
  ),
  "mobx-example": art(
    windowFrame(1, 2, 28, 26),
    bevel(4, 10, 9, 13, p.yellow, p.white, p.olive),
    pixels(["###", "..#", "###", "#..", "###"], 7, 14, p.black),
    path("M13 15h3v-2h1v1h1v1h1v2h-1v1h-1v1h-1v-2h-3Z", p.navy),
    bevel(19, 10, 7, 13, p.white),
    pixels(["#.#", "#.#", "###", "..#", "..#"], 21, 14, p.green),
    rect(5, 24, 5, 1, p.gray),
    rect(20, 24, 5, 1, p.gray),
  ),
  "svelte-example": art(
    windowFrame(1, 2, 28, 26),
    bevel(4, 10, 7, 8, p.red, p.white, p.maroon),
    bevel(12, 10, 7, 8, p.yellow, p.white, p.olive),
    bevel(20, 10, 6, 8, p.cyan, p.white, p.teal),
    rect(7, 13, 1, 2, p.white),
    rect(15, 13, 1, 2, p.black),
    rect(22, 13, 1, 2, p.navy),
    path("M7 19h1v1h7v-1h1v1h7v-1h1v2h-8v1h-1v-1H7Z", p.gray),
    rect(11, 22, 9, 3, p.navy),
    rect(13, 23, 5, 1, p.white),
  ),
  deska: art(
    windowFrame(1, 1, 28, 28, p.navy),
    bevel(4, 9, 7, 4, p.red, p.white, p.maroon),
    bevel(12, 9, 7, 4, p.yellow, p.white, p.olive),
    bevel(20, 9, 6, 4, p.red, p.white, p.maroon),
    bevel(4, 14, 7, 4, p.cyan, p.white, p.teal),
    bevel(12, 14, 7, 4, p.green, p.lime, p.teal),
    rect(20, 19, 3, 3, p.white),
    rect(22, 21, 1, 1, p.gray),
    rect(19, 22, 1, 1, p.silver),
    bevel(10, 24, 11, 3),
  ),
  saper: art(
    rect(4, 4, 27, 27, p.charcoal),
    bevel(1, 1, 27, 27),
    ...[0, 1, 2].flatMap(row =>
      [0, 1, 2].map(col => bevel(4 + col * 7, 4 + row * 7, 7, 7)),
    ),
    rect(11, 11, 7, 7, p.silver),
    pixels([".#.", "##.", ".#.", ".#.", "###"], 13, 12, p.blue),
    path("M8 5h1v1h-3v2h2v1H5V6h3Z", p.red),
    rect(8, 5, 1, 4, p.black),
    rect(6, 9, 4, 1, p.black),
    rect(18, 18, 7, 7, p.silver),
    path("M21 18h1v2h2v1h1v1h-1v2h-2v1h-1v-1h-2v-2h-1v-1h1v-1h2Z", p.black),
    rect(20, 20, 1, 1, p.white),
  ),
  tetris: art(
    rect(5, 3, 24, 28, p.charcoal),
    bevel(2, 1, 24, 28, p.navy),
    ...[
      [11, 5],
      [7, 9],
      [11, 9],
      [15, 9],
    ].map(([x, y]) => bevel(x, y, 4, 4, p.magenta, p.white, p.purple)),
    ...[
      [4, 19],
      [4, 23],
      [8, 23],
      [12, 23],
    ].map(([x, y]) => bevel(x, y, 4, 4, p.blue, p.cyan, p.navy)),
    ...[
      [16, 19],
      [20, 19],
      [16, 23],
      [20, 23],
    ].map(([x, y]) => bevel(x, y, 4, 4, p.yellow, p.white, p.olive)),
  ),
  statki: art(
    rect(4, 4, 27, 27, p.charcoal),
    bevel(1, 1, 27, 27, p.blue, p.cyan, p.navy),
    ...[8, 13, 18, 23].map(n =>
      art(rect(n, 4, 1, 20, p.teal), rect(4, n, 20, 1, p.teal)),
    ),
    path("M13 6h4v5h3v4h5v7h-2v2H8v-2H6v-7h4v-4h3Z", p.black),
    rect(14, 7, 2, 6, p.gray),
    rect(11, 12, 8, 4, p.silver),
    rect(12, 13, 2, 1, p.navy),
    rect(16, 13, 2, 1, p.navy),
    path("M7 16h17v5h-2v2H9v-2H7Z", p.gray),
    rect(7, 16, 17, 1, p.white),
    path("M5 24h3v1h4v-1h4v1h4v-1h5v2h-4v1h-5v-1h-4v1H7v-1H5Z", p.cyan),
    pixels(["#.#", ".#.", "#.#"], 21, 5, p.red),
  ),
  pan: art(
    rect(5, 7, 17, 23, p.charcoal),
    bevel(2, 4, 17, 24, p.white),
    pixels([".#.", "###", ".#."], 5, 8, p.black),
    rect(15, 6, 15, 25, p.charcoal),
    bevel(12, 3, 16, 26, p.white),
    path("M19 12h2v-1h3v3h-1v2h-1v2h-1v1h-1v-1h-1v-2h-1v-2h-1v-3h2Z", p.red),
    pixels(["#.#", "###", "#.#"], 15, 6, p.maroon),
    pixels(["#.#", "###", "#.#"], 22, 23, p.maroon),
    rect(15, 20, 9, 1, p.silver),
  ),
  chinczyk: art(
    rect(4, 4, 27, 27, p.charcoal),
    bevel(1, 1, 27, 27, p.white),
    bevel(4, 4, 8, 8, p.red, p.white, p.maroon),
    bevel(17, 4, 8, 8, p.green, p.lime, p.teal),
    bevel(4, 17, 8, 8, p.blue, p.cyan, p.navy),
    bevel(17, 17, 8, 8, p.yellow, p.white, p.olive),
    ...[5, 9, 13, 17, 21].map(n =>
      art(rect(13, n, 2, 2, p.gray), rect(n, 13, 2, 2, p.gray)),
    ),
    rect(13, 13, 2, 2, p.black),
    rect(6, 6, 3, 3, p.white),
    rect(19, 6, 3, 3, p.white),
    rect(6, 19, 3, 3, p.white),
    bevel(19, 19, 11, 11, p.white),
    rect(22, 22, 2, 2, p.black),
    rect(26, 22, 1, 2, p.black),
    rect(24, 24, 1, 1, p.black),
    rect(22, 26, 2, 1, p.black),
    rect(26, 26, 1, 1, p.black),
  ),
};

/** Decorative artwork: the containing control supplies its accessible label. */
export function windowsIcon(name: string): string {
  const body = Object.hasOwn(icons, name) ? icons[name] : documentIcon;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="Win98Icon" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;
}
