// ============================================================
// hero.ts — the name, assembled from a few thousand points.
//
// The headline is real text in the DOM (for screen readers, search and
// no-JS). We rasterise the same lines off-screen, sample the ink into
// points, scatter them, then let springs pull every point home in a
// left-to-right sweep. Points flee the pointer and drift apart as the
// hero scrolls away. The loop sleeps whenever nothing is moving.
// ============================================================

interface Pt {
  hx: number; hy: number;   // home
  x: number; y: number;     // position
  vx: number; vy: number;
  delay: number;            // ms before it starts flying home
  dx: number; dy: number;   // scatter direction for scroll dispersal
}

export interface HeroController {
  setScroll(p: number): void;
  destroy(): void;
}

const INK = '#1b1e3b';
const COBALT = '#2e3af0';

export function initHero(stage: HTMLElement, readout: HTMLElement | null): HeroController | null {
  const canvas = stage.querySelector<HTMLCanvasElement>('.hero-canvas');
  const lines = [...stage.querySelectorAll<HTMLElement>('.hero-name .line')];
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || !lines.length) return null;

  const coarse = matchMedia('(pointer: coarse)').matches;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let pts: Pt[] = [];
  let size = 2;
  let W = 0, H = 0;               // canvas size in device px
  let start = 0;
  let settledAt = 0;
  let raf = 0;
  let running = false;
  let visible = true;
  let scrollP = 0;
  const pointer = { x: -1e4, y: -1e4, active: false };

  function build() {
    const cRect = canvas!.getBoundingClientRect();
    W = Math.round(cRect.width * dpr);
    H = Math.round(cRect.height * dpr);
    canvas!.width = W;
    canvas!.height = H;

    // Rasterise the headline exactly where the DOM puts it.
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true })!;
    o.fillStyle = '#000';
    let fontPx = 100;
    for (const line of lines) {
      const cs = getComputedStyle(line.parentElement!);
      fontPx = parseFloat(cs.fontSize);
      const r = line.getBoundingClientRect();
      const pl = parseFloat(getComputedStyle(line).paddingLeft) || 0;
      o.font = `${cs.fontWeight} ${fontPx * dpr}px ${cs.fontFamily}`;
      o.textBaseline = 'alphabetic';
      const m = o.measureText(line.textContent || '');
      const asc = m.fontBoundingBoxAscent ?? fontPx * dpr * 0.8;
      const desc = m.fontBoundingBoxDescent ?? fontPx * dpr * 0.2;
      const boxTop = (r.top - cRect.top) * dpr;
      const baseline = boxTop + (r.height * dpr - (asc + desc)) / 2 + asc;
      const text = (line.textContent || '').toUpperCase();
      o.fillText(text, (r.left - cRect.left + pl) * dpr, baseline);
    }

    // Sample the ink on a grid.
    const gap = Math.max(3, Math.round((fontPx / (coarse ? 30 : 42)))) * dpr;
    size = Math.max(1.5 * dpr, gap * 0.62);
    const data = o.getImageData(0, 0, W, H).data;
    const next: Pt[] = [];
    for (let y = gap / 2; y < H; y += gap) {
      for (let x = gap / 2; x < W; x += gap) {
        if (data[((y | 0) * W + (x | 0)) * 4 + 3] > 140) {
          const a = Math.random() * Math.PI * 2;
          next.push({
            hx: x, hy: y,
            x: Math.random() * W, y: Math.random() * H,
            vx: 0, vy: 0,
            delay: (x / W) * 900 + Math.random() * 350,
            dx: Math.cos(a) * (0.4 + Math.random()), dy: Math.sin(a) * (0.4 + Math.random()) - 0.8,
          });
        }
      }
    }
    // Keep positions on rebuild so a resize morphs instead of restarting.
    if (pts.length) {
      for (let i = 0; i < next.length; i++) {
        const prev = pts[i % pts.length];
        next[i].x = prev.x; next[i].y = prev.y; next[i].delay = 0;
      }
    }
    pts = next;
  }

  function step(now: number) {
    const t = now - start;
    const k = 0.055, damp = 0.82;
    const R = (coarse ? 70 : 120) * dpr;
    const spread = scrollP * scrollP * H * 0.9;
    let moving = 0;

    ctx!.clearRect(0, 0, W, H);
    const ink: number[] = [];
    const hot: number[] = [];

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (t < p.delay) {
        // waiting: a slow drift so the field feels alive
        p.x += Math.sin((t + i) * 0.002) * 0.3 * dpr;
        p.y += Math.cos((t + i * 1.3) * 0.002) * 0.3 * dpr;
        moving++;
      } else {
        const tx = p.hx + p.dx * spread;
        const ty = p.hy + p.dy * spread;
        let ax = (tx - p.x) * k;
        let ay = (ty - p.y) * k;
        if (pointer.active) {
          const ddx = p.x - pointer.x, ddy = p.y - pointer.y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / R) ** 2 * 9 * dpr;
            ax += (ddx / d) * f;
            ay += (ddy / d) * f;
          }
        }
        p.vx = (p.vx + ax) * damp;
        p.vy = (p.vy + ay) * damp;
        p.x += p.vx;
        p.y += p.vy;
        if (Math.abs(p.vx) + Math.abs(p.vy) > 0.05) moving++;
      }
      const off = Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy);
      (off > 4 * dpr && scrollP < 0.02 ? hot : ink).push(p.x, p.y);
    }

    ctx!.fillStyle = INK;
    for (let i = 0; i < ink.length; i += 2) ctx!.fillRect(ink[i] - size / 2, ink[i + 1] - size / 2, size, size);
    ctx!.fillStyle = COBALT;
    for (let i = 0; i < hot.length; i += 2) ctx!.fillRect(hot[i] - size / 2, hot[i + 1] - size / 2, size, size);

    if (!settledAt && moving < pts.length * 0.01) {
      settledAt = now;
      if (readout) {
        const secs = ((now - start) / 1000).toFixed(2);
        readout.innerHTML = `<b>${pts.length.toLocaleString('en-IN')}</b> points settled in ${secs} s. ${coarse ? 'Touch' : 'Run your cursor through'} the letters.`;
      }
    }

    if (moving > 0 || pointer.active) {
      raf = requestAnimationFrame(step);
    } else {
      running = false;
    }
  }

  function wake() {
    if (!running && visible) {
      running = true;
      raf = requestAnimationFrame(step);
    }
  }

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) * dpr;
    pointer.y = (e.clientY - r.top) * dpr;
    pointer.active = e.clientY >= r.top && e.clientY <= r.bottom;
    wake();
  };
  const onLeave = () => { pointer.active = false; wake(); };
  window.addEventListener('pointermove', onMove, { passive: true });
  stage.addEventListener('pointerleave', onLeave);
  window.addEventListener('pointerdown', onMove, { passive: true });
  window.addEventListener('touchend', onLeave, { passive: true });

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { dpr = Math.min(window.devicePixelRatio || 1, 2); build(); wake(); }, 150);
  };
  window.addEventListener('resize', onResize);

  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); });
  io.observe(stage);

  build();
  document.documentElement.classList.add('js-particles');
  start = performance.now();
  wake();

  return {
    setScroll(p: number) {
      scrollP = Math.max(0, Math.min(1, p));
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('resize', onResize);
      document.documentElement.classList.remove('js-particles');
    },
  };
}
