// ============================================================
// covers.ts — a small generative drawing for each project, built from
// what the project actually does (a commit DAG for the database, queue
// lanes for the job system, day routes for the solver…). Each drawing
// takes a reveal value t in [0, 1] so it can draw itself in.
// ============================================================

export interface Palette { bg: string; line: string; soft: string; accent: string; warn: string }

export const NIGHT: Palette = { bg: '#121534', line: '#e5e6e0', soft: 'rgba(229,230,224,0.28)', accent: '#8f97ff', warn: '#f2b705' };
export const PAPER: Palette = { bg: 'transparent', line: '#1b1e3b', soft: 'rgba(27,30,59,0.25)', accent: '#2e3af0', warn: '#f2b705' };

type Draw = (c: CanvasRenderingContext2D, w: number, h: number, t: number, p: Palette, rnd: () => number) => void;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), a | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
/** Local progress for an item that starts at `at` and lasts `len` (in t units). */
const seg = (t: number, at: number, len = 0.3) => ease((t - at) / len);

function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke?: string) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}

function partialLine(c: CanvasRenderingContext2D, pts: [number, number][], k: number) {
  if (k <= 0 || pts.length < 2) return;
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l); total += l;
  }
  let left = total * Math.min(1, k);
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const l = lens[i - 1];
    const f = Math.min(1, left / l);
    c.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f);
    left -= l;
  }
  c.stroke();
}

