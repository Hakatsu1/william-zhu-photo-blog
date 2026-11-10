// new-post.mjs — make a photo post from the picture itself.
// Usage (in cmd, from the photo-blog-astro folder):
//   npm run new-post -- public/images/cherry-blossom.jpg
//   npm run new-post -- public/images/cherry-blossom.jpg --title "Cherry Blossom" --collection "Street & night"
//   node scripts/new-post.mjs public/images/my-photo.jpg --location "Kyoto, Japan"
//
// What it reads automatically from the photo's EXIF data:
//   date + year  <- DateTimeOriginal (when the photo was taken)
//   camera       <- Make + Model  (e.g. Nikon Z6 III)
//   settings     <- FocalLength + FNumber + ExposureTime + ISO
//                  (e.g. 35mm · f/5.6 · 1/250s · ISO 100)
//   location     <- GPS latitude/longitude, reverse-geocoded to "City, State"
//                  (only if the photo has GPS; needs internet, sends only
//                  the coordinates to OpenStreetMap Nominatim)
//   title/series <- the file name: cherry-blossom.jpg -> "Cherry Blossom"
//
// Anything EXIF doesn't have is left as an editable placeholder and listed
// at the end — the post still builds, because the schema now has defaults.
// If src/content/posts/<slug>.md already exists WITHOUT frontmatter
// (the cherry-blossom case), this script prepends the frontmatter and
// keeps your existing story text. If it already HAS frontmatter, it
// refuses to overwrite unless you pass --force.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';

const args = process.argv.slice(2);
const flags = {};
let imageArg = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    if (key === 'force' || key === 'no-geocode') flags[key] = true;
    else flags[key] = args[++i];
  } else if (!imageArg) {
    imageArg = a;
  }
}

