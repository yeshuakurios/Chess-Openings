import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { listContentFiles, loadOpening } from '../scripts/shared.ts';
import { buildSegments, hasNarration, type Segment } from '../src/segments.ts';
import type { Opening } from '../src/types.ts';

export const ROOT = join(import.meta.dirname, '..');
export const VIDEOS = join(ROOT, 'videos');
export const MANIFEST = join(VIDEOS, 'manifest.json');
export const VOICE = 'en_US-ryan-medium';
export const VOICE_URL = `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/${VOICE}`;
/** Files whose change alters how every video looks or sounds. Part of each hash. */
const CODE = ['src/segments.ts', 'src/autoplay.ts', 'video/lib.ts', 'video/render.ts'];

export interface Item { key: string; opening: string; variation: string; title: string; segments: Segment[]; hash: string }
export interface Entry { hash: string; mp4: string; srt: string; seconds: number }
export type Manifest = Record<string, Entry>;
export type State = 'fresh' | 'stale' | 'missing';

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const codeHash = () => sha(CODE.map(f => readFileSync(join(ROOT, f), 'utf8')).join('\0'));

/** Every narrated variation, with the hash of exactly what its video shows and says (computed fields like caps and stats are not part of it). */
export function listItems(): Item[] {
  const code = codeHash(), items: Item[] = [];
  for (const file of listContentFiles()) {
    const o = loadOpening(file) as unknown as Opening; // content is checked by `npm run validate`; the scripts' copy of the type only differs in optional generated fields
    for (const v of o.variations) {
      if (!hasNarration(v)) continue;
      const segments = buildSegments(o, v);
      const hash = sha(JSON.stringify({ o: o.name, c: o.color, v: v.name, segments, voice: VOICE, code }));
      items.push({ key: `${o.id}/${v.id}`, opening: o.id, variation: v.id, title: `${o.name}: ${v.name}`, segments, hash });
    }
  }
  return items;
}

export function readManifest(): Manifest {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
}
export function writeManifest(m: Manifest) {
  mkdirSync(dirname(MANIFEST), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
}
export function stateOf(it: Item, m: Manifest): State {
  const e = m[it.key];
  if (!e || !existsSync(join(ROOT, e.mp4))) return 'missing';
  return e.hash === it.hash ? 'fresh' : 'stale';
}
