import type { RawGame } from './games.ts';

const API = 'https://lichess.org/api/games/user/';
export const USERNAME = /^[A-Za-z0-9_-]{2,30}$/;
export const FIRST_GAMES = 100; // the first import takes the newest games
export const LATER_GAMES = 10;  // later imports keep only games newer than the last import

/** One finished game as lichess's ndjson game export returns it (only the fields we read; `pgnInJson=true` is required). */
interface LichessGame {
  variant: string; status: string; winner?: 'white' | 'black';
  createdAt: number; lastMoveAt?: number; pgn?: string; id: string;
  players: { white: { user?: { name: string } }; black: { user?: { name: string } } };
}
const DRAWN_STATUS = new Set(['draw', 'stalemate']);

/** lichess has no per-side result string; build one `sideOf()` in games.ts already understands: "win", a DRAWN keyword, or any other string for a loss. */
function toRawGame(g: LichessGame): RawGame | undefined {
  if (!g.pgn) return undefined;
  const result = (color: 'white' | 'black') => DRAWN_STATUS.has(g.status) ? 'agreed' : g.winner === color ? 'win' : 'lost';
  return {
    url: `https://lichess.org/${g.id}`, pgn: g.pgn, rules: g.variant === 'standard' ? 'chess' : g.variant,
    end_time: Math.floor((g.lastMoveAt ?? g.createdAt) / 1000),
    white: { username: g.players.white.user?.name ?? '', result: result('white') },
    black: { username: g.players.black.user?.name ?? '', result: result('black') },
  };
}

/** Fetch the user's newest `max` games from lichess's free public API (no key; ndjson, newest first). */
export async function fetchGames(user: string, opts: { max: number; get?: typeof fetch; progress?: (msg: string) => void }): Promise<RawGame[]> {
  const name = user.trim();
  if (!USERNAME.test(name)) throw new Error('That does not look like a Lichess username.');
  const get = opts.get ?? fetch;
  opts.progress?.('Reading your games…');
  const url = `${API}${encodeURIComponent(name)}?max=${opts.max}&pgnInJson=true&moves=false`;
  const res = await get(url, { headers: { Accept: 'application/x-ndjson' } });
  if (res.status === 404) throw new Error(`No Lichess player called "${name}".`);
  if (res.status === 429) throw new Error('Lichess asked us to slow down. Try again in a minute.');
  if (!res.ok) throw new Error(`Lichess answered ${res.status}.`);
  const text = await res.text();
  const games: RawGame[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const g = toRawGame(JSON.parse(line) as LichessGame);
    if (g) games.push(g);
  }
  return games.slice(0, opts.max);
}