if (!imageArg) {
  console.error('Usage: npm run new-post -- public/images/<your-photo>.jpg');
  console.error('       node scripts/new-post.mjs public/images/<your-photo>.jpg [--title "..."] [--collection "..."] [--location "..."] [--force]');
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imagePath = path.isAbsolute(imageArg) ? imageArg : path.join(projectRoot, imageArg);
const fileName = path.basename(imagePath);
const slug = fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const mdPath = path.join(projectRoot, 'src', 'content', 'posts', `${slug}.md`);

function titleCase(s) {
  return s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function pad(n) { return String(n).padStart(2, '0'); }
function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatExposure(t) {
  if (!t || t <= 0) return null;
  if (t >= 1) return `${Number(t.toFixed(1))}s`;
  const denom = Math.round(1 / t);
  return `1/${denom}s`;
}
// Read one quoted frontmatter field from an existing .md file, e.g. collection.
function frontmatterField(text, field) {
  const m = text.match(new RegExp(`^${field}:\\s*("(?:[^"\\\\]|\\\\.)*"|[^\\n]*)`, 'm'));
  if (!m) return '';
  const raw = m[1].trim();
  try { return JSON.parse(raw); } catch { return raw.replace(/^['"]|['"]$/g, ''); }
}

async function reverseGeocode(lat, lon) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10`,
      { headers: { 'User-Agent': 'william-zhu-photo-blog/1.0', 'Accept-Language': 'en' }, signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || '';
    const state = a.state || '';
    const country = a.country || '';
    if (city && state) return `${city}, ${state}`;
    if (city && country) return `${city}, ${country}`;
    if (data.display_name) return data.display_name.split(',').slice(0, 2).join(',').trim();
    return null;
  } catch {
    return null;
  }
}

async function main() {
  let stat;
  try { stat = await fs.stat(imagePath); }
  catch {
    console.error(`\nPhoto not found: ${imagePath}`);
    console.error('Put the photo in public/images/ first, then run:');
    console.error(`  npm run new-post -- public/images/${fileName}\n`);
    process.exit(1);
  }
  if (!imagePath.includes(`${path.sep}public${path.sep}images${path.sep}`)) {
    console.log(`Note: ${fileName} is not in public/images/ — the post will point to /images/${fileName}, so move the file there before deploying.`);
  }

  // --- Read EXIF ---
  // Read the file into memory first and hand exifr the bytes, NOT the path.
  // Passing a path string makes exifr open the file itself, and its file
  // reader calls fh.stat(path) — on newer Node that throws
  // "The 'options' argument must be of type object. Received type string",
  // which is exactly the error this script hit on William's machine.
  // A Buffer skips that code path entirely and works on every Node version.
  let exif = {};
  try {
    const buffer = await fs.readFile(imagePath);
    exif = (await exifr.parse(buffer, { tiff: true, exif: true, gps: true, iptc: true, xmp: true })) || {};
  } catch (e) { console.log(`Could not read EXIF (${e.message}) — falling back to filename / file date.`); }

  const missing = [];
  const title = flags.title || titleCase(slug);
  const series = flags.series || title;

  // Date: EXIF DateTimeOriginal first, then file modified time.
  const exifDate = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
  const dateObj = exifDate instanceof Date && !isNaN(exifDate) ? exifDate : stat.mtime;
  if (!exifDate) missing.push('date (no DateTimeOriginal in EXIF — used file modified date, check it)');
  const date = formatDate(dateObj);
  const year = dateObj.getFullYear();

  // Camera: Make + Model, cleaned up for display.
  // Real Nikon EXIF is Make "NIKON CORPORATION", Model "NIKON Z6_3"
  // (my first test used "Z 6III" — wrong format, so the cleanup missed it
  // and produced "Nikon NIKON Z6_3"). Display as "Nikon Z6 III".
  let make = (exif.Make || '').trim();
  let model = (exif.Model || '').trim();
  if (/^NIKON/i.test(make)) make = 'Nikon';
  else if (/^SONY/i.test(make)) make = 'Sony';
  else if (/^CANON/i.test(make)) make = 'Canon';
  else if (/^FUJIFILM/i.test(make)) make = 'Fujifilm';
  else if (make) make = make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
  // Model often repeats the make ("NIKON Z6_3") — strip it.
  model = model.replace(/^NIKON\s+/i, '');
  if (make) model = model.replace(new RegExp(`^${make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '');
  // Nikon underscore generation: Z6_3 -> Z6 III, Z7_2 -> Z7 II.
  model = model.replace(/^Z(\d+)_3$/, 'Z$1 III').replace(/^Z(\d+)_2$/, 'Z$1 II');
  model = model.replace(/^Z (\d)(II|III|IV)$/, 'Z$1 $2').replace(/^Z6III$/, 'Z6 III').replace(/^Z6II$/, 'Z6 II');
  const camera = [make, model].filter(Boolean).join(' ') || '';
  if (!camera) missing.push('camera (no Make/Model in EXIF — photo may be an export/screenshot with EXIF stripped)');

  // Settings: focal length, aperture, shutter, ISO.
  const settingsParts = [];
  if (exif.FocalLength) settingsParts.push(`${Math.round(exif.FocalLength)}mm`);
  if (exif.FocalLengthIn35mmFilm && Math.round(exif.FocalLengthIn35mmFilm) !== Math.round(exif.FocalLength || 0)) settingsParts.push(`(${Math.round(exif.FocalLengthIn35mmFilm)}mm equiv.)`);
  if (exif.FNumber) settingsParts.push(`f/${exif.FNumber}`);
  const shutter = formatExposure(exif.ExposureTime);
  if (shutter) settingsParts.push(shutter);
  const iso = exif.ISO || exif.ISOSpeedRatings;
  if (iso) settingsParts.push(`ISO ${iso}`);
  const settings = settingsParts.join(' · ');
  if (!settings) missing.push('settings (no focal length / aperture / shutter / ISO in EXIF)');

  // If the .md already exists, keep its hand-edited descriptive fields on
  // --force (a --flag still wins). EXIF-derived fields are regenerated.
  // Without this, every --force wiped a location / collection / excerpt
  // the user had typed by hand back to the defaults.
  let existingForPreserve = null;
  try { existingForPreserve = await fs.readFile(mdPath, 'utf8'); } catch { /* new post */ }
  const keptLocation = existingForPreserve ? frontmatterField(existingForPreserve, 'location') : '';
  const keptCollection = existingForPreserve ? frontmatterField(existingForPreserve, 'collection') : '';
  const keptExcerpt = existingForPreserve ? frontmatterField(existingForPreserve, 'excerpt') : '';

  // Location: --location flag first, then GPS, then a kept hand-edited value.
  let location = flags.location || '';
  let gpsNote = '';
  if (!location && exif.latitude != null && exif.longitude != null) {
    if (flags['no-geocode']) {
      location = `${exif.latitude.toFixed(5)}, ${exif.longitude.toFixed(5)}`;
      gpsNote = ' (GPS coordinates — geocoding skipped with --no-geocode)';
    } else {
      console.log(`GPS found (${exif.latitude.toFixed(5)}, ${exif.longitude.toFixed(5)}) — looking up the place name…`);
      location = (await reverseGeocode(exif.latitude, exif.longitude)) || '';
      if (!location) missing.push('location (GPS found but place lookup failed — edit the location: line)');
    }
  }
  if (!location && flags.force && keptLocation) location = keptLocation;
  if (!location) missing.push('location (no GPS in EXIF — edit the location: line)');

  const collection = flags.collection || (flags.force && keptCollection) || 'Uncategorized';
  const excerpt = flags.excerpt || (flags.force && keptExcerpt) || (exif.ImageDescription || exif.UserComment || `${title}.`);
  const image = `/images/${fileName}`;

  const yaml = (v) => JSON.stringify(String(v ?? ''));
  const frontmatter = [
    '---',
    `title: ${yaml(title)}`,
    `series: ${yaml(series)}`,
    'count: 1',
    `year: ${year}`,
    `date: ${yaml(date)}`,
    `location: ${yaml(location)}`,
    `collection: ${yaml(collection)}`,
    `image: ${yaml(image)}`,
    `alt: ${yaml(title)}`,
    `camera: ${yaml(camera)}`,
    `settings: ${yaml(settings)}`,
    `excerpt: ${yaml(excerpt)}`,
    '---',
    '',
  ].join('\n');

  // --- Write the .md file ---
  let existing = existingForPreserve;
  let bodyText = 'Write your story here.\n';

  if (existing !== null) {
    const hasFrontmatter = existing.trimStart().startsWith('---');
    if (hasFrontmatter && !flags.force) {
      console.error(`\n${slug}.md already has frontmatter — not overwriting.`);
      console.error(`To regenerate it, run again with --force (your story text is kept).`);
      process.exit(1);
    }
    if (hasFrontmatter && flags.force) {
      bodyText = existing.replace(/^---[\s\S]*?---\s*/, '');
      await fs.writeFile(mdPath, frontmatter + bodyText);
      console.log(`\nRegenerated frontmatter in ${mdPath} (story text kept).`);
    } else {
      // No frontmatter — the cherry-blossom case: prepend, keep the story.
      bodyText = existing.replace(/^\s+/, '');
      await fs.writeFile(mdPath, frontmatter + bodyText);
      console.log(`\nFixed ${mdPath} — frontmatter added, your story text kept.`);
    }
  } else {
    await fs.writeFile(mdPath, frontmatter + bodyText);
    console.log(`\nCreated ${mdPath}`);
  }

  console.log('\nAuto-filled from the photo:');
  console.log(`  title:    ${title}`);
  console.log(`  date:     ${date}  (year ${year})`);
  console.log(`  camera:   ${camera || '(missing)'}`);
  console.log(`  settings: ${settings || '(missing)'}`);
  console.log(`  location: ${location || '(missing)'}${gpsNote}`);
  console.log(`  image:    ${image}`);
  // Only flag the things that actually still need attention: don't tell the
  // user to write a story when their story text was just kept, and don't
  // tell them to set a collection/excerpt that --force preserved.
  const notes = [...missing];
  if (collection === 'Uncategorized' && !flags.collection) notes.push('collection: defaults to "Uncategorized" — change it to Coast / Mountains / Street & night / Road trip, or your own');
  if (excerpt === `${title}.` && !flags.excerpt) notes.push('excerpt: one line for the grid — edit it to your own words');
  if (!bodyText.trim() || bodyText.includes('Write your story here.')) notes.push('story: replace "Write your story here." with your text');
  if (notes.length) {
    console.log('\nStill to check / edit in the .md file:');
    for (const n of notes) console.log(`  - ${n}`);
  } else {
    console.log('\nEverything EXIF could provide was filled in — just edit the collection, excerpt and story if you want.');
  }
  console.log('\nThen preview with:  npm run dev   (http://localhost:4321)');
  console.log('Then publish with:  git add .  /  git commit -m "Add <title>"  /  git push');
}

main().catch((e) => { console.error(e); process.exit(1); });
