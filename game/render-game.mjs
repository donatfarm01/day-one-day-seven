// Starfall — a tiny vertical arcade catcher, rendered from a live simulation.
// You steer a basket along the bottom and catch falling stars. Miss 3 and the
// run ends. Day 1 is the bare first build; Day 7 is the same game after a
// week of daily updates: same map, same opening, visibly more going on.
//
// This file simulates the game (seeded RNG, basket path, star spawns,
// collisions, particles, HUD) and draws every frame as raw RGB24 pixels to
// stdout, for ffmpeg to encode. Nothing is hand-edited: the footage comes
// from the simulation running here.
//
// Usage:
//   node render-game.mjs --mode day1 --seconds 14 | ffmpeg -f rawvideo \
//     -pix_fmt rgb24 -s 1080x1920 -r 30 -i - -an -c:v libx264 \
//     -pix_fmt yuv420p -crf 18 -preset veryfast day1.mp4
import fs from "node:fs";

const W = 1080;
const H = 1920;
const FPS = 30;

const args = process.argv.slice(2);
const mode = args[args.indexOf("--mode") + 1] || "day1";
const seconds = parseFloat(args[args.indexOf("--seconds") + 1] || "14");
const day7 = mode === "day7";

// ---------- deterministic RNG ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 5x7 bitmap font (glyph = 7 rows of 5 bits) ----------
const FONT = {
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
};

// ---------- pixel helpers (frame is a Buffer of W*H*3 RGB) ----------
function setPx(buf, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
}
function blendPx(buf, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = Math.round(buf[i] * (1 - a) + r * a);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + g * a);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + b * a);
}
function fillRect(buf, x, y, w, h, c) {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++, i += 3) {
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
  }
}
function fillCircle(buf, cx, cy, r, c) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPx(buf, x, y, c[0], c[1], c[2]);
    }
  }
}
function fillDiamond(buf, cx, cy, r, c) {
  // a 4-point star: two overlapping diamonds, one rotated 45 degrees
  for (let d = -r; d <= r; d++) {
    const w = r - Math.abs(d);
    for (let x = -w; x <= w; x++) {
      setPx(buf, Math.round(cx + x), Math.round(cy + d), c[0], c[1], c[2]);
      setPx(buf, Math.round(cx + d), Math.round(cy + x), c[0], c[1], c[2]);
    }
  }
}
function drawText(buf, text, x, y, scale, c) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] || FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row] & (1 << (4 - col))) {
          fillRect(buf, cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
  return cx;
}
function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

// ---------- colours ----------
const C = {
  white: [255, 255, 255],
  gold: [255, 209, 102],
  coin: [255, 207, 63],
  pink: [255, 93, 115],
  cyan: [80, 220, 255],
  ink: [25, 20, 25],
  basket1: [232, 232, 232],
  basket7: [255, 209, 102],
  dim: [150, 160, 190],
};

// ---------- static background, precomputed once ----------
function buildBackground() {
  const bg = Buffer.alloc(W * H * 3);
  if (!day7) {
    // Day 1: flat slate grey, a faint ground line
    for (let i = 0; i < W * H; i++) {
      bg[i * 3] = 35; bg[i * 3 + 1] = 39; bg[i * 3 + 2] = 46;
    }
    fillRect(bg, 0, 1780, W, 4, [70, 76, 92]);
    return bg;
  }
  // Day 7: deep indigo night gradient
  const stops = [[23, 18, 51], [44, 26, 94], [74, 35, 96]];
  for (let y = 0; y < H; y++) {
    const f = y / H;
    const si = Math.min(1, Math.floor(f * 2));
    const lf = Math.min(1, f * 2 - si);
    const a = stops[si], b = stops[Math.min(2, si + 1)];
    const r = Math.round(a[0] + (b[0] - a[0]) * lf);
    const g = Math.round(a[1] + (b[1] - a[1]) * lf);
    const bl = Math.round(a[2] + (b[2] - a[2]) * lf);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      bg[i] = r; bg[i + 1] = g; bg[i + 2] = bl;
    }
  }
  fillRect(bg, 0, 1780, W, 4, [120, 90, 180]);
  return bg;
}

