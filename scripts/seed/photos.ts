/**
 * Demo site photos, rendered procedurally (no binary assets in git, identical
 * on every run): SVG scenes drawn through a small perspective camera, rasterised
 * by sharp, then given sensor grain, a vignette and JPEG compression so they
 * read like phone photos from a roof.
 *
 *   survey      bare RCC terraces with Sintex tanks, shaded roofs, factory
 *               metal-sheet roofs, the DISCOM meter board
 *   install     finished arrays on GI structures, panel close-ups, the
 *               inverter wall with ACDB/DCDB, battery banks, net meter, earth pit
 *   service     dusty array, cracked glass, an inverter showing a fault code
 *   subsidy     the PM Surya Ghar papers photographed on a desk
 *
 * Each image is stored once in GridFS (`seed-<key>.jpg`) and shared by id
 * across records, so ~35 files cover hundreds of surveys and jobs.
 *
 *   npx tsx scripts/seed/photos.ts <dir>     write the library to <dir> to look at
 */
import sharp from "sharp";
import mongoose from "mongoose";
import { saveSmallFile } from "@/server/services/core/files";
import { prng } from "./people";

const W = 1280;
const H = 960;

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

type V3 = [number, number, number];
type Cam = { x: number; y: number; z: number; pitch: number; yaw: number; f: number };

function project(c: Cam, [px, py, pz]: V3): [number, number] {
  const dx0 = px - c.x;
  const dz0 = pz - c.z;
  const dx = dx0 * Math.cos(c.yaw) - dz0 * Math.sin(c.yaw);
  const dz1 = dx0 * Math.sin(c.yaw) + dz0 * Math.cos(c.yaw);
  const dy = py - c.y;
  const yc = dy * Math.cos(c.pitch) + dz1 * Math.sin(c.pitch);
  const zc = -dy * Math.sin(c.pitch) + dz1 * Math.cos(c.pitch);
  const z = Math.max(zc, 0.05);
  return [W / 2 + (c.f * dx) / z, H / 2 - (c.f * yc) / z];
}

const pts = (c: Cam, ps: V3[]) => ps.map((p) => project(c, p).map((n) => n.toFixed(1)).join(",")).join(" ");
const poly = (c: Cam, ps: V3[], attrs: string) => `<polygon points="${pts(c, ps)}" ${attrs}/>`;
const line = (c: Cam, a: V3, b: V3, attrs: string) => {
  const [x1, y1] = project(c, a);
  const [x2, y2] = project(c, b);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${attrs}/>`;
};
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ------------------------------------------------------------------ */
/* Shared SVG pieces                                                   */
/* ------------------------------------------------------------------ */

/** Noise filters: concrete, plaster, soil and a fine grain overlay. */
function defs(seed: number) {
  return `<defs>
  <filter id="concrete" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.035" numOctaves="5" seed="${seed}" result="t"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.24  0 0 0 0 0.22  0 0 0 1.1 -0.45"/>
  </filter>
  <filter id="speckle" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed + 1}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 1.6 -0.75"/>
  </filter>
  <filter id="plaster" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="4" seed="${seed + 2}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0.9 -0.35"/>
  </filter>
  <filter id="soil" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="${seed + 3}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 1.4 -0.3"/>
  </filter>
  <filter id="dust" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="5" seed="${seed + 4}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.72  0 0 0 0 0.62  0 0 0 0 0.48  0 0 0 1.8 -0.55"/>
  </filter>
  <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="softer"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="drop" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="6" dy="10" stdDeviation="9" flood-color="#000" flood-opacity="0.35"/></filter>
  <linearGradient id="cell" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#3a5784"/><stop offset="0.45" stop-color="#1b2d4f"/><stop offset="1" stop-color="#0e1a33"/>
  </linearGradient>
  <linearGradient id="cellSky" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9fb6d6" stop-opacity="0.55"/><stop offset="0.4" stop-color="#9fb6d6" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="tank" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#0c0c0c"/><stop offset="0.3" stop-color="#3b3b3b"/><stop offset="0.45" stop-color="#1c1c1c"/><stop offset="1" stop-color="#050505"/>
  </linearGradient>
  <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#8e9496"/><stop offset="0.5" stop-color="#c9cdcf"/><stop offset="1" stop-color="#7c8284"/>
  </linearGradient>
  <linearGradient id="whitebox" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fbfbf8"/><stop offset="1" stop-color="#d9dbd6"/>
  </linearGradient>
  <linearGradient id="greybox" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#d6d9d5"/><stop offset="1" stop-color="#a9aeaa"/>
  </linearGradient>
  <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>
</defs>`;
}

function sky(horizon: number, warm: number, rand: () => number) {
  const top = warm > 0.5 ? "#8fb3d9" : "#6f9fd4";
  const low = warm > 0.5 ? "#f1e2c4" : "#d7e6f2";
  const clouds = Array.from({ length: 5 }, () => {
    const cx = rand() * W;
    const cy = horizon * (0.15 + rand() * 0.55);
    return `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(120 + rand() * 200).toFixed(0)}" ry="${(18 + rand() * 26).toFixed(0)}" fill="#fff" opacity="${(0.35 + rand() * 0.35).toFixed(2)}" filter="url(#softer)"/>`;
  }).join("");
  return `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${low}"/></linearGradient>
  <rect width="${W}" height="${horizon + 4}" fill="url(#sky)"/>${clouds}`;
}

/** Hazy apartment blocks, water tanks and a mobile tower on the skyline. */
function skyline(horizon: number, rand: () => number) {
  let x = -40;
  let out = "";
  while (x < W + 40) {
    const w = 60 + rand() * 140;
    const h = 30 + rand() * 120;
    const tone = 170 + Math.floor(rand() * 40);
    const fill = `rgb(${tone},${tone - 4},${tone - 14})`;
    out += `<rect x="${x.toFixed(0)}" y="${(horizon - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 6).toFixed(0)}" fill="${fill}"/>`;
    for (let r = horizon - h + 10; r < horizon - 8; r += 14) for (let c = x + 8; c < x + w - 10; c += 18) if (rand() < 0.5) out += `<rect x="${c.toFixed(0)}" y="${r.toFixed(0)}" width="8" height="6" fill="rgb(${tone - 40},${tone - 40},${tone - 34})" opacity="0.5"/>`;
    if (rand() < 0.35) out += `<rect x="${(x + w * 0.3).toFixed(0)}" y="${(horizon - h - 14).toFixed(0)}" width="16" height="14" fill="#2b2b2b" opacity="0.6" rx="3"/>`;
    x += w + rand() * 30;
  }
  const tx = W * (0.15 + rand() * 0.7);
  out += `<path d="M${tx} ${horizon - 230} L${tx - 14} ${horizon - 60} M${tx} ${horizon - 230} L${tx + 14} ${horizon - 60} M${tx - 10} ${horizon - 170} L${tx + 10} ${horizon - 170} M${tx - 12} ${horizon - 120} L${tx + 12} ${horizon - 120}" stroke="#8a8f94" stroke-width="2" opacity="0.6"/>`;
  // Neighbouring terraces between the skyline and our parapet.
  let near = `<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="#b4ab9b"/><rect y="${horizon}" width="${W}" height="${H - horizon}" fill="#000" filter="url(#concrete)" opacity="0.6"/>`;
  for (let i = 0; i < 14; i++) {
    const bx = rand() * W;
    const by = horizon + 4 + rand() * 60;
    near += `<rect x="${bx.toFixed(0)}" y="${by.toFixed(0)}" width="${(30 + rand() * 90).toFixed(0)}" height="${(6 + rand() * 18).toFixed(0)}" fill="rgb(${150 + rand() * 60},${145 + rand() * 50},${130 + rand() * 40})"/>`;
    if (rand() < 0.4) near += `<rect x="${(bx + 10).toFixed(0)}" y="${(by - 12).toFixed(0)}" width="12" height="12" rx="2" fill="#2a2a2a"/>`;
  }
  return `${near}<g opacity="0.85">${out}</g>`;
}

