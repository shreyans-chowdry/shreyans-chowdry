# shreyans-portfolio

My portfolio site and résumé, generated from one file: `content/profile.json`.

- **Site:** Vite + TypeScript, GSAP (ScrollTrigger), Lenis smooth scroll, a canvas particle field, self-hosted variable fonts. The page is pre-rendered at build time, so it's complete without JavaScript; scripts only add motion.
- **Résumé:** `resume/build_resume.py` writes LaTeX from the same JSON and compiles a one-page PDF to `public/resume.pdf`.

## Adding a project when it ships

1. In `content/profile.json`, fill in the project's `metrics`, `resume.bullets`, `repo` (and `live` if deployed).
2. Change its `status` from `"planned"` to `"shipped"`.
3. `npm run resume` to rebuild the PDF (the script fails if it spills past one page; set `resume.include` to `false` on a weaker project to make room).
4. `npm run build`, commit, push. Vercel redeploys.

The project moves from "On the bench" to "Things I've built" and onto the résumé in the same step.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + static build to dist/
npm run resume     # needs pdflatex (TeX Live / MacTeX / MiKTeX)
npm run artifact   # single-file build for a claude.ai preview
```

## Deploy (Vercel)

Import the repo, framework preset **Vite**, build command `npm run build`, output `dist`. No environment variables needed.

## What moves, and where

| Where | Effect |
|---|---|
| Hero | The name is sampled into ~3–6k points that sweep in left to right, scatter from the pointer and drift apart as you scroll |
| Results ticker | Real project numbers; speeds up and skews with scroll velocity |
| Section titles | Letters start scattered and settle as the heading scrolls in (always readable) |
| Project list | Letter-roll on hover, a cursor-following cover preview, accordion with a self-drawing cover |
| Story | Pinned horizontal timeline on wide screens with a progress line |
| Say hello | Letters gain weight near the pointer (variable font axis) |
| Everywhere | Custom cursor and magnetic buttons on mouse devices |

`prefers-reduced-motion` turns all of it off and shows the static page.
