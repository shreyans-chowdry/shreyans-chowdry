import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { renderPage, type Profile } from './src/render';

/** Injects the fully rendered page (from content/profile.json) into index.html at build/dev time. */
function prerender(): Plugin {
  return {
    name: 'prerender-profile',
    transformIndexHtml(html) {
      const profile = JSON.parse(readFileSync(new URL('./content/profile.json', import.meta.url), 'utf8')) as Profile;
      return html.replace('<!--app-->', renderPage(profile));
    },
    handleHotUpdate({ file, server }) {
      if (file.endsWith('profile.json') || file.endsWith('render.ts')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [prerender(), ...(mode === 'artifact' ? [viteSingleFile()] : [])],
  build: mode === 'artifact'
    ? { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000 }
    : { outDir: 'dist' },
}));
