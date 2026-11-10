# william zhu — photography

A minimalist photo blog: left sidebar with Series + counts, clean 2-column grid, small centered captions like `Golden Gate Fog  6 · 2026`. Light, serif, no About section.

Built with **Astro (static output)** for **Cloudflare Pages**. No adapter needed — this is a static site.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:4321
```

Build / preview:

```bash
npm run build
npm run preview
```

## Add a photo post — automatic (recommended)

Put the photo in `public/images/`, then run one command (in `cmd`, from this folder):

```bash
npm run new-post -- public/images/cherry-blossom.jpg
```

That reads the photo's EXIF data and creates `src/content/posts/cherry-blossom.md` for you, auto-filling:

- **date + year** — when the photo was taken (`DateTimeOriginal`)
- **camera** — e.g. `Nikon Z6 III` (from Make + Model)
- **settings** — e.g. `35mm · f/5.6 · 1/250s · ISO 100` (focal length, aperture, shutter, ISO)
- **location** — from GPS, looked up to "City, State" (only if the photo has GPS)
- **title / series** — from the file name: `cherry-blossom.jpg` → "Cherry Blossom"

Then edit just the story text, plus `collection` and `excerpt` if you want. The script tells you at the end anything EXIF didn't have (common when a photo was exported with metadata stripped — then edit those lines by hand).

Useful options:

```bash
npm run new-post -- public/images/my-photo.jpg --collection "Street & night" --location "Kyoto, Japan"
npm run new-post -- public/images/my-photo.jpg --title "Cherry Blossom at Dawn"
```

If the `.md` file already exists **without** frontmatter (the old cherry-blossom error), running the script on its photo fixes it — frontmatter is added and your story text is kept. If it already has frontmatter, add `--force` to regenerate it (story text is still kept).

Notes / limits:
- No GPS in the photo = no location auto-fill; the script says so and leaves `location: ""` for you to fill in.
- No EXIF at all (screenshot, web export) = date falls back to the file's modified date, camera/settings stay blank — the post still builds, because the schema now has defaults for those fields.
- Location lookup sends only the GPS coordinates to OpenStreetMap Nominatim. Add `--no-geocode` to skip it (location becomes the raw coordinates instead).

## Add a photo post — manual

1. Add your image to `public/images/`, e.g. `public/images/fairbanks-aurora.jpg`
2. Copy an existing file in `src/content/posts/` and edit the frontmatter:

```markdown
---
title: "Fairbanks Aurora"
series: "Fairbanks Aurora"
count: 12
year: 2026
date: "2026-12-27"
location: "Fairbanks, AK"
collection: "Street & night"
image: "/images/fairbanks-aurora.jpg"
alt: "Aurora over Fairbanks"
camera: "Nikon Z6 III"
settings: "20mm · f/2.8 · 8s · ISO 1600"
excerpt: "One line for the grid."
---

Your story goes here.
```

The sidebar Series list, counts, grid, series pages (`/series/<name>/`), and post pages (`/posts/<slug>/`) are all generated from these files. No other code changes needed.

The 7 included posts use Unsplash sample photos — replace the `image` field with your own shots.

## Deploy to Cloudflare Pages

### Option A — Git (recommended, auto-deploys on push)

1. Push this folder to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
3. Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: 20+ (Cloudflare default is fine)
4. Deploy. You get a `https://<project>.pages.dev` URL.
5. Optional: Pages → Custom domains → add your own domain.

### Option B — Direct upload / Wrangler CLI

```bash
npm run build
npx wrangler pages deploy dist --project-name william-zhu-photo-blog
```

Re-run the deploy command after every change, or use Option A for automatic deploys.

## Project tree

```
astro.config.mjs          # output: 'static' — no adapter
wrangler.toml             # Pages output dir = dist
src/content.config.ts     # posts collection schema
src/content/posts/*.md    # one Markdown file per photo story
src/pages/index.astro     # home: sidebar + 2-col grid + search
src/pages/posts/[...slug].astro
src/pages/series/[series].astro
src/layouts/Base.astro
src/styles/global.css     # yi.wang light serif styling
public/images/            # put your photos here
```
