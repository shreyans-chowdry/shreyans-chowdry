// ============================================================
// render.ts — builds the page markup from content/profile.json.
// Runs at BUILD time (see vite.config.ts) so the shipped HTML is complete
// and readable without JavaScript; main.ts only adds motion on top.
// ============================================================

export interface Metric { value: string; label: string }
export interface Project {
  slug: string; name: string; kind: string; category: string;
  status: 'shipped' | 'building' | 'planned'; year: string; cover: string;
  stack: string[]; repo: string | null; live: string | null; summary: string;
  metrics: Metric[]; resume: { include: boolean; bullets: string[] };
}
export interface Profile {
  name: string; firstName: string; lastName: string; role: string; tagline: string;
  location: string; timezone: string; email: string; phone: string;
  links: { github: string; linkedin: string; portfolio: string };
  education: { school: string; place: string; degree: string; score: string; dates: string }[];
  timeline: { era: string; when: string; title: string; text: string }[];
  projects: Project[];
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapes, then turns **bold** into <strong>. */
const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/** Splits a string into per-character spans for kinetic type; the parent keeps an accessible label. */
function chars(text: string, cls = 'ch') {
  return [...text]
    .map((c, i) => (c === ' ' ? '<span class="sp"> </span>' : `<span class="${cls}" style="--i:${i}">${esc(c)}</span>`))
    .join('');
}

/** Two stacked copies per letter; CSS rolls them on hover. */
function rollChars(text: string) {
  return [...text]
    .map((c, i) =>
      c === ' '
        ? '<span class="sp"> </span>'
        : `<span class="roll" style="--i:${i}"><span>${esc(c)}</span><span aria-hidden="true">${esc(c)}</span></span>`)
    .join('');
}

const ext = (href: string, label: string, extra = '') =>
  `<a href="${esc(href)}" target="_blank" rel="noopener" data-cursor="link" ${extra}>${label}</a>`;

function workItem(p: Project) {
  const metrics = p.metrics.length
    ? `<dl class="metrics">${p.metrics.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>`
    : '';
  const bullets = p.resume.bullets.length
    ? `<ul class="work-bullets">${p.resume.bullets.map((b) => `<li>${rich(b)}</li>`).join('')}</ul>`
    : '';
  const links = [
    p.repo ? ext(p.repo, 'Code on GitHub', 'data-magnetic') : '',
    p.live ? ext(p.live, 'Open the live site', 'data-magnetic') : '',
  ].filter(Boolean).join('');
  return `
  <li class="work-item" data-slug="${p.slug}" data-cover="${p.cover}">
    <button class="work-row" type="button" aria-expanded="false" aria-controls="panel-${p.slug}" data-cursor="open">
      <span class="work-name" aria-label="${esc(p.name)}"><span aria-hidden="true">${rollChars(p.name)}</span></span>
      <span class="work-kind">${esc(p.kind)}</span>
      <span class="work-cat">${esc(p.category)}</span>
      <span class="work-year">${esc(p.year)}</span>
      <span class="work-toggle" aria-hidden="true"></span>
    </button>
    <div class="work-panel" id="panel-${p.slug}" hidden>
      <div class="work-panel-inner">
        <canvas class="cover" data-cover="${p.cover}" aria-hidden="true"></canvas>
        <div class="work-detail">
          <p class="work-summary">${esc(p.summary)}</p>
          ${metrics}
          ${bullets}
          <ul class="stack">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
          <p class="work-links">${links}</p>
        </div>
      </div>
    </div>
  </li>`;
}

function labCard(p: Project) {
  return `
  <li class="lab-card">
    <canvas class="cover cover-lab" data-cover="${p.cover}" aria-hidden="true"></canvas>
    <div class="lab-text">
      <p class="lab-status">${p.status === 'building' ? 'Building now' : 'Planned'}, ${esc(p.year)}</p>
      <h3>${esc(p.name)}</h3>
      <p class="lab-kind">${esc(p.kind)}</p>
      <p>${esc(p.summary)}</p>
      ${p.metrics.length ? `<dl class="lab-targets">${p.metrics.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>` : ''}
      <ul class="stack">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </div>
  </li>`;
}

export function renderPage(d: Profile): string {
  const shipped = d.projects.filter((p) => p.status === 'shipped');
  const lab = d.projects.filter((p) => p.status !== 'shipped');
  const next = lab.find((p) => p.status === 'building') ?? lab[0];
  const edu = d.education[0];
  const results = shipped.flatMap((p) => p.metrics.slice(0, 2).map((m) => ({ p: p.name, ...m })));
  const ticker = results
    .map((r) => `<li><b>${esc(r.p)}</b> <span class="t-val">${esc(r.value)}</span> ${esc(r.label)}</li>`)
    .join('');

  return `
<a class="skip" href="#work">Skip to projects</a>
<div class="cursor" aria-hidden="true"><span class="cursor-ring"><span class="cursor-label"></span></span><span class="cursor-dot"></span></div>
<canvas class="peek" aria-hidden="true"></canvas>

<header class="nav">
  <a class="nav-mark" href="#top" aria-label="${esc(d.name)}, back to top">SC</a>
  <nav aria-label="Sections">
    <a href="#work">Work</a>
    <a href="#lab">Lab</a>
    <a href="#story">Story</a>
    <a href="#contact">Contact</a>
    <a href="resume.pdf" target="_blank" rel="noopener">Résumé</a>
  </nav>
</header>

<main>
  <section class="hero" id="top">
    <div class="hero-stage">
      <h1 class="hero-name"><span class="line">${esc(d.firstName)}</span><span class="line">${esc(d.lastName)}</span></h1>
      <canvas class="hero-canvas" aria-hidden="true"></canvas>
    </div>
    <div class="hero-foot">
      <p class="hero-tagline">${esc(d.tagline)}</p>
      <dl class="hero-meta">
        <div><dt>Based in</dt><dd>${esc(d.location)}, <span class="clock" data-tz="${esc(d.timezone)}">--:--</span> IST</dd></div>
        <div><dt>Studying</dt><dd>B.Tech CSE (Data Science), VIT, ${esc(edu.dates.split('--').pop()!.trim())}</dd></div>
        ${next ? `<div><dt>Building next</dt><dd>${esc(next.name)}, ${esc(next.kind.toLowerCase())}</dd></div>` : ''}
      </dl>
      <p class="readout" aria-hidden="true"></p>
    </div>
  </section>

  <div class="ticker" role="region" aria-label="Measured results from my projects">
    <ul class="ticker-track">${ticker}</ul>
    <ul class="ticker-track" aria-hidden="true">${ticker}</ul>
  </div>

  <section class="work" id="work" aria-labelledby="work-title">
    <div class="section-head">
      <h2 class="kinetic" id="work-title" aria-label="Things I've built"><span aria-hidden="true">${chars("Things I've built")}</span></h2>
      <p>${shipped.length} projects, each with a repo, a README and a number I can defend. Open one for the details.</p>
    </div>
    <ul class="work-list">${shipped.map(workItem).join('')}</ul>
  </section>

  <section class="lab" id="lab" aria-labelledby="lab-title">
    <div class="section-head">
      <h2 class="kinetic" id="lab-title" aria-label="On the bench"><span aria-hidden="true">${chars('On the bench')}</span></h2>
      <p>What I'm building next. Each one moves up to the list above, and onto my résumé, once it ships with numbers.</p>
    </div>
    <ul class="lab-list">${lab.map(labCard).join('')}</ul>
  </section>

  <section class="story" id="story" aria-labelledby="story-title">
    <div class="story-pin">
      <div class="story-head">
        <h2 class="kinetic" id="story-title" aria-label="How I got here"><span aria-hidden="true">${chars('How I got here')}</span></h2>
        <p class="story-count" aria-hidden="true"><span class="story-count-now">01</span> / ${String(d.timeline.length).padStart(2, '0')}</p>
      </div>
      <div class="story-rail">
        <ol class="story-track">
          ${d.timeline
            .map((t, i) => `
          <li class="era${i === d.timeline.length - 1 ? ' era-next' : ''}">
            <span class="era-node" aria-hidden="true"></span>
            <div class="era-body">
              <p class="era-when"><span class="era-idx">${String(i + 1).padStart(2, '0')}</span> ${esc(t.when)}</p>
              <h3><span class="era-name">${esc(t.era)}</span> ${esc(t.title)}</h3>
              <p>${esc(t.text)}</p>
            </div>
            <span class="era-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          </li>`)
            .join('')}
        </ol>
      </div>
    </div>
  </section>

  <section class="contact" id="contact" aria-labelledby="contact-title">
    <h2 class="contact-big" id="contact-title" aria-label="Say hello"><span aria-hidden="true">${chars('Say hello', 'wch')}</span></h2>
    <div class="contact-body">
      <p class="contact-lead">Internships, collaborations, or a question about one of the projects. I reply within a day or two.</p>
      <div class="email-row">
        <a class="email" id="email" href="mailto:${esc(d.email)}" data-cursor="link">${esc(d.email)}</a>
        <button class="copy" id="copy-email" type="button" data-magnetic data-cursor="link">Copy email</button>
        <span class="copy-status" role="status"></span>
      </div>
      <ul class="contact-links">
        <li>${ext(d.links.github, 'GitHub', 'data-magnetic')}</li>
        <li>${ext(d.links.linkedin, 'LinkedIn', 'data-magnetic')}</li>
        <li>${ext('resume.pdf', 'Résumé (PDF)', 'data-magnetic')}</li>
      </ul>
    </div>
    <footer class="foot">
      <p>${esc(d.name)}, ${new Date().getFullYear()}. Built with Vite, GSAP and a particle field.</p>
      <a href="#top">Back to top</a>
    </footer>
  </section>
</main>`;
}