// ---------- game state ----------
const rng = mulberry32(1337);
// The opening is identical in both builds: the same first three spawns.
const sharedSpawns = [];
{
  let t = 0.6;
  for (let i = 0; i < 3; i++) {
    sharedSpawns.push({ t, x: 200 + rng() * 680, kind: "star", speed: 430 });
    t += 1.35;
  }
}
// Day 7 starfield + clouds (seeded, static layout)
const fieldStars = [];
if (day7) {
  const r2 = mulberry32(4242);
  for (let i = 0; i < 140; i++) {
    fieldStars.push({ x: r2() * W, y: r2() * 1500, s: 2 + r2() * 3, ph: r2() * 6.28, tw: 0.6 + r2() * 1.8 });
  }
}
const clouds = day7
  ? [{ x: 150, y: 420, r: 150, v: 6 }, { x: 800, y: 700, r: 190, v: -4 }, { x: 420, y: 1050, r: 170, v: 5 }]
  : [];

const state = {
  score: 0,
  combo: 0,
  hearts: 3,
  shield: false,
  shieldFlash: 0,
  level: 1,
  stars: [],       // {x, y, speed, kind, sway, ph}
  particles: [],   // {x, y, vx, vy, life, maxLife, c}
  spawnIdx: 0,     // index into sharedSpawns
  spawnTimer: 0,
  extraTimer: 0,
  shieldSpawned: false,
  bannerT: -1,     // time the LEVEL 2 banner started
  bannerShown: false,
  lastCatchT: -10,
  misses: 0,
};

function basketX(t) {
  // same steering in both builds — the basket is the player's hands
  const x = 540 + 300 * Math.sin(t * 0.9) + 120 * Math.sin(t * 0.53 + 1.7);
  return Math.max(150, Math.min(930, x));
}

function spawnStar(ev) {
  state.stars.push({
    x: ev.x, y: -40, speed: ev.speed, kind: ev.kind,
    sway: 30 + rng() * 40, ph: rng() * 6.28,
  });
}

function burst(x, y, colors, n) {
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.283, sp = 120 + rng() * 380;
    state.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
      life: 0.55, maxLife: 0.55, c: colors[i % colors.length],
    });
  }
}

const bg = buildBackground();
const totalFrames = Math.floor(seconds * FPS);
// The basket steers toward the lowest falling object once play starts —
// Day 1 reacts slower (500 px/s) than Day 7 (900 px/s). The first 2.5 s
// keep the fixed opening path, so both builds open identically.
let basketPos = 540;

