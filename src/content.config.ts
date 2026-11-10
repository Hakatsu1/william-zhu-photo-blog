import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Only title + image are truly required. Everything else has a default,
// so a post can never fail the build with InvalidContentEntryDataError
// just because EXIF was missing (e.g. an exported / screenshotted photo
// with the metadata stripped). The new-post script fills these in from
// EXIF when it can; anything it can't find stays blank for you to edit.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    series: z.string().default(''),
    count: z.number().default(1),
    year: z.number().default(2026),
    date: z.string().default('2026-01-01'),
    location: z.string().default(''),
    collection: z.string().default('Uncategorized'),
    image: z.string(),
    alt: z.string().default(''),
    camera: z.string().default(''),
    settings: z.string().default(''),
    excerpt: z.string().default(''),
  }),
});

export const collections = { posts };