const draws: Record<string, Draw> = {
  // commit DAG: main line, two branches that fork and merge back
  dag(c, w, h, t, p) {
    const y0 = h * 0.5, ys = [h * 0.26, h * 0.74];
    const xs = Array.from({ length: 11 }, (_, i) => w * (0.08 + i * 0.084));
    c.lineWidth = 2;
    c.strokeStyle = p.line;
    partialLine(c, [[xs[0], y0], [xs[10], y0]], seg(t, 0, 0.5));
    const branches: [number, number, number, string][] = [[1, 5, 0, p.accent], [4, 9, 1, p.warn]];
    branches.forEach(([a, b, lane, col], bi) => {
      c.strokeStyle = col;
      const pts: [number, number][] = [[xs[a], y0], [xs[a + 1], ys[lane]], [xs[b - 1], ys[lane]], [xs[b], y0]];
      partialLine(c, pts, seg(t, 0.25 + bi * 0.15, 0.45));
      for (let i = a + 1; i < b; i++) if (seg(t, 0.35 + bi * 0.15 + (i - a) * 0.04, 0.1) > 0.5) dot(c, xs[i], ys[lane], 5, p.bg === 'transparent' ? '#e5e6e0' : p.bg, col);
    });
    xs.forEach((x, i) => { if (seg(t, i * 0.05, 0.1) > 0.5) dot(c, x, y0, i === 10 ? 7 : 5, i === 10 ? p.accent : p.line); });
  },

  // queue lanes: jobs slide right, a couple fail (amber) and are retried
  lanes(c, w, h, t, p, r) {
    const lanes = 4, pad = h * 0.12, lh = (h - pad * 2) / lanes;
    for (let l = 0; l < lanes; l++) {
      const y = pad + l * lh;
      c.strokeStyle = p.soft; c.lineWidth = 1;
      c.beginPath(); c.moveTo(w * 0.06, y + lh * 0.9); c.lineTo(w * 0.94, y + lh * 0.9); c.stroke();
      let x = w * 0.06;
      let n = 0;
      while (x < w * 0.9) {
        const jw = w * (0.05 + r() * 0.1);
        const k = seg(t, (l * 0.1) + n * 0.06, 0.35);
        const fail = r() < 0.12;
        c.fillStyle = fail ? p.warn : l === 0 && n < 3 ? p.accent : p.line;
        c.globalAlpha = fail ? 1 : 0.85;
        c.fillRect(x - (1 - k) * w * 0.2, y + lh * 0.25, Math.max(0, jw * k), lh * 0.5);
        c.globalAlpha = 1;
        x += jw + w * 0.02; n++;
      }
    }
  },

  // day routes from a depot: three coloured loops
  route(c, w, h, t, p, r) {
    const cx = w * 0.5, cy = h * 0.52;
    const cols = [p.accent, p.line, p.warn];
    for (let d = 0; d < 3; d++) {
      const a0 = (d / 3) * Math.PI * 2 - Math.PI / 2;
      const stops: [number, number][] = [[cx, cy]];
      for (let s = 0; s < 4; s++) {
        const a = a0 + (s - 1.5) * 0.42 + (r() - 0.5) * 0.2;
        const rad = Math.min(w, h) * (0.2 + 0.22 * Math.sin(((s + 0.5) / 4) * Math.PI) + r() * 0.06);
        stops.push([cx + Math.cos(a) * rad * 1.35, cy + Math.sin(a) * rad]);
      }
      stops.push([cx, cy]);
      c.strokeStyle = cols[d]; c.lineWidth = 2; c.setLineDash(d === 1 ? [6, 5] : []);
      partialLine(c, stops, seg(t, 0.1 + d * 0.18, 0.5));
      c.setLineDash([]);
      stops.slice(1, -1).forEach(([x, y], i) => { if (seg(t, 0.15 + d * 0.18 + i * 0.08, 0.1) > 0.5) dot(c, x, y, 5, cols[d]); });
    }
    for (let i = 0; i < 6; i++) dot(c, w * (0.1 + r() * 0.8), h * (0.1 + r() * 0.8), 3, p.soft); // places not chosen
    c.fillStyle = p.line; c.fillRect(cx - 7, cy - 7, 14, 14);
  },

  // retrieval graph: clusters of chunks, one query path lit up
  graph(c, w, h, t, p, r) {
    const nodes: [number, number][] = [];
    const centers = [[0.25, 0.35], [0.7, 0.3], [0.5, 0.72], [0.82, 0.72]];
    centers.forEach(([x, y]) => { for (let i = 0; i < 7; i++) nodes.push([w * (x + (r() - 0.5) * 0.22), h * (y + (r() - 0.5) * 0.3)]); });
    c.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const j = (i + 1 + Math.floor(r() * 6)) % nodes.length;
      if (seg(t, (i / nodes.length) * 0.5, 0.3) < 0.5) continue;
      c.strokeStyle = p.soft;
      c.beginPath(); c.moveTo(nodes[i][0], nodes[i][1]); c.lineTo(nodes[j][0], nodes[j][1]); c.stroke();
    }
    const path = [nodes[2], nodes[9], nodes[15], nodes[24]];
    c.strokeStyle = p.accent; c.lineWidth = 2.5;
    partialLine(c, path, seg(t, 0.5, 0.45));
    nodes.forEach(([x, y], i) => dot(c, x, y, path.includes(nodes[i]) ? 6 : 3.5, path.includes(nodes[i]) && t > 0.7 ? p.accent : p.line));
  },

  // six agents in a pipeline
  agents(c, w, h, t, p) {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    const pos = labels.map((_, i) => [w * (0.12 + i * 0.152), h * (i % 2 ? 0.66 : 0.36)] as [number, number]);
    c.strokeStyle = p.line; c.lineWidth = 2;
    partialLine(c, pos, seg(t, 0, 0.8));
    pos.forEach(([x, y], i) => {
      const k = seg(t, i * 0.12, 0.2);
      if (k <= 0) return;
      dot(c, x, y, 20 * k, i === 4 ? p.accent : p.bg === 'transparent' ? '#e5e6e0' : p.bg, i === 4 ? p.accent : p.line);
      c.fillStyle = i === 4 ? '#e5e6e0' : p.line;
      c.font = `700 ${16 * k}px 'Big Shoulders Display Variable', sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(labels[i], x, y + 1);
    });
  },

  // wafer map: dies inside a circle, failures cluster near the edge
  wafer(c, w, h, t, p, r) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42, s = R / 9;
    c.strokeStyle = p.line; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, R + 4, 0, Math.PI * 2 * seg(t, 0, 0.4)); c.stroke();
    for (let gy = -9; gy < 9; gy++) for (let gx = -9; gx < 9; gx++) {
      const x = cx + gx * s, y = cy + gy * s;
      const d = Math.hypot(x + s / 2 - cx, y + s / 2 - cy);
      if (d > R - s * 0.3) continue;
      const roll = r(); // drawn before the reveal check so the pattern is stable across frames
      if (seg(t, (d / R) * 0.6, 0.2) < 0.5) continue;
      const edge = d / R;
      c.fillStyle = roll < 0.03 + edge * edge * 0.12 ? p.line : roll > 0.985 - edge * 0.06 ? p.accent : p.soft;
      c.fillRect(x + 1, y + 1, s - 2, s - 2);
    }
  },

  // log lines with a correlated burst bracketed
  logs(c, w, h, t, p, r) {
    const rows = 13, lh = h / (rows + 2);
    for (let i = 0; i < rows; i++) {
      const y = lh * (i + 1.2);
      const hot = i >= 6 && i <= 8;
      const k = seg(t, i * 0.04, 0.3);
      c.fillStyle = p.soft; c.fillRect(w * 0.08, y, w * 0.08 * k, lh * 0.45);
      c.fillStyle = hot ? p.warn : p.line; c.globalAlpha = hot ? 1 : 0.7;
      c.fillRect(w * 0.19, y, w * (0.25 + r() * 0.5) * k, lh * 0.45);
      c.globalAlpha = 1;
    }
    if (t > 0.7) {
      c.strokeStyle = p.accent; c.lineWidth = 2;
      c.strokeRect(w * 0.05, lh * 6.9, w * 0.9, lh * 3.1);
    }
  },

  // compiler CFG: basic blocks coloured by how hot they ran, a loop back edge
  cfg(c, w, h, t, p) {
    const bw = w * 0.2, bh = h * 0.12;
    const blocks: [number, number, number][] = [
      [0.5, 0.12, 0.2], [0.5, 0.34, 0.9], [0.28, 0.56, 1], [0.72, 0.56, 0.15], [0.5, 0.8, 0.85],
    ];
    const pos = blocks.map(([x, y]) => [w * x, h * y] as [number, number]);
    const edges: [number, number, boolean][] = [[0, 1, false], [1, 2, false], [1, 3, false], [2, 4, false], [3, 4, false], [4, 1, true]];
    edges.forEach(([a2, b2, back], i) => {
      const k = seg(t, 0.15 + i * 0.08, 0.3);
      c.strokeStyle = back ? p.accent : p.soft; c.lineWidth = back ? 2 : 1.5;
      c.setLineDash(back ? [6, 5] : []);
      const [ax, ay] = pos[a2], [bx, by] = pos[b2];
      if (back) partialLine(c, [[ax + bw / 2, ay], [ax + bw * 0.9, ay], [bx + bw * 0.9, by], [bx + bw / 2, by]], k);
      else partialLine(c, [[ax, ay + bh / 2], [bx, by - bh / 2]], k);
    });
    c.setLineDash([]);
    blocks.forEach(([, , heat], i) => {
      const k = seg(t, i * 0.08, 0.25);
      if (k <= 0) return;
      const [x, y] = pos[i];
      c.globalAlpha = k;
      c.fillStyle = heat > 0.8 ? p.warn : heat > 0.5 ? p.accent : p.soft;
      c.fillRect(x - bw / 2, y - bh / 2, bw, bh * 0.28);
      c.strokeStyle = p.line; c.lineWidth = 1.5;
      c.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
      c.fillStyle = p.line;
      for (let l = 0; l < 2; l++) c.fillRect(x - bw / 2 + 8, y - bh / 2 + bh * (0.45 + l * 0.25), bw * (0.7 - l * 0.25), 2);
      c.globalAlpha = 1;
    });
  },

  // raft: five nodes, a leader sending heartbeats
  raft(c, w, h, t, p) {
    const cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) * 0.34;
    const pos = Array.from({ length: 5 }, (_, i) => [cx + Math.cos(i * 1.2566 - Math.PI / 2) * R * 1.3, cy + Math.sin(i * 1.2566 - Math.PI / 2) * R] as [number, number]);
    c.lineWidth = 1.5;
    pos.slice(1).forEach(([x, y], i) => {
      c.strokeStyle = i === 2 ? p.soft : p.line; c.setLineDash(i === 2 ? [4, 6] : []);
      partialLine(c, [pos[0], [x, y]], seg(t, 0.2 + i * 0.1, 0.4));
    });
    c.setLineDash([]);
    pos.forEach(([x, y], i) => dot(c, x, y, i === 0 ? 14 : 10, i === 0 ? p.accent : i === 3 ? p.warn : p.line));
  },

  // attention matrix: lower triangle
  tensor(c, w, h, t, p, r) {
    const n = 14, s = Math.min(w * 0.8, h * 0.84) / n;
    const ox = (w - s * n) / 2, oy = (h - s * n) / 2;
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      const v = j === i ? 1 : r() * r();
      if (seg(t, (i + j) / (2 * n), 0.15) < 0.5) continue;
      c.globalAlpha = 0.15 + v * 0.85;
      c.fillStyle = v > 0.6 ? p.accent : p.line;
      c.fillRect(ox + j * s + 1, oy + i * s + 1, s - 2, s - 2);
    }
    c.globalAlpha = 1;
  },

  // event stream with one anomalous spike
  stream(c, w, h, t, p) {
    for (let l = 0; l < 6; l++) {
      const pts: [number, number][] = [];
      for (let x = 0; x <= 60; x++) {
        const fx = x / 60;
        let y = h * (0.2 + l * 0.12) + Math.sin(fx * 9 + l) * 6;
        if (l === 3 && Math.abs(fx - 0.62) < 0.04) y -= (1 - Math.abs(fx - 0.62) / 0.04) * h * 0.22;
        pts.push([w * (0.05 + fx * 0.9), y]);
      }
      c.strokeStyle = l === 3 ? p.warn : p.line; c.lineWidth = l === 3 ? 2 : 1; c.globalAlpha = l === 3 ? 1 : 0.6;
      partialLine(c, pts, seg(t, l * 0.06, 0.6));
    }
    c.globalAlpha = 1;
  },
};

/** Draws cover `name` on `canvas` at reveal `t` (sizes the backing store to the element). */
export function drawCover(canvas: HTMLCanvasElement, name: string, t: number, pal: Palette, seed = 7) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const c = canvas.getContext('2d');
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  if (pal.bg !== 'transparent') { c.fillStyle = pal.bg; c.fillRect(0, 0, w, h); }
  (draws[name] ?? draws.graph)(c, w, h, t, pal, rng(seed + name.length * 31));
}

/** Animates a cover from 0 to 1. Returns a cancel function. */
export function revealCover(canvas: HTMLCanvasElement, name: string, pal: Palette, ms = 1100): () => void {
  let raf = 0;
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    drawCover(canvas, name, t, pal);
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
