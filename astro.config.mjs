// @ts-check
import { defineConfig } from 'astro/config';

// Static site — no adapter needed for Cloudflare Pages.
// Cloudflare Pages: Framework preset = Astro, Build command = npm run build,
// Build output directory = dist
export default defineConfig({
  output: 'static',
});
