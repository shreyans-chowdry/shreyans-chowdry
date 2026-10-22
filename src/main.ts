import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/instrument-sans';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initHero } from './hero';
import { drawCover, revealCover, NIGHT, PAPER } from './covers';

gsap.registerPlugin(ScrollTrigger);

const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

// ---------------------------------------------------------------- smooth scroll
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

$$<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!;
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target as HTMLElement, { duration: 1.4 });
    else (target as HTMLElement).scrollIntoView();
    if (id !== '#top') (target as HTMLElement).setAttribute('tabindex', '-1');
    (target as HTMLElement).focus?.({ preventScroll: true });
  });
});

// ---------------------------------------------------------------- hero
const stage = $('.hero-stage');
if (stage && !reduced) {
  document.fonts.ready.then(() => {
    const hero = initHero(stage, $('.readout'));
    if (hero) {
      ScrollTrigger.create({
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => hero.setScroll(self.progress),
      });
    }
  });
} else {
  const r = $('.readout');
  if (r) r.textContent = '';
}

// ---------------------------------------------------------------- clock
const clock = $<HTMLElement>('.clock');
if (clock) {
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: clock.dataset.tz || 'Asia/Kolkata' });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 20_000);
}

// ---------------------------------------------------------------- ticker (speeds up and skews with scroll velocity)
const tracks = $$('.ticker-track');
if (tracks.length && !reduced) {
  const loop = gsap.to(tracks, { xPercent: -100, repeat: -1, duration: 38, ease: 'none' });
  const skew = gsap.quickTo(tracks, 'skewX', { duration: 0.4, ease: 'power3' });
  let boost = 1;
  lenis?.on('scroll', ({ velocity }: { velocity: number }) => {
    boost = 1 + Math.min(6, Math.abs(velocity) * 0.25);
    loop.timeScale(velocity < 0 ? -boost : boost);
    skew(Math.max(-12, Math.min(12, -velocity * 0.6)));
  });
  gsap.ticker.add(() => {
    // ease back to cruising speed
    const ts = loop.timeScale();
    loop.timeScale(ts + ((ts < 0 ? -1 : 1) - ts) * 0.05);
  });
}

// ---------------------------------------------------------------- kinetic headings (letters settle as they scroll in; always readable)
if (!reduced) {
  $$('.kinetic').forEach((h) => {
    const letters = $$('.ch', h);
    gsap.fromTo(
      letters,
      { yPercent: () => gsap.utils.random(-70, 70), rotate: () => gsap.utils.random(-14, 14) },
      {
        yPercent: 0, rotate: 0, ease: 'none',
        scrollTrigger: { trigger: h, start: 'top 95%', end: 'top 45%', scrub: 0.6 },
      },
    );
  });
}

// ---------------------------------------------------------------- work list: accordion + covers
const items = $$('.work-item');
const cancels = new Map<HTMLElement, () => void>();