/** Rows of 72-cell modules on a GI structure, tilted toward the camera. */
function panelRows(c: Cam, opts: { rows: number; perRow: number; x0: number; z0: number; tilt: number; rowGap: number; dust?: boolean }) {
  const pw = 1.13;
  const pl = 2.28;
  const t = (opts.tilt * Math.PI) / 180;
  let shadows = "";
  let legs = "";
  let mods = "";
  for (let r = opts.rows - 1; r >= 0; r--) {
    const z = opts.z0 + r * opts.rowGap;
    const yLow = 0.55;
    const yHigh = yLow + pl * Math.sin(t);
    const zHigh = z + pl * Math.cos(t);
    const xEnd = opts.x0 + opts.perRow * (pw + 0.02);
    shadows += poly(c, [[opts.x0 + 0.3, 0, z + 0.4], [xEnd + 0.3, 0, z + 0.4], [xEnd + 0.9, 0, zHigh + 1.0], [opts.x0 + 0.9, 0, zHigh + 1.0]], `fill="#1c1a17" opacity="0.38" filter="url(#soft)"`);
    for (let k = 0; k <= opts.perRow; k += 2) {
      const lx = Math.min(opts.x0 + k * (pw + 0.02), xEnd);
      legs += line(c, [lx, 0, z + 0.1], [lx, yLow, z + 0.1], `stroke="url(#steel)" stroke-width="5"`);
      legs += line(c, [lx, 0, zHigh - 0.1], [lx, yHigh, zHigh - 0.1], `stroke="#8d9395" stroke-width="5"`);
      legs += line(c, [lx, 0.05, z + 0.1], [lx, yHigh * 0.6, zHigh - 0.1], `stroke="#a3a8aa" stroke-width="3"`);
    }
    for (let k = 0; k < opts.perRow; k++) {
      const xa = opts.x0 + k * (pw + 0.02);
      const xb = xa + pw;
      const a: V3 = [xa, yLow, z];
      const b: V3 = [xb, yLow, z];
      const cc: V3 = [xb, yHigh, zHigh];
      const d: V3 = [xa, yHigh, zHigh];
      mods += poly(c, [a, b, cc, d], `fill="url(#cell)" stroke="#c8ccce" stroke-width="2.2"`);
      for (let i = 1; i < 6; i++) mods += line(c, lerp(a, b, i / 6), lerp(d, cc, i / 6), `stroke="#5d7396" stroke-width="0.7" opacity="0.75"`);
      for (let j = 1; j < 12; j++) mods += line(c, lerp(a, d, j / 12), lerp(b, cc, j / 12), `stroke="#5d7396" stroke-width="0.6" opacity="${j === 6 ? 0.95 : 0.55}"`);
      mods += poly(c, [a, b, cc, d], `fill="url(#cellSky)"`);
      if (opts.dust) mods += poly(c, [lerp(a, d, 0), lerp(b, cc, 0), lerp(b, cc, 0.3), lerp(a, d, 0.3)], `fill="#b59b78" opacity="0.32" filter="url(#soft)"`);
    }
  }
  return shadows + legs + mods;
}

/** A black Sintex tank on a brick plinth (every Hyderabad terrace has one). */
function sintex(c: Cam, x: number, z: number, r: number, h: number) {
  const [bx, by] = project(c, [x, 0.35, z]);
  const [tx, ty] = project(c, [x, 0.35 + h, z]);
  const [ex] = project(c, [x + r, 0.35, z]);
  const rw = Math.abs(ex - bx);
  const [px1, py1] = project(c, [x - r - 0.2, 0, z]);
  const [, py2] = project(c, [x, 0.35, z]);
  return `<ellipse cx="${bx + rw * 0.5}" cy="${by + 6}" rx="${rw * 1.5}" ry="${rw * 0.28}" fill="#1a1712" opacity="0.4" filter="url(#soft)"/>
  <rect x="${px1}" y="${py2}" width="${2 * (bx - px1)}" height="${py1 - py2 + 4}" fill="#9b5a3c"/>
  <rect x="${px1}" y="${py2}" width="${2 * (bx - px1)}" height="${py1 - py2 + 4}" fill="#000" opacity="0.15" filter="url(#speckle)"/>
  <rect x="${bx - rw}" y="${ty}" width="${2 * rw}" height="${by - ty}" fill="url(#tank)"/>
  ${[0.25, 0.5, 0.75].map((f) => `<line x1="${bx - rw}" y1="${ty + (by - ty) * f}" x2="${bx + rw}" y2="${ty + (by - ty) * f}" stroke="#000" stroke-width="3" opacity="0.5"/>`).join("")}
  <ellipse cx="${tx}" cy="${ty}" rx="${rw}" ry="${rw * 0.22}" fill="#262626"/>
  <ellipse cx="${tx}" cy="${ty - 4}" rx="${rw * 0.35}" ry="${rw * 0.08}" fill="#111"/>`;
}

