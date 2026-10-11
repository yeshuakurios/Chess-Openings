// Build-time only: queries the Lichess opening explorer and writes `stats` onto every move
// (games at the position, how many played this move, results, and the likeliest other replies).
// Needs LICHESS_TOKEN (a free token with no scopes). Never run at runtime; the token stays out of the repo.
import { writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { listContentFiles, loadOpening } from './shared.ts';
import type { MoveStats } from './shared.ts';

const BASE = process.env.EXPLORER_URL ?? 'https://explorer.lichess.ovh/lichess';
const RATINGS = process.env.RATINGS ?? '1000';
const SPEEDS = process.env.SPEEDS ?? 'blitz,rapid,classical';
const DELAY_MS = Number(process.env.DELAY_MS ?? 1200);
const TOKEN = process.env.LICHESS_TOKEN;
if (!TOKEN) { console.error('Set LICHESS_TOKEN (create one at lichess.org/account/oauth/token, no scopes).'); process.exit(1); }

interface ExplorerMove { san: string; white: number; draws: number; black: number }
interface ExplorerPos { white: number; draws: number; black: number; moves: ExplorerMove[] }

const cache = new Map<string, ExplorerPos>();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function query(play: string[]): Promise<ExplorerPos> {
  const key = play.join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const url = `${BASE}?variant=standard&speeds=${SPEEDS}&ratings=${RATINGS}&moves=20&topGames=0&recentGames=0&play=${key}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(DELAY_MS);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (res.status === 429) { console.log('rate limited, waiting 65 s'); await sleep(65_000); continue; }
    if (!res.ok) throw new Error(`explorer ${res.status} for play=${key}: ${(await res.text()).slice(0, 200)}`);
    const pos = await res.json() as ExplorerPos;
    cache.set(key, pos);
    return pos;
  }
  throw new Error(`explorer kept rate limiting play=${key}`);
}

const files = listContentFiles();
for (const file of files) {
  const o = loadOpening(file);
  for (const v of o.variations) {
    const chess = new Chess();
    const play: string[] = [];
    const line: string[] = [];
    for (const [i, m] of v.moves.entries()) {
      const userMove = (i % 2 === 0) === (o.color === 'white');
      const pos = await query(play);
      const total = pos.white + pos.draws + pos.black;
      const hit = pos.moves.find(x => x.san === m.san);
      const stats: MoveStats = { total, n: hit ? hit.white + hit.draws + hit.black : 0, w: hit?.white ?? 0, d: hit?.draws ?? 0, b: hit?.black ?? 0 };
      if (!userMove) {
        stats.alts = pos.moves.filter(x => x.san !== m.san).slice(0, 4).map(x => ({ san: x.san, n: x.white + x.draws + x.black }));
      }
      m.stats = stats;
      const mv = chess.move(m.san);
      play.push(mv.from + mv.to + (mv.promotion ?? ''));
      line.push(`${m.san}${userMove ? '' : ` ${total ? Math.round(100 * stats.n / total) : 0}%`}`);
    }
    console.log(`${o.id}/${v.id}: ${line.join(' ')}`);
  }
  writeFileSync(file, JSON.stringify(o, null, 2) + '\n');
}
