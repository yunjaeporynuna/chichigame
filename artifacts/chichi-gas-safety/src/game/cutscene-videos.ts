/**
 * Pre-rendered cutscene clips.
 *
 * Files live in src/assets/cutscenes and are picked up at build time, so a
 * scene whose clip has not been produced yet resolves to null and the game
 * plays its in-engine cinematic instead.
 */
const urls = import.meta.glob('../assets/cutscenes/*.mp4', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byName = new Map<string, string>();
for (const [path, url] of Object.entries(urls)) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  byName.set(name, url);
}

export function cutsceneVideoUrl(name: string | undefined): string | null {
  if (!name) return null;
  return byName.get(name) ?? null;
}