/** Floor, parapet walls and shadow of an RCC terrace. Returns the SVG and the camera. */
function terrace(rand: () => number, seed: number, opts: { width: number; depth: number; parapet: string; floor: string }) {
  const cam: Cam = { x: (rand() - 0.5) * 1.5, y: 1.65, z: 0, pitch: 0.2 + rand() * 0.06, yaw: (rand() - 0.5) * 0.35, f: 820 };
  const hw = opts.width / 2;
  const d = opts.depth;
  const ph = 0.95;
  const horizon = project(cam, [0, cam.y, 400])[1];
  const floor = poly(cam, [[-hw, 0, 1.2], [hw, 0, 1.2], [hw, 0, d], [-hw, 0, d]], `fill="${opts.floor}"`);
  const tex = poly(cam, [[-hw, 0, 1.2], [hw, 0, 1.2], [hw, 0, d], [-hw, 0, d]], `fill="#000" filter="url(#concrete)" opacity="0.9"`);
  const clip = `<clipPath id="floorclip">${poly(cam, [[-hw, 0, 1.2], [hw, 0, 1.2], [hw, 0, d], [-hw, 0, d]], "")}</clipPath>`;
  // Water stains and patch repairs.
  let stains = "";
  for (let i = 0; i < 9; i++) {
    const [sx, sy] = project(cam, [(rand() - 0.5) * opts.width * 0.9, 0, 2.5 + rand() * (d - 4)]);
    stains += `<ellipse cx="${sx}" cy="${sy}" rx="${30 + rand() * 120}" ry="${8 + rand() * 26}" fill="#4a4237" opacity="${(0.08 + rand() * 0.12).toFixed(2)}" filter="url(#soft)"/>`;
  }
  // Tile joints on old waterproofing (pressed clay tiles).
  let joints = "";
  for (let z = 2; z < d; z += 0.6) joints += line(cam, [-hw, 0, z], [hw, 0, z], `stroke="#000" stroke-width="0.8" opacity="0.12"`);
  for (let x = -hw; x <= hw; x += 0.6) joints += line(cam, [x, 0, 1.2], [x, 0, d], `stroke="#000" stroke-width="0.8" opacity="0.1"`);
  const wall = (a: V3, b: V3, shade: number) =>
    poly(cam, [a, b, [b[0], ph, b[2]], [a[0], ph, a[2]]], `fill="${opts.parapet}"`) +
    poly(cam, [a, b, [b[0], ph, b[2]], [a[0], ph, a[2]]], `fill="#000" opacity="${shade}"`) +
    poly(cam, [a, b, [b[0], ph, b[2]], [a[0], ph, a[2]]], `fill="#000" filter="url(#plaster)" opacity="0.5"`) +
    poly(cam, [[a[0], ph, a[2]], [b[0], ph, b[2]], [b[0], ph + 0.06, b[2]], [a[0], ph + 0.06, a[2]]], `fill="#e9e2d2"`);
  const back = wall([-hw, 0, d], [hw, 0, d], 0.05);
  const left = wall([-hw, 0, 1.2], [-hw, 0, d], 0.22);
  const right = wall([hw, 0, 1.2], [hw, 0, d], 0.12);
  const shadow = poly(cam, [[-hw, 0, 1.2], [-hw, 0, d], [-hw + 0.9, 0, d], [-hw + 0.9, 0, 1.2]], `fill="#1c1a17" opacity="0.3" filter="url(#soft)"`);
  const svg = `${sky(horizon, rand(), rand)}${skyline(horizon + 2, rand)}${clip}${floor}<g clip-path="url(#floorclip)">${tex}${stains}${joints}</g>${shadow}${back}${left}${right}`;
  return { cam, svg, horizon, hw, d, seed };
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

type Scene = (rand: () => number, seed: number) => string;

const PARAPETS = ["#e3d7bd", "#d9c7a3", "#e6dcc8", "#d8cfbf", "#efe1c0"];
const FLOORS = ["#a59b8b", "#9a9183", "#b0a594", "#8f877a"];

const roofEmpty: Scene = (rand, seed) => {
  const t = terrace(rand, seed, { width: 10 + rand() * 4, depth: 16 + rand() * 6, parapet: pick(rand, PARAPETS), floor: pick(rand, FLOORS) });
  const side = rand() < 0.5 ? -1 : 1;
  let extra = sintex(t.cam, side * (t.hw - 1.6), t.d - 2.5, 0.65, 1.3);
  if (rand() < 0.6) extra += sintex(t.cam, side * (t.hw - 3.2), t.d - 2.3, 0.55, 1.1);
  // Measuring tape laid out by the surveyor.
  const z = 4 + rand() * 3;
  extra += line(t.cam, [-t.hw + 0.4, 0.01, z], [t.hw - 0.6, 0.01, z + 0.4], `stroke="#e8c62a" stroke-width="3"`);
  const [mx, my] = project(t.cam, [-t.hw + 0.4, 0.02, z]);
  extra += `<rect x="${mx - 14}" y="${my - 14}" width="30" height="24" rx="5" fill="#e8c62a" stroke="#333" stroke-width="2"/>`;
  // Clothesline poles.
  if (rand() < 0.7) {
    const zc = t.d * 0.55;
    extra += line(t.cam, [-side * (t.hw - 1), 0, zc], [-side * (t.hw - 1), 1.8, zc], `stroke="#5c5c5c" stroke-width="5"`);
    extra += line(t.cam, [-side * (t.hw - 1), 0, zc + 4], [-side * (t.hw - 1), 1.8, zc + 4], `stroke="#5c5c5c" stroke-width="4"`);
    extra += line(t.cam, [-side * (t.hw - 1), 1.75, zc], [-side * (t.hw - 1), 1.75, zc + 4], `stroke="#444" stroke-width="1.5"`);
  }
  return defs(seed) + t.svg + extra;
};

const roofShade: Scene = (rand, seed) => {
  const t = terrace(rand, seed, { width: 11, depth: 17, parapet: pick(rand, PARAPETS), floor: pick(rand, FLOORS) });
  const side = rand() < 0.5 ? -1 : 1;
  // A neighbour's tree spilling over the parapet, and its dappled shadow.
  const [cx, cy] = project(t.cam, [side * t.hw, 2.6, t.d * 0.55]);
  let tree = "";
  for (let i = 0; i < 28; i++) {
    const g = 70 + Math.floor(rand() * 60);
    tree += `<circle cx="${cx + (rand() - 0.5) * 520}" cy="${cy + (rand() - 0.6) * 260}" r="${40 + rand() * 80}" fill="rgb(${g * 0.45},${g},${g * 0.35})" opacity="0.92"/>`;
  }
  let shade = "";
  for (let i = 0; i < 22; i++) {
    const [sx, sy] = project(t.cam, [side * (t.hw - rand() * 5), 0, 3 + rand() * (t.d - 5)]);
    shade += `<ellipse cx="${sx}" cy="${sy}" rx="${50 + rand() * 120}" ry="${12 + rand() * 30}" fill="#0f120c" opacity="0.32" filter="url(#soft)"/>`;
  }
  return defs(seed) + t.svg + shade + sintex(t.cam, -side * (t.hw - 1.8), t.d - 2.4, 0.65, 1.3) + `<g filter="url(#soft)" opacity="0.25">${tree}</g>` + tree;
};

const metalRoof: Scene = (rand, seed) => {
  const cam: Cam = { x: 0, y: 2.2, z: 0, pitch: 0.3, yaw: (rand() - 0.5) * 0.3, f: 820 };
  const horizon = project(cam, [0, cam.y, 400])[1];
  let out = sky(horizon, rand(), rand) + skyline(horizon + 2, rand);
  // Pitched corrugated sheet, ridges running away from the camera.
  const slope = (x: number) => 0.6 + Math.abs(x) * -0.05;
  for (let x = -14; x < 14; x += 0.19) {
    const k = Math.round((x + 14) / 0.19);
    const tone = k % 2 ? 176 : 192;
    const a: V3 = [x, slope(x), 1.5];
    const b: V3 = [x + 0.19, slope(x + 0.19), 1.5];
    out += poly(cam, [a, b, [b[0], b[1], 30], [a[0], a[1], 30]], `fill="rgb(${tone},${tone + 4},${tone + 8})"`);
  }
  out += poly(cam, [[-14, 0.6, 1.5], [14, 0.6, 1.5], [14, 0.6, 30], [-14, 0.6, 30]], `fill="#7b6f5e" filter="url(#dust)" opacity="0.55"`);
  for (let z = 4; z < 30; z += 3.6) out += line(cam, [-14, 0.62, z], [14, 0.62, z], `stroke="#70777b" stroke-width="2" opacity="0.6"`);
  // Rust streaks and a skylight sheet.
  for (let i = 0; i < 10; i++) {
    const x = (rand() - 0.5) * 24;
    out += poly(cam, [[x, 0.62, 3 + rand() * 6], [x + 0.25, 0.62, 3 + rand() * 6], [x + 0.25, 0.62, 18 + rand() * 8], [x, 0.62, 18 + rand() * 8]], `fill="#8a4a22" opacity="0.25" filter="url(#soft)"`);
  }
  const sx = (rand() - 0.5) * 10;
  out += poly(cam, [[sx, 0.63, 8], [sx + 1.1, 0.63, 8], [sx + 1.1, 0.63, 13], [sx, 0.63, 13]], `fill="#e7efe9" opacity="0.6"`);
  // Turbo ventilators.
  for (let i = 0; i < 4; i++) {
    const [vx, vy] = project(cam, [-9 + i * 6, 0.6, 22]);
    out += `<ellipse cx="${vx}" cy="${vy - 26}" rx="22" ry="24" fill="url(#steel)"/><rect x="${vx - 10}" y="${vy - 6}" width="20" height="8" fill="#888"/>`;
  }
  return defs(seed) + out;
};

const meterBoard: Scene = (rand, seed) => {
  const wall = pick(rand, ["#d9cba9", "#cfd6c4", "#e2d2b8", "#c9c1b0"]);
  const reading = String(Math.floor(1000 + rand() * 8000)).padStart(5, "0");
  const sc = `${1 + Math.floor(rand() * 2)}-${String(Math.floor(rand() * 9_999_999)).padStart(7, "0")}`;
  const cables = Array.from({ length: 5 }, (_, i) => `<path d="M${380 + i * 22} 0 C ${380 + i * 22} 120, ${420 + i * 18} 160, ${430 + i * 18} 250" stroke="${["#111", "#b02020", "#111", "#222", "#3b3b3b"][i]}" stroke-width="${7 - (i % 2)}" fill="none"/>`).join("");
  return `${defs(seed)}<rect width="${W}" height="${H}" fill="${wall}"/><rect width="${W}" height="${H}" filter="url(#plaster)" opacity="0.8"/>
  <rect y="${H - 120}" width="${W}" height="120" fill="#6d6458"/><rect y="${H - 120}" width="${W}" height="120" filter="url(#concrete)" opacity="0.8"/>
  ${cables}
  <g filter="url(#drop)"><rect x="300" y="250" width="380" height="460" rx="10" fill="#ecebe6"/></g>
  <rect x="300" y="250" width="380" height="460" rx="10" fill="#fff" opacity="0.25"/>
  <text x="490" y="300" font-family="Arial" font-weight="bold" font-size="30" fill="#b3261e" text-anchor="middle">TSSPDCL</text>
  <text x="490" y="336" font-family="Arial" font-size="20" fill="#b3261e" text-anchor="middle">SC No. ${sc}</text>
  <rect x="345" y="370" width="290" height="250" rx="8" fill="#2d3133"/>
  <rect x="380" y="400" width="220" height="70" rx="4" fill="#9fb48b"/>
  <text x="590" y="450" font-family="Consolas, monospace" font-size="44" fill="#1f2a1a" text-anchor="end">${reading}.${Math.floor(rand() * 9)}</text>
  <text x="392" y="418" font-family="Arial" font-size="12" fill="#1f2a1a">kWh</text>
  <circle cx="400" cy="520" r="7" fill="#e23a2b"/><text x="415" y="525" font-family="Arial" font-size="13" fill="#ddd">imp/kWh</text>
  <text x="490" y="590" font-family="Arial" font-size="15" fill="#bbb" text-anchor="middle">1 PHASE 2 WIRE  5-30 A  240 V</text>
  <rect x="300" y="250" width="380" height="460" rx="10" fill="none" stroke="#bdbcb5" stroke-width="4"/>
  <g filter="url(#drop)"><rect x="760" y="300" width="300" height="250" rx="6" fill="url(#greybox)"/></g>
  <rect x="790" y="350" width="240" height="120" rx="4" fill="#24292b" opacity="0.85"/>
  ${[0, 1, 2, 3].map((i) => `<rect x="${808 + i * 54}" y="372" width="40" height="76" rx="3" fill="#f3f3f0"/><rect x="${818 + i * 54}" y="398" width="20" height="18" fill="${i === 0 ? "#2e7d32" : "#555"}"/>`).join("")}
  <text x="910" y="520" font-family="Arial" font-size="18" fill="#444" text-anchor="middle">MCB  DB</text>
  <path d="M910 550 L910 ${H - 120}" stroke="#d7d9d4" stroke-width="16"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
};

const arrayRcc: Scene = (rand, seed) => {
  const t = terrace(rand, seed, { width: 12, depth: 15, parapet: pick(rand, PARAPETS), floor: pick(rand, FLOORS) });
  const perRow = 4 + Math.floor(rand() * 4);
  const rows = 1 + Math.floor(rand() * 2);
  const x0 = -((perRow * 1.15) / 2) + (rand() - 0.5) * 2;
  let extra = sintex(t.cam, t.hw - 1.6, t.d - 2.2, 0.65, 1.3);
  extra += panelRows(t.cam, { rows, perRow, x0, z0: 3.4 + rand() * 1.2, tilt: 14 + rand() * 6, rowGap: 3.9 });
  // DC cable tray running to the staircase head room.
  extra += line(t.cam, [x0, 0.05, 3.5], [-t.hw + 0.3, 0.05, 3.5], `stroke="#2a2a2a" stroke-width="6"`);
  extra += line(t.cam, [x0, 0.05, 3.62], [-t.hw + 0.3, 0.05, 3.62], `stroke="#9a1c1c" stroke-width="5"`);
  // Lightning arrestor on the parapet corner.
  extra += line(t.cam, [-t.hw + 0.1, 0.95, t.d - 0.1], [-t.hw + 0.1, 3.1, t.d - 0.1], `stroke="#b87333" stroke-width="5"`);
  return defs(seed) + t.svg + extra;
};

function panelClose(rand: () => number, seed: number, dusty = false, cracked = false): string {
  const cam: Cam = { x: 0.2, y: 1.7, z: -0.4, pitch: 0.55, yaw: (rand() - 0.5) * 0.5, f: 900 };
  const horizon = project(cam, [0, cam.y, 400])[1];
  let out = defs(seed) + `<rect width="${W}" height="${H}" fill="#9d9384"/><rect width="${W}" height="${H}" filter="url(#concrete)"/>`;
  if (horizon > 0) out += sky(horizon, rand(), rand) + skyline(horizon + 2, rand);
  out += panelRows(cam, { rows: 2, perRow: 5, x0: -3, z0: 1.4, tilt: 18, rowGap: 3.1, dust: dusty });
  if (dusty) {
    out += `<rect width="${W}" height="${H}" filter="url(#dust)" opacity="0.32"/>`;
    for (let i = 0; i < 26; i++) {
      const [x, y] = project(cam, [-3 + rand() * 5.5, 0.9 + rand() * 0.6, 1.8 + rand() * 1.5]);
      out += `<path d="M${x} ${y} q ${4 + rand() * 6} ${-6 - rand() * 6} ${10 + rand() * 8} 0 q ${-2} ${6 + rand() * 4} ${-8} ${6} z" fill="#f4f1e8" opacity="0.92"/>`;
    }
  }
  if (cracked) {
    const [cx, cy] = project(cam, [-0.6 + rand() * 1.2, 1.0, 2.1]);
    let cr = "";
    for (let i = 0; i < 14; i++) {
      let x = cx;
      let y = cy;
      let d = `M${x} ${y}`;
      const ang = rand() * Math.PI * 2;
      for (let k = 0; k < 6; k++) {
        x += Math.cos(ang + (rand() - 0.5) * 0.7) * (14 + rand() * 30);
        y += Math.sin(ang + (rand() - 0.5) * 0.7) * (10 + rand() * 22);
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      cr += `<path d="${d}" stroke="#e9eef5" stroke-width="${1 + rand() * 1.4}" fill="none" opacity="0.85"/>`;
    }
    out += `<circle cx="${cx}" cy="${cy}" r="10" fill="#e9eef5" opacity="0.7"/>${cr}`;
  }
  return out + `<rect width="${W}" height="${H}" fill="url(#vig)"/>`;
}

function inverterWall(rand: () => number, seed: number, display: { text: string; sub: string; fault?: boolean }) {
  const wall = pick(rand, ["#e1d6bf", "#d2d8cd", "#e7dcc6", "#cdc5b6"]);
  const ix = 430 + rand() * 60;
  const conduits = `<path d="M${ix + 60} 0 L${ix + 60} 210" stroke="#d6d8d3" stroke-width="18"/><path d="M${ix + 140} 0 L${ix + 140} 210" stroke="#d6d8d3" stroke-width="18"/>
  <path d="M${ix + 200} 600 L${ix + 200} 690 L 1040 690 L1040 620" stroke="#d6d8d3" stroke-width="18" fill="none"/>
  <path d="M${ix + 60} 600 L${ix + 60} 700 L 240 700 L240 640" stroke="#d6d8d3" stroke-width="18" fill="none"/>`;
  return `${defs(seed)}<rect width="${W}" height="${H}" fill="${wall}"/><rect width="${W}" height="${H}" filter="url(#plaster)" opacity="0.8"/>
  <rect y="${H - 90}" width="${W}" height="90" fill="#7a7062"/><rect y="${H - 90}" width="${W}" height="90" filter="url(#concrete)"/>
  ${conduits}
  <g filter="url(#drop)"><rect x="${ix}" y="200" width="300" height="410" rx="18" fill="url(#whitebox)"/></g>
  <rect x="${ix + 20}" y="225" width="260" height="40" rx="6" fill="#e9ebe7"/>
  <text x="${ix + 150}" y="252" font-family="Arial" font-weight="bold" font-size="19" fill="#2f4a6b" text-anchor="middle">SOLAR GRID-TIE INVERTER</text>
  <rect x="${ix + 55}" y="300" width="190" height="96" rx="6" fill="#1d2326"/>
  <rect x="${ix + 65}" y="310" width="170" height="76" rx="3" fill="${display.fault ? "#3b1f1f" : "#22343a"}"/>
  <text x="${ix + 150}" y="352" font-family="Consolas, monospace" font-size="34" fill="${display.fault ? "#ff6b5e" : "#9ff0c4"}" text-anchor="middle">${display.text}</text>
  <text x="${ix + 150}" y="376" font-family="Consolas, monospace" font-size="15" fill="${display.fault ? "#ffb3aa" : "#9ff0c4"}" text-anchor="middle">${display.sub}</text>
  <circle cx="${ix + 100}" cy="425" r="8" fill="${display.fault ? "#4a4a4a" : "#3ad35f"}"/><circle cx="${ix + 150}" cy="425" r="8" fill="#4a4a4a"/><circle cx="${ix + 200}" cy="425" r="8" fill="${display.fault ? "#ff3b30" : "#4a4a4a"}"/>
  <text x="${ix + 100}" y="452" font-family="Arial" font-size="12" fill="#555" text-anchor="middle">RUN</text><text x="${ix + 150}" y="452" font-family="Arial" font-size="12" fill="#555" text-anchor="middle">COM</text><text x="${ix + 200}" y="452" font-family="Arial" font-size="12" fill="#555" text-anchor="middle">FAULT</text>
  ${[0, 1, 2, 3].map((i) => `<rect x="${ix + 70 + i * 45}" y="590" width="26" height="34" rx="4" fill="#232323"/>`).join("")}
  <g filter="url(#drop)"><rect x="140" y="440" width="200" height="200" rx="8" fill="url(#greybox)"/><rect x="940" y="420" width="200" height="200" rx="8" fill="url(#greybox)"/></g>
  <rect x="160" y="480" width="160" height="90" rx="4" fill="#2b3134" opacity="0.8"/><rect x="960" y="460" width="160" height="90" rx="4" fill="#2b3134" opacity="0.8"/>
  ${[0, 1, 2].map((i) => `<rect x="${172 + i * 48}" y="492" width="36" height="66" rx="3" fill="#f2f2ef"/><rect x="${972 + i * 48}" y="472" width="36" height="66" rx="3" fill="#f2f2ef"/><rect x="${182 + i * 48}" y="512" width="16" height="16" fill="#555"/><rect x="${982 + i * 48}" y="492" width="16" height="16" fill="${i === 1 ? "#c62828" : "#555"}"/>`).join("")}
  <text x="240" y="610" font-family="Arial" font-weight="bold" font-size="20" fill="#3b3b3b" text-anchor="middle">ACDB</text>
  <text x="1040" y="590" font-family="Arial" font-weight="bold" font-size="20" fill="#3b3b3b" text-anchor="middle">DCDB</text>
  <path d="M${1040} 420 L1040 0" stroke="#b02020" stroke-width="7"/><path d="M${1058} 420 L1058 0" stroke="#111" stroke-width="7"/>
  <rect x="${ix + 70}" y="650" width="160" height="24" rx="3" fill="#fff" stroke="#999"/><text x="${ix + 150}" y="667" font-family="Arial" font-size="13" fill="#b3261e" text-anchor="middle">DANGER 230 V AC</text>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
}

const inverterOk: Scene = (rand, seed) => inverterWall(rand, seed, { text: `${(1.8 + rand() * 2.6).toFixed(2)} kW`, sub: `E-Today ${(6 + rand() * 12).toFixed(1)} kWh` });
const inverterFault: Scene = (rand, seed) => inverterWall(rand, seed, { text: pick(rand, ["E-22", "F-03", "E-07"]), sub: pick(rand, ["ISO FAULT", "GRID VOLT HIGH", "DC OVER VOLT"]), fault: true });

const batteryBank: Scene = (rand, seed) => {
  const n = 2 + 2 * Math.floor(rand() * 2);
  const wall = pick(rand, ["#d8cfbd", "#c8cfc4", "#ddd2bd"]);
  let bats = "";
  const bw = 150;
  const startX = W / 2 - (n * (bw + 24)) / 2;
  for (let i = 0; i < n; i++) {
    const x = startX + i * (bw + 24);
    bats += `<g filter="url(#drop)"><rect x="${x}" y="470" width="${bw}" height="360" rx="10" fill="url(#whitebox)"/></g>
    <rect x="${x}" y="470" width="${bw}" height="70" rx="10" fill="#1f4f8f"/>
    <text x="${x + bw / 2}" y="640" font-family="Arial" font-weight="bold" font-size="20" fill="#1f4f8f" text-anchor="middle">TUBULAR</text>
    <text x="${x + bw / 2}" y="668" font-family="Arial" font-size="16" fill="#444" text-anchor="middle">12 V  150 Ah</text>
    <circle cx="${x + 35}" cy="460" r="14" fill="#c62828"/><circle cx="${x + bw - 35}" cy="460" r="14" fill="#222"/>
    ${[0, 1, 2].map((k) => `<circle cx="${x + 45 + k * 30}" cy="505" r="9" fill="#e9e9e4"/>`).join("")}`;
    if (i < n - 1) bats += `<path d="M${x + bw - 35} 456 Q ${x + bw + 12} 420 ${x + bw + 24 + 35} 456" stroke="#111" stroke-width="9" fill="none"/>`;
  }
  return `${defs(seed)}<rect width="${W}" height="${H}" fill="${wall}"/><rect width="${W}" height="${H}" filter="url(#plaster)" opacity="0.8"/>
  <rect y="${H - 140}" width="${W}" height="140" fill="#857868"/><rect y="${H - 140}" width="${W}" height="140" filter="url(#concrete)"/>
  <rect x="${W / 2 - (n * 174) / 2 - 20}" y="820" width="${n * 174 + 30}" height="40" fill="#6b4a2c"/>
  <g filter="url(#drop)"><rect x="${W / 2 - 160}" y="90" width="320" height="250" rx="14" fill="#2b2f33"/></g>
  <rect x="${W / 2 - 120}" y="140" width="240" height="70" rx="5" fill="#1b4252"/>
  <text x="${W / 2}" y="186" font-family="Consolas, monospace" font-size="30" fill="#a8f0ff" text-anchor="middle">BATT ${(48 + rand() * 4).toFixed(1)}V</text>
  <text x="${W / 2}" y="250" font-family="Arial" font-weight="bold" font-size="20" fill="#e7e7e7" text-anchor="middle">SOLAR PCU</text>
  <path d="M${W / 2 - 60} 340 L${W / 2 - 60} 440 L${startX + 35} 440 L${startX + 35} 450" stroke="#c62828" stroke-width="10" fill="none"/>
  <path d="M${W / 2 + 60} 340 L${W / 2 + 60} 430 L${startX + (n - 1) * 174 + bw - 35} 430 L${startX + (n - 1) * 174 + bw - 35} 450" stroke="#111" stroke-width="10" fill="none"/>
  ${bats}<rect width="${W}" height="${H}" fill="url(#vig)"/>`;
};

const netMeter: Scene = (rand, seed) => {
  const imp = (1000 + rand() * 4000).toFixed(1);
  const exp = (200 + rand() * 1800).toFixed(1);
  return `${defs(seed)}<rect width="${W}" height="${H}" fill="#d9d2c0"/><rect width="${W}" height="${H}" filter="url(#plaster)" opacity="0.8"/>
  <g filter="url(#drop)"><rect x="390" y="150" width="500" height="640" rx="16" fill="#efeee8"/></g>
  <rect x="430" y="190" width="420" height="560" rx="12" fill="#3a3f42"/>
  <text x="640" y="240" font-family="Arial" font-weight="bold" font-size="24" fill="#f2f2f2" text-anchor="middle">BI-DIRECTIONAL NET METER</text>
  <rect x="480" y="280" width="320" height="150" rx="6" fill="#a8bc92"/>
  <text x="780" y="345" font-family="Consolas, monospace" font-size="46" fill="#1e2a19" text-anchor="end">${imp}</text>
  <text x="500" y="312" font-family="Arial" font-size="15" fill="#1e2a19">IMPORT kWh</text>
  <text x="780" y="410" font-family="Consolas, monospace" font-size="34" fill="#1e2a19" text-anchor="end">-${exp}</text>
  <text x="500" y="404" font-family="Arial" font-size="15" fill="#1e2a19">EXPORT</text>
  <circle cx="520" cy="490" r="9" fill="#e23a2b"/><text x="540" y="496" font-family="Arial" font-size="15" fill="#ddd">imp</text>
  <circle cx="640" cy="490" r="9" fill="#2bd34d"/><text x="660" y="496" font-family="Arial" font-size="15" fill="#ddd">exp</text>
  <text x="640" y="580" font-family="Arial" font-size="17" fill="#cfcfcf" text-anchor="middle">1Ph 2W  10-60 A  240 V  Class 1.0</text>
  <rect x="560" y="640" width="160" height="70" rx="6" fill="#d1d1cb"/><circle cx="600" cy="675" r="12" fill="#c62828"/><text x="660" y="682" font-family="Arial" font-size="16" fill="#333">SEAL</text>
  <text x="640" y="840" font-family="Arial" font-weight="bold" font-size="26" fill="#b3261e" text-anchor="middle">NET METER - DISCOM SEALED</text>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
};

const earthPit: Scene = (rand, seed) => {
  const cam: Cam = { x: 0, y: 1.3, z: -0.2, pitch: 0.85, yaw: (rand() - 0.5) * 0.4, f: 950 };
  const ground = poly(cam, [[-6, 0, 0.5], [6, 0, 0.5], [6, 0, 8], [-6, 0, 8]], `fill="#6e5a43"`);
  const tex = poly(cam, [[-6, 0, 0.5], [6, 0, 0.5], [6, 0, 8], [-6, 0, 8]], `fill="#000" filter="url(#soil)"`);
  let grass = "";
  for (let i = 0; i < 900; i++) {
    const [gx, gy] = project(cam, [(rand() - 0.5) * 6, 0, 0.6 + rand() * 4]);
    if (Math.abs(gx - W / 2) < 190 && Math.abs(gy - H / 2) < 150) continue;
    grass += `<path d="M${gx} ${gy} l ${(rand() - 0.5) * 8} ${-10 - rand() * 18}" stroke="rgb(${50 + rand() * 50},${100 + rand() * 70},${30 + rand() * 30})" stroke-width="${1.5 + rand() * 1.5}"/>`;
  }
  const s = 0.3;
  const zc = 1.45;
  const chamber = poly(cam, [[-s - 0.08, 0.05, zc - s - 0.08], [s + 0.08, 0.05, zc - s - 0.08], [s + 0.08, 0.05, zc + s + 0.08], [-s - 0.08, 0.05, zc + s + 0.08]], `fill="#b9b2a5"`);
  const lid = poly(cam, [[-s, 0.07, zc - s], [s, 0.07, zc - s], [s, 0.07, zc + s], [-s, 0.07, zc + s]], `fill="#8f897d"`);
  const [lx, ly] = project(cam, [0, 0.07, zc]);
  return `${defs(seed)}<rect width="${W}" height="${H}" fill="#6e5a43"/>${ground}${tex}${grass}${chamber}${lid}
  <text x="${lx}" y="${ly - 6}" font-family="Arial" font-weight="bold" font-size="30" fill="#f5e663" text-anchor="middle">EARTH PIT</text>
  <text x="${lx}" y="${ly + 30}" font-family="Arial" font-weight="bold" font-size="24" fill="#f5e663" text-anchor="middle">E-${1 + Math.floor(rand() * 3)}  &lt;1 Ω</text>
  <path d="M${lx + 40} ${ly + 70} C ${lx + 120} ${ly + 140}, ${lx + 260} ${ly + 160}, ${W} ${ly + 120}" stroke="#2e7d32" stroke-width="10" fill="none"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
};

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A paper photographed on a wooden desk, slightly rotated. */
function documentPhoto(rand: () => number, seed: number, doc: { header: string; sub: string; title: string; lines: string[]; stamp: string; accent: string }) {
  const rot = (rand() - 0.5) * 6;
  const wood = pick(rand, ["#7a4f2c", "#8a5a33", "#6b4528"]);
  let grain = "";
  for (let y = 0; y < H; y += 7) grain += `<path d="M0 ${y} C ${W * 0.3} ${y + (rand() - 0.5) * 14}, ${W * 0.7} ${y + (rand() - 0.5) * 14}, ${W} ${y}" stroke="#000" stroke-width="${0.6 + rand() * 1.6}" opacity="${(0.06 + rand() * 0.1).toFixed(2)}" fill="none"/>`;
  const body = doc.lines.map((l, i) => `<text x="150" y="${330 + i * 34}" font-family="Arial" font-size="20" fill="#2d2d2d">${esc(l)}</text>`).join("");
  return `${defs(seed)}<rect width="${W}" height="${H}" fill="${wood}"/>${grain}
  <g transform="rotate(${rot.toFixed(2)} ${W / 2} ${H / 2})">
    <g filter="url(#drop)"><rect x="110" y="60" width="${W - 220}" height="${H - 80}" fill="#f7f5ee"/></g>
    <rect x="110" y="60" width="${W - 220}" height="${H - 80}" fill="#000" filter="url(#speckle)" opacity="0.06"/>
    <rect x="110" y="60" width="${W - 220}" height="96" fill="${doc.accent}"/>
    <text x="${W / 2}" y="104" font-family="Arial" font-weight="bold" font-size="28" fill="#fff" text-anchor="middle">${esc(doc.header)}</text>
    <text x="${W / 2}" y="136" font-family="Arial" font-size="17" fill="#fff" text-anchor="middle" opacity="0.9">${esc(doc.sub)}</text>
    <text x="${W / 2}" y="236" font-family="Arial" font-weight="bold" font-size="30" fill="#1d1d1d" text-anchor="middle">${esc(doc.title)}</text>
    <line x1="150" y1="262" x2="${W - 150}" y2="262" stroke="#999" stroke-width="1.5"/>
    ${body}
    <circle cx="${W - 300}" cy="${H - 170}" r="74" fill="none" stroke="#2c4fa3" stroke-width="5" opacity="0.75"/>
    <circle cx="${W - 300}" cy="${H - 170}" r="58" fill="none" stroke="#2c4fa3" stroke-width="2" opacity="0.75"/>
    <text x="${W - 300}" y="${H - 176}" font-family="Arial" font-weight="bold" font-size="17" fill="#2c4fa3" text-anchor="middle" opacity="0.8">${doc.stamp}</text>
    <text x="${W - 300}" y="${H - 152}" font-family="Arial" font-size="13" fill="#2c4fa3" text-anchor="middle" opacity="0.8">HYDERABAD</text>
    <path d="M160 ${H - 150} c 30 -40, 50 30, 80 -10 s 40 -30, 60 10 s 30 10, 70 -20" stroke="#1d3d8f" stroke-width="3" fill="none"/>
    <text x="160" y="${H - 110}" font-family="Arial" font-size="16" fill="#555">Authorised signatory</text>
  </g>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
}

const app = (rand: () => number) => `PMSG-TS-2026-${100000 + Math.floor(rand() * 89999)}`;
const docApplication: Scene = (rand, seed) =>
  documentPhoto(rand, seed, {
    header: "PM SURYA GHAR: MUFT BIJLI YOJANA",
    sub: "Government of India · Ministry of New and Renewable Energy",
    title: "Application Acknowledgement",
    accent: "#e07b1a",
    stamp: "SUBMITTED",
    lines: [`Application No.  ${app(rand)}`, "State: Telangana        DISCOM: TSSPDCL", `Consumer No.  1${String(Math.floor(rand() * 9e7)).padStart(8, "0")}`, `Proposed capacity:  ${1 + Math.floor(rand() * 4)} kWp (rooftop, on-grid)`, "Registered vendor:  SunPower Solutions Pvt. Ltd.", "Status:  Submitted for technical feasibility", "Documents: Electricity bill, Aadhaar, roof photo"],
  });
const docFeasibility: Scene = (rand, seed) =>
  documentPhoto(rand, seed, {
    header: "TELANGANA SOUTHERN POWER DISTRIBUTION CO. LTD",
    sub: "A Government of Telangana Undertaking · Rooftop Solar Cell",
    title: "Technical Feasibility Approval",
    accent: "#1f5aa6",
    stamp: "APPROVED",
    lines: [`Ref:  TSSPDCL/RTS/${2026}/${Math.floor(rand() * 9000) + 1000}`, `Application No.  ${app(rand)}`, "Sanctioned load is adequate for the proposed system.", "Distribution transformer capacity verified: Feasible.", "The consumer may proceed with installation by the", "registered vendor. Net meter to be installed after", "commissioning report is uploaded on the portal."],
  });
const docInspection: Scene = (rand, seed) =>
  documentPhoto(rand, seed, {
    header: "TELANGANA SOUTHERN POWER DISTRIBUTION CO. LTD",
    sub: "A Government of Telangana Undertaking · Rooftop Solar Cell",
    title: "Joint Inspection & Commissioning Report",
    accent: "#1f5aa6",
    stamp: "INSPECTED",
    lines: [`Application No.  ${app(rand)}`, `Inverter make: Growatt   Panels: ${4 + Math.floor(rand() * 8)} x 545 Wp DCR`, `Earth resistance:  ${(0.4 + rand() * 0.5).toFixed(2)} ohm   (limit 1 ohm)`, "Anti-islanding test:  PASS", `Net meter No.  NM${Math.floor(rand() * 9e6) + 1e6}  sealed`, "Installation conforms to MNRE guidelines.", "Recommended for release of Central Financial Assistance."],
  });
const docDisbursement: Scene = (rand, seed) =>
  documentPhoto(rand, seed, {
    header: "STATE BANK OF INDIA",
    sub: "Branch: Madhapur, Hyderabad · IFSC SBIN0011223",
    title: "Account Credit Advice",
    accent: "#2c3e8f",
    stamp: "CREDITED",
    lines: [`Date:  ${String(1 + Math.floor(rand() * 27)).padStart(2, "0")}-0${1 + Math.floor(rand() * 9)}-2026`, "Remitter:  MNRE - PM SURYA GHAR CFA", `Amount credited:  Rs ${pick(rand, ["30,000", "60,000", "78,000", "78,000"])}.00`, "Mode:  DBT / NEFT", `UTR:  SBIN${Math.floor(rand() * 9e11) + 1e11}`, `Narration:  CFA RTS ${app(rand)}`, "This is a computer generated advice."],
  });

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

/**
 * A customer's on-screen signature as the tablet would capture it: their name
 * in a handwriting face (Windows fonts, so seed from a Windows machine) with a
 * flourish, blue ink on a transparent background.
 */
export async function signatureDataUrl(name: string): Promise<string> {
  const rand = prng([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
  const parts = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(" ")} ${parts.at(-1)![0]}.` : parts[0]!;
  const font = pick(rand, ["Segoe Script", "Ink Free", "Lucida Handwriting"]);
  const size = Math.min(44, Math.floor(640 / Math.max(8, text.length)));
  const tilt = (-6 + rand() * 5).toFixed(1);
  const y = 92 + rand() * 6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140"><g transform="rotate(${tilt} 200 70)"><text x="24" y="78" font-family="${font}" font-size="${size}" fill="#1d3d8f">${esc(text)}</text><path d="M28 ${y.toFixed(0)} C ${120 + rand() * 40} ${(y - 12).toFixed(0)}, ${230 + rand() * 40} ${(y + 12).toFixed(0)}, ${330 + rand() * 40} ${(y - 6).toFixed(0)}" stroke="#1d3d8f" stroke-width="2.4" fill="none" stroke-linecap="round"/></g></svg>`;
  const png = await sharp(Buffer.from(svg)).png({ palette: true, colours: 8 }).toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */

export type PhotoKey =
  | "roof_empty"
  | "roof_shade"
  | "metal_roof"
  | "meter_board"
  | "array"
  | "panel_close"
  | "inverter_wall"
  | "battery_bank"
  | "net_meter"
  | "earth_pit"
  | "dusty_panel"
  | "cracked_panel"
  | "inverter_fault"
  | "doc_application"
  | "doc_feasibility"
  | "doc_inspection"
  | "doc_disbursement";

const LIBRARY: { key: PhotoKey; variants: number; scene: Scene }[] = [
  { key: "roof_empty", variants: 4, scene: roofEmpty },
  { key: "roof_shade", variants: 2, scene: roofShade },
  { key: "metal_roof", variants: 2, scene: metalRoof },
  { key: "meter_board", variants: 3, scene: meterBoard },
  { key: "array", variants: 4, scene: arrayRcc },
  { key: "panel_close", variants: 2, scene: (r, s) => panelClose(r, s) },
  { key: "inverter_wall", variants: 3, scene: inverterOk },
  { key: "battery_bank", variants: 2, scene: batteryBank },
  { key: "net_meter", variants: 2, scene: netMeter },
  { key: "earth_pit", variants: 2, scene: earthPit },
  { key: "dusty_panel", variants: 2, scene: (r, s) => panelClose(r, s, true) },
  { key: "cracked_panel", variants: 2, scene: (r, s) => panelClose(r, s, false, true) },
  { key: "inverter_fault", variants: 2, scene: inverterFault },
  { key: "doc_application", variants: 2, scene: docApplication },
  { key: "doc_feasibility", variants: 2, scene: docFeasibility },
  { key: "doc_inspection", variants: 2, scene: docInspection },
  { key: "doc_disbursement", variants: 2, scene: docDisbursement },
];

/** SVG → pixels, then a phone camera's look: grain, slight softness, warm cast, JPEG. */
async function render(svg: string, seed: number): Promise<Buffer> {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>`;
  const { data, info } = await sharp(Buffer.from(doc)).blur(0.6).raw().toBuffer({ resolveWithObject: true });
  const rand = prng(seed * 7 + 3);
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    const n = (rand() + rand() + rand() - 1.5) * 9;
    data[i] = Math.max(0, Math.min(255, data[i]! * 1.02 + n + 2));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! * 0.97 + n - 2));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } })
    .removeAlpha()
    .resize(1024, 768)
    .jpeg({ quality: 74, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
}

export async function renderLibrary(): Promise<{ name: string; key: PhotoKey; data: Buffer }[]> {
  const out: { name: string; key: PhotoKey; data: Buffer }[] = [];
  let seed = 11;
  for (const entry of LIBRARY) {
    for (let v = 1; v <= entry.variants; v++) {
      seed += 17;
      const svg = entry.scene(prng(seed), seed % 997);
      out.push({ name: `seed-${entry.key}-${v}.jpg`, key: entry.key, data: await render(svg, seed) });
    }
  }
  return out;
}

/**
 * Upload the library once (looked up by file name, so re-runs reuse it) and
 * return the GridFS ids per key.
 */
export async function ensurePhotoLibrary(uploadedBy: string): Promise<Map<PhotoKey, string[]>> {
  const files = mongoose.connection.db!.collection<{ _id: mongoose.Types.ObjectId; filename: string }>("media.files");
  const names = LIBRARY.flatMap((e) => Array.from({ length: e.variants }, (_, i) => `seed-${e.key}-${i + 1}.jpg`));
  const existing = new Map((await files.find({ filename: { $in: names } }).project<{ _id: mongoose.Types.ObjectId; filename: string }>({ filename: 1 }).toArray()).map((f) => [f.filename, String(f._id)]));
  const byKey = new Map<PhotoKey, string[]>();
  const missing = names.filter((n) => !existing.has(n));
  const rendered = missing.length ? (await renderLibrary()).filter((p) => missing.includes(p.name)) : [];
  for (const p of rendered) existing.set(p.name, await saveSmallFile({ data: p.data, filename: p.name, contentType: "image/jpeg", kind: "image", uploadedBy }));
  for (const e of LIBRARY) byKey.set(e.key, Array.from({ length: e.variants }, (_, i) => existing.get(`seed-${e.key}-${i + 1}.jpg`)!));
  return byKey;
}

// Preview: npx tsx scripts/seed/photos.ts <dir>
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed/photos.ts")) {
  const dir = process.argv[2] ?? "photos-preview";
  void (async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    let bytes = 0;
    for (const p of await renderLibrary()) {
      await writeFile(`${dir}/${p.name}`, p.data);
      bytes += p.data.length;
    }
    console.log(`Wrote ${LIBRARY.reduce((s, e) => s + e.variants, 0)} photos (${(bytes / 1024).toFixed(0)} KB) to ${dir}`);
  })();
}
