// One-off generator for the citizen app's install icons (public/icons/*.png).
// Uses next/og's ImageResponse, which ships with Next: no extra dependency. The PNGs are
// committed; this is not run at build time. Re-run after changing the mark:
//   cd frontend && node scripts/make-icons.mjs
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";

const OUT = fileURLToPath(new URL("../public/icons/", import.meta.url));
const EMERALD = "#047857";

// The BrandMark: a white "C" (an open ring) with a map pin, on an emerald tile.
function mark(size, { square, scale }) {
  const glyph = Math.round(size * scale);
  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: square ? EMERALD : "transparent",
      },
    },
    h(
      "div",
      {
        style: {
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: EMERALD,
          borderRadius: square ? 0 : Math.round(size * 0.22),
        },
      },
      h(
        "svg",
        { width: glyph, height: glyph, viewBox: "0 0 100 100" },
        // The "C": a thick ring open towards the pin.
        h("path", {
          d: "M74 28 A32 32 0 1 0 74 72",
          fill: "none",
          stroke: "#ffffff",
          strokeWidth: 15,
          strokeLinecap: "round",
        }),
        // The pin, where the C opens: reports converging on one spot.
        h("path", {
          d: "M78 66 C78 66 64 54 64 44 A14 14 0 0 1 92 44 C92 54 78 66 78 66 Z",
          fill: "#a7f3d0",
        }),
        h("circle", { cx: 78, cy: 44, r: 5, fill: EMERALD }),
      ),
    ),
  );
}

const ICONS = [
  { file: "icon-192.png", size: 192, square: false, scale: 0.7 },
  { file: "icon-512.png", size: 512, square: false, scale: 0.7 },
  // Maskable: full-bleed square, glyph inside the central safe zone (80% circle).
  { file: "icon-maskable-512.png", size: 512, square: true, scale: 0.52 },
  // iOS draws its own rounded corners: full-bleed square.
  { file: "apple-touch-icon.png", size: 180, square: true, scale: 0.66 },
];

for (const { file, size, square, scale } of ICONS) {
  const res = new ImageResponse(mark(size, { square, scale }), { width: size, height: size });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(OUT + file, buf);
  console.log(`wrote public/icons/${file} (${size}x${size}, ${buf.length} bytes)`);
}