function setOpen(item: HTMLElement, open: boolean) {
  const btn = $<HTMLButtonElement>('.work-row', item)!;
  const panel = $('.work-panel', item)!;
  const cover = $<HTMLCanvasElement>('.cover', panel)!;
  if (open === (btn.getAttribute('aria-expanded') === 'true')) return;
  btn.setAttribute('aria-expanded', String(open));
  btn.dataset.cursor = open ? 'close' : 'open';
  gsap.killTweensOf(panel);
  if (open) {
    panel.hidden = false;
    if (reduced) { drawCover(cover, cover.dataset.cover!, 1, NIGHT); return; }
    gsap.fromTo(panel, { height: 0 }, {
      height: 'auto', duration: 0.75, ease: 'expo.out',
      onComplete: () => { ScrollTrigger.refresh(); },
    });
    gsap.fromTo($$('.work-detail > *', panel), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power3.out', delay: 0.1 });
    cancels.get(item)?.();
    cancels.set(item, revealCover(cover, cover.dataset.cover!, NIGHT));
  } else {
    if (reduced) { panel.hidden = true; return; }
    gsap.to(panel, {
      height: 0, duration: 0.5, ease: 'expo.inOut',
      onComplete: () => { panel.hidden = true; panel.style.height = ''; ScrollTrigger.refresh(); },
    });
  }
}

items.forEach((item) => {
  $('.work-row', item)!.addEventListener('click', () => {
    const willOpen = $('.work-row', item)!.getAttribute('aria-expanded') !== 'true';
    items.forEach((other) => other !== item && setOpen(other, false));
    setOpen(item, willOpen);
    cursorState(willOpen ? 'close' : 'open');
    hidePeek();
  });
});

// Lab covers draw themselves when they come into view (and are complete in a still frame).
$$<HTMLCanvasElement>('.cover-lab').forEach((cv) => {
  drawCover(cv, cv.dataset.cover!, 1, PAPER);
  if (reduced) return;
  ScrollTrigger.create({
    trigger: cv, start: 'top 85%', once: true,
    onEnter: () => revealCover(cv, cv.dataset.cover!, PAPER, 1400),
  });
});
window.addEventListener('resize', () => {
  $$<HTMLCanvasElement>('.cover-lab').forEach((cv) => drawCover(cv, cv.dataset.cover!, 1, PAPER));
  $$<HTMLCanvasElement>('.work-panel:not([hidden]) .cover').forEach((cv) => drawCover(cv, cv.dataset.cover!, 1, NIGHT));
});

// ---------------------------------------------------------------- story: pinned horizontal timeline on wide screens
const story = $('.story');
const track = $('.story-track');
if (story && track && !reduced) {
  const eras = $$('.era', track);
  const countNow = $('.story-count-now');
  const pad = (n: number) => String(n).padStart(2, '0');

  // Marks every era whose node the progress line has reached.
  const activate = (reached: (era: HTMLElement, i: number) => boolean) => {
    let last = 0;
    eras.forEach((era, i) => {
      const on = reached(era, i);
      era.classList.toggle('is-active', on);
      if (on) last = i;
    });
    if (countNow) countNow.textContent = pad(last + 1);
  };

  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px)', () => {
    story.classList.add('is-horizontal', 'js-story');
    const pin = $('.story-pin', story)!;
    const innerWidth = () => {
      const cs = getComputedStyle(pin);
      return pin.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    };
    // How far the track must travel so the last era ends on the right gutter.
    const distance = () => Math.max(0, track.scrollWidth - innerWidth());
    // The line runs from the first node to the last one.
    const lineEnd = () => eras[eras.length - 1].offsetLeft + 8;

    // The line's head starts a third of the way across, so the next era lights
    // up as it slides into the middle of the screen rather than at the edge.
    const render = (p: number) => {
      const start = Math.min(lineEnd(), innerWidth() * 0.35);
      const fill = start + p * (lineEnd() - start);
      track.style.setProperty('--fill', `${fill}px`);
      activate((era) => era.offsetLeft <= fill + 1);
    };

    const run = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: story,
        start: 'top top',
        end: () => `+=${distance() + window.innerHeight * 0.6}`,
        pin: true,
        scrub: 0.9,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
      onUpdate() { render(this.progress()); },
    });
    render(0);

    // Big outline numbers drift against the track for depth.
    eras.forEach((era) => {
      const num = $('.era-num', era);
      if (!num) return;
      gsap.fromTo(num, { xPercent: 14 }, {
        xPercent: -14, ease: 'none',
        scrollTrigger: { trigger: era, containerAnimation: run, start: 'left right', end: 'right left', scrub: true },
      });
    });

    return () => {
      story.classList.remove('is-horizontal', 'js-story');
      track.style.removeProperty('--fill');
      gsap.set(track, { clearProps: 'transform' });
      eras.forEach((e) => e.classList.remove('is-active'));
    };
  });

  mm.add('(max-width: 899px)', () => {
    story.classList.add('js-story');
    const st = ScrollTrigger.create({
      trigger: track, start: 'top 65%', end: 'bottom 65%', scrub: true,
      onUpdate(self) {
        const fill = self.progress * track.offsetHeight;
        track.style.setProperty('--fill', `${fill}px`);
        activate((era) => era.offsetTop <= fill + 4);
      },
    });
    track.style.setProperty('--fill', '0px');
    activate((_, i) => i === 0);
    return () => { st.kill(); story.classList.remove('js-story'); track.style.removeProperty('--fill'); };
  });
}

