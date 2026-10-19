import type { RawGame } from './games.ts';

const API = 'https://api.chess.com/pub/player/';
export const USERNAME = /^[A-Za-z0-9_-]{3,25}$/;
export const MONTHS = 3;       // newest monthly archives read
export const MAX_GAMES = 400;  // newest games kept from those

/** Fetch the user's recent standard games from chess.com's free public API (no key; the API allows browser requests). Archives are read one at a time, newest first, as the API asks. */
export async function fetchGames(user: string, opts: { months?: number; max?: number; get?: typeof fetch; progress?: (msg: string) => void } = {}): Promise<RawGame[]> {
  const name = user.trim().toLowerCase();
  if (!USERNAME.test(name)) throw new Error('That does not look like a chess.com username.');
  const get = opts.get ?? fetch, months = opts.months ?? MONTHS, max = opts.max ?? MAX_GAMES;
  const json = async (url: string) => {
    const res = await get(url);
    if (res.status === 404) throw new Error(`No chess.com player called "${name}".`);
    if (res.status === 429) throw new Error('chess.com asked us to slow down. Try again in a minute.');
    if (!res.ok) throw new Error(`chess.com answered ${res.status}.`);
    return res.json() as Promise<{ archives?: string[]; games?: RawGame[] }>;
  };
  const archives = ((await json(`${API}${name}/games/archives`)).archives ?? []).filter(u => u.startsWith(API)).slice(-months).reverse();
  const out: RawGame[] = [];
  for (const [i, url] of archives.entries()) {
    opts.progress?.(`Reading month ${i + 1} of ${archives.length}…`);
    const games = (await json(url)).games ?? [];
    out.push(...games.reverse()); // newest first
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}
