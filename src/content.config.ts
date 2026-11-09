import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    series: z.string(),
    count: z.number(),
    year: z.number(),
    date: z.string(),
    location: z.string(),
    collection: z.string(),
    image: z.string(),
    alt: z.string(),
    camera: z.string(),
    settings: z.string(),
    excerpt: z.string(),
  }),
});

export const collections = { posts };