// ---------------------------------------------------------------- "Say hello": letters gain weight near the pointer (variable font)
const big = $('.contact-big');
if (big && finePointer && !reduced) {
  const letters = $$('.wch', big);
  const setters = letters.map((el) => gsap.quickTo(el, '--w', { duration: 0.5, ease: 'power3' }));
  window.addEventListener('pointermove', (e) => {
    const r = big.getBoundingClientRect();
    if (e.clientY < r.top - 200 || e.clientY > r.bottom + 200) return;
    letters.forEach((el, i) => {
      const b = el.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
      setters[i](300 + 600 * Math.max(0, 1 - d / 420));
    });
  }, { passive: true });
}

// ---------------------------------------------------------------- copy email
const copyBtn = $<HTMLButtonElement>('#copy-email');
const emailEl = $<HTMLAnchorElement>('#email');
const status = $('.copy-status');
copyBtn?.addEventListener('click', () => {
  const text = emailEl?.textContent?.trim() || '';
  const done = (msg: string) => { if (status) { status.textContent = msg; setTimeout(() => (status.textContent = ''), 2500); } };
  const selectIt = () => {
    const range = document.createRange();
    range.selectNodeContents(emailEl!);
    const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
    done('Selected. Press Ctrl+C to copy.');
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => done('Copied'), selectIt);
  else selectIt();
});

// ---------------------------------------------------------------- custom cursor, magnetic buttons, project peek
const cursor = $('.cursor');
const label = $('.cursor-label');
let hidePeek: () => void = () => {};
function cursorState(state: string) {
  if (!cursor) return;
  cursor.dataset.state = state;
  if (label) label.textContent = state === 'open' ? 'Open' : state === 'close' ? 'Close' : '';
}

if (finePointer && !reduced && cursor) {
  document.documentElement.classList.add('has-cursor');
  const ring = $('.cursor-ring')!;
  const dotEl = $('.cursor-dot')!;
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  const dx = gsap.quickTo(dotEl, 'x', { duration: 0.08 });
  const dy = gsap.quickTo(dotEl, 'y', { duration: 0.08 });

  const peek = $<HTMLCanvasElement>('.peek')!;
  const px = gsap.quickTo(peek, 'x', { duration: 0.6, ease: 'power3' });
  const py = gsap.quickTo(peek, 'y', { duration: 0.6, ease: 'power3' });
  let peekFor: string | null = null;
  let cancelPeek: (() => void) | null = null;

  window.addEventListener('pointermove', (e) => {
    rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
    const t = (e.target as Element).closest<HTMLElement>('[data-cursor], a, button');
    cursorState(t?.dataset.cursor ?? (t ? 'link' : ''));

    const row = (e.target as Element).closest<HTMLElement>('.work-row');
    const item = row?.closest<HTMLElement>('.work-item');
    const showPeek = !!item && row!.getAttribute('aria-expanded') !== 'true';
    px(e.clientX + 190); py(e.clientY - 40);
    if (showPeek && item!.dataset.slug !== peekFor) {
      peekFor = item!.dataset.slug!;
      cancelPeek?.();
      cancelPeek = revealCover(peek, item!.dataset.cover!, NIGHT, 700);
      gsap.to(peek, { opacity: 1, scale: 1, rotate: gsap.utils.random(-4, 4), duration: 0.4, ease: 'power3.out' });
    } else if (!showPeek && peekFor) {
      hidePeek();
    }
  }, { passive: true });
  hidePeek = () => {
    peekFor = null;
    gsap.to(peek, { opacity: 0, scale: 0.85, duration: 0.3 });
  };
  document.addEventListener('pointerleave', () => gsap.to([ring, dotEl], { opacity: 0 }));
  document.addEventListener('pointerenter', () => gsap.to([ring, dotEl], { opacity: 1 }));

  $$('[data-magnetic]').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - (r.left + r.width / 2)) * 0.35);
      my((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); });
  });
}

// Refresh trigger positions once fonts have changed line lengths.
document.fonts.ready.then(() => ScrollTrigger.refresh());