for (let f = 0; f < totalFrames; f++) {
  const t = f / FPS;
  const dt = 1 / FPS;
  let bx;
  if (t < 2.5) {
    bx = basketX(t);
    basketPos = bx;
  } else {
    let target = null;
    for (const s of state.stars) {
      if (!target || s.y > target.y) target = s;
    }
    if (target) {
      const tx = target.x + Math.sin(t * 2 + target.ph) * target.sway * 0.25;
      const maxStep = (day7 ? 900 : 500) * dt;
      const dx = tx - basketPos;
      basketPos += Math.max(-maxStep, Math.min(maxStep, dx));
    }
    bx = basketPos;
  }

  // ----- spawning -----
  if (state.spawnIdx < sharedSpawns.length) {
    const ev = sharedSpawns[state.spawnIdx];
    if (t >= ev.t) { spawnStar(ev); state.spawnIdx++; }
  } else if (!day7) {
    // Day 1: one star at a time, calm pace
    state.spawnTimer -= dt;
    if (state.stars.length === 0 && state.spawnTimer <= 0) {
      spawnStar({ x: 200 + rng() * 680, kind: "star", speed: 430 });
      state.spawnTimer = 1.0;
    }
  } else {
    // Day 7: up to 5 at once, coins mixed in, faster
    state.extraTimer -= dt;
    if (state.stars.length < 5 && state.extraTimer <= 0) {
      const kind = (Math.floor(t * 3) % 5 === 4) ? "coin" : "star";
      spawnStar({ x: 140 + rng() * 800, kind, speed: 520 + rng() * 220 });
      state.extraTimer = 0.34;
    }
    // LEVEL 2 banner at 14s into the Day 7 clip
    if (!state.bannerShown && t >= 14) {
      state.bannerShown = true; state.bannerT = t; state.level = 2;
    }
    // shield power-up at 19s
    if (!state.shieldSpawned && t >= 19) {
      state.shieldSpawned = true;
      state.stars.push({ x: bx, y: -40, speed: 480, kind: "shield", sway: 0, ph: 0 });
    }
  }

  // ----- update stars -----
  const basketTop = 1700, basketBottom = 1760, catchHalf = 130;
  for (let i = state.stars.length - 1; i >= 0; i--) {
    const s = state.stars[i];
    s.y += s.speed * dt;
    const sx = s.x + Math.sin(t * 2 + s.ph) * s.sway * 0.25;
    if (s.y >= basketTop && s.y <= basketBottom && Math.abs(sx - bx) < catchHalf) {
      // caught!
      state.stars.splice(i, 1);
      if (s.kind === "shield") {
        state.shield = true; state.shieldFlash = 1.2;
        burst(sx, basketTop, [C.cyan, C.white], day7 ? 22 : 8);
      } else {
        state.combo = Math.min(8, state.combo + 1);
        state.lastCatchT = t;
        const pts = s.kind === "coin" ? 25 : 10 * state.combo;
        state.score += pts;
        if (day7) burst(sx, basketTop, [C.gold, C.white, C.pink], 16);
      }
      continue;
    }
    if (s.y > 1830) {
      // missed — hits the ground
      state.stars.splice(i, 1);
      if (s.kind === "shield") continue;
      if (state.shield) {
        state.shield = false; state.shieldFlash = 1.0;
        burst(sx, 1800, [C.cyan, C.white], 18);
      } else {
        state.combo = 0;
        state.hearts = Math.max(0, state.hearts - 1);
        state.misses++;
        if (day7) burst(sx, 1800, [[120, 120, 140]], 8);
      }
    }
  }

  // ----- update particles -----
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
  }
  if (state.shieldFlash > 0) state.shieldFlash -= dt;
  if (state.combo > 0 && t - state.lastCatchT > 2.5) state.combo = 0;

  // ----- draw frame -----
  const frame = Buffer.from(bg);

  if (day7) {
    // twinkling starfield
    for (const s of fieldStars) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.tw + s.ph));
      const v = Math.round(200 * a);
      fillRect(frame, Math.round(s.x), Math.round(s.y), s.s, s.s, [v, v, Math.min(255, v + 40)]);
    }
    // drifting clouds (soft, translucent)
    for (const cl of clouds) {
      const cx = ((cl.x + cl.v * t) % (W + 400)) - 200;
      for (let dx = -cl.r; dx <= cl.r; dx += 2) {
        for (let dy = -cl.r * 0.45; dy <= cl.r * 0.45; dy += 2) {
          const nx = dx / cl.r, ny = dy / (cl.r * 0.45);
          if (nx * nx + ny * ny <= 1) blendPx(frame, Math.round(cx + dx), Math.round(cl.y + dy), 200, 180, 255, 0.05);
        }
      }
    }
  }

  // stars / coins / shield
  for (const s of state.stars) {
    const sx = s.x + Math.sin(t * 2 + s.ph) * s.sway * 0.25;
    if (s.kind === "coin") {
      fillCircle(frame, sx, s.y, 38, C.coin);
      fillCircle(frame, sx, s.y, 26, [184, 138, 20]);
      fillCircle(frame, sx, s.y, 15, C.coin);
    } else if (s.kind === "shield") {
      fillCircle(frame, sx, s.y, 34, C.cyan);
      fillCircle(frame, sx, s.y, 26, [20, 60, 90]);
      drawText(frame, "S", sx - 14, s.y - 18, 5, C.cyan);
    } else {
      const col = day7 ? C.gold : C.white;
      // soft glow so the star reads at a glance on a phone screen
      for (let gy = -64; gy <= 64; gy += 2) {
        for (let gx = -64; gx <= 64; gx += 2) {
          if (gx * gx + gy * gy <= 64 * 64) {
            blendPx(frame, Math.round(sx + gx), Math.round(s.y + gy), col[0], col[1], col[2], 0.10);
          }
        }
      }
      fillDiamond(frame, sx, s.y, 42, col);
      fillCircle(frame, sx, s.y, 13, C.white);
    }
  }

  // particles
  for (const p of state.particles) {
    const a = p.life / p.maxLife;
    const sz = 4 + Math.round(4 * a);
    fillRect(frame, Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz, p.c);
  }

  // basket: trapezoid body (narrower at the bottom) + rim + weave slats
  const bw = day7 ? 240 : 230;
  const bc = day7 ? C.basket7 : C.basket1;
  const slat = day7 ? [214, 164, 60] : [180, 180, 180];
  for (let yy = 0; yy < 60; yy++) {
    const w = bw - ((bw - (bw - 60)) * yy) / 60;
    fillRect(frame, bx - w / 2, basketTop + yy, w, 1, bc);
  }
  fillRect(frame, bx - bw / 2 - 10, basketTop - 10, bw + 20, 14, bc);
  for (const off of [-70, 0, 70]) {
    fillRect(frame, bx + off - 3, basketTop + 6, 6, 48, slat);
  }
  if (state.shield) {
    // cyan glow ring while the shield holds
    fillRect(frame, bx - bw / 2 - 6, basketTop - 6, bw + 12, 4, C.cyan);
    fillRect(frame, bx - bw / 2 - 6, basketBottom, bw + 12, 4, C.cyan);
  }
  if (state.shieldFlash > 0) {
    drawText(frame, "SHIELD!", bx - textWidth("SHIELD!", 6) / 2, basketTop - 90, 6, C.cyan);
  }

  // ----- HUD (bitmap font, drawn by the simulation itself) -----
  // Score is right-aligned clear of the make.fun badge (top-left, x120..450).
  // Scale 8 keeps even a 4-digit score ("SCORE 1540", 472 px wide) starting
  // right of the badge edge.
  const scoreText = "SCORE " + String(state.score).padStart(3, "0");
  drawText(frame, scoreText, 960 - textWidth(scoreText, 8), 290, 8, C.white);
  // hearts, top right, below the score line
  for (let h = 0; h < 3; h++) {
    const hx = 830 + h * 62, hy = 395;
    const col = h < state.hearts ? C.pink : [70, 70, 85];
    fillCircle(frame, hx, hy, 14, col);
    fillCircle(frame, hx + 20, hy, 14, col);
    fillRect(frame, hx + 2, hy + 6, 16, 16, col);
  }
  if (day7 && state.combo >= 2) {
    const ct = "COMBO X" + state.combo;
    drawText(frame, ct, Math.round(W / 2 - textWidth(ct, 7) / 2), 400, 7, C.gold);
  }
  // LEVEL 2 banner
  if (day7 && state.bannerShown && t - state.bannerT < 2.5) {
    const bt = t - state.bannerT;
    const slide = bt < 0.4 ? (1 - bt / 0.4) * -700 : 0;
    const fade = bt > 2.0 ? Math.max(0, 1 - (bt - 2.0) / 0.5) : 1;
    if (fade > 0) {
      const l1 = "LEVEL 2";
      const l2 = "DOUBLE STARS";
      fillRect(frame, 140, 820, 800, 220, [25, 20, 25]);
      drawText(frame, l1, Math.round(W / 2 - textWidth(l1, 16) / 2) + slide, 840, 16, C.gold);
      drawText(frame, l2, Math.round(W / 2 - textWidth(l2, 8) / 2) + slide, 970, 8, C.white);
    }
  }

  process.stdout.write(frame);
}

process.stderr.write(`rendered ${mode} ${totalFrames} frames, final score ${state.score}, misses ${state.misses}\n`);
