export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function groupCounts(posts: { data: { series: string; collection: string } }[]) {
  const series = new Map<string, number>();
  const collections = new Map<string, number>();
  for (const p of posts) {
    series.set(p.data.series, (series.get(p.data.series) ?? 0) + 1);
    collections.set(p.data.collection, (collections.get(p.data.collection) ?? 0) + 1);
  }
  return {
    series: [...series.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    collections: [...collections.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}
