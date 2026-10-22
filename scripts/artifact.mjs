// Turns the single-file build (dist-artifact/index.html) into a page body for
// a claude.ai Artifact preview: the host supplies <!doctype>/<html>/<head>/<body>,
// so we keep only <title>, styles, the rendered markup and the scripts.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join('\n');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');

writeFileSync('dist-artifact/portfolio.html', `${title}\n${styles}\n${body}\n${scripts}\n`);
copyFileSync('public/resume.pdf', 'dist-artifact/resume.pdf');
console.log('artifact page: dist-artifact/portfolio.html', (readFileSync('dist-artifact/portfolio.html').length / 1024).toFixed(0), 'KB');
