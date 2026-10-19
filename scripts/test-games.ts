import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { analyzeGames, gameMistakeText, mistakesAt, type RawGame } from '../src/games.ts';
import { fetchGames } from '../src/chesscom.ts';
import { listContentFiles, loadOpening } from './shared.ts';
import type { Opening } from '../src/types.ts';

const all = listContentFiles().map(f => loadOpening(f)) as unknown as Opening[];
const bird = all.find(o => o.id === 'bird')!, v = bird.variations[0];
const sans = v.moves.map(m => m.san);
const game = (moves: string[], o: Partial<RawGame> = {}, me: 'white' | 'black' = 'white', result = 'win'): RawGame => {
  const c = new Chess(); moves.forEach(m => c.move(m));
  const other = me === 'white' ? 'black' : 'white';
  return { url: 'https://chess.com/game/' + moves.join(''), pgn: c.pgn(), rules: 'chess', end_time: 1_700_000_000, [me]: { username: 'Me', result }, [other]: { username: 'Them', result: result === 'win' ? 'resigned' : 'win' }, ...o } as RawGame;
};
// the user's second move (ply 2) swapped for another legal move
const c = new Chess(); sans.slice(0, 2).forEach(m => c.move(m));
const alt = c.moves().find(m => !bird.variations.some(w => w.moves.length > 2 && w.moves[0].san === sans[0] && w.moves[1].san === sans[1] && w.moves[2].san === m))!;
const dev = (more: string[] = []) => [...sans.slice(0, 2), alt, ...more];
const after = new Chess(); dev().forEach(m => after.move(m));
const reply = after.moves()[0]; after.move(reply);
const g1 = game([...dev(), reply], {}, 'white', 'win'), g2 = game([...dev(), reply], { url: 'https://chess.com/game/2', end_time: 1_700_000_100 }, 'white', 'resigned');
const r = analyzeGames([g1, g2], 'me', [bird], 5);
assert.equal(r.games, 2); assert.equal(r.left, 2);
const m = r.mistakes.find(x => x.p === 2 && x.s === alt && x.k === `bird/${v.id}`)!;
assert.ok(m, 'deviation recorded against the line');
assert.equal(m.n, 2); assert.equal(m.w, 1); assert.equal(m.l, 1);
assert.deepEqual(m.line, [reply]); assert.equal(m.u, 'https://chess.com/game/2', 'latest game is kept');
assert.ok(!gameMistakeText(m).includes(sans[2]), 'text must not name the line move');
// a game that stays in the line is "kept"; one in another opening is ignored; a game as the other colour is ignored for a white opening
const stay = analyzeGames([game(sans.slice(0, 4))], 'ME', [bird]);
assert.equal(stay.kept, 1); assert.equal(stay.left, 0); assert.equal(stay.mistakes.length, 0);
const other = analyzeGames([game(['e4', 'e5', 'Nf3'])], 'me', [bird]);
assert.equal(other.left + other.kept, 0, 'not in the opening');
assert.equal(other.mistakes.length, 0);
assert.equal(analyzeGames([game(dev(), {}, 'black')], 'me', [bird]).mistakes.length, 0);
// opponent leaving the line first is not the user's mistake
const opp = new Chess(); opp.move(sans[0]); const oppAlt = opp.moves().find(x => x !== sans[1])!;
const oppRes = analyzeGames([game([sans[0], oppAlt, 'Nf3'])], 'me', [bird]);
assert.equal(oppRes.left, 0); assert.equal(oppRes.mistakes.length, 0);
// non-standard rules and bad PGNs are skipped
assert.equal(analyzeGames([game(sans.slice(0, 3), { rules: 'chess960' }), { ...g1, pgn: 'not a pgn ((' }], 'me', [bird]).games, 0);
// the same position in several variations: every variation gets the mistake
assert.ok(new Set(analyzeGames([g1], 'me', [bird]).mistakes.map(x => x.k)).size >= 1);
// replacement rules
const hand = [{ san: 'h4', line: [], text: 'hand' }];
assert.equal(mistakesAt(undefined, m.k, 2, hand)[0].text, 'hand');
assert.equal(mistakesAt(r, m.k, 3, hand)[0].text, 'hand', 'no game data at that move: hand-written stays');
assert.equal(mistakesAt(r, m.k, 2, hand)[0].san, alt, 'game data replaces hand-written');
assert.deepEqual(mistakesAt({ ...r, mistakes: [] }, m.k, 2, hand), hand, 'an empty import restores them');
// fetching: newest archives first, newest games first, bad names and errors
const urls: string[] = [];
const fake = (async (url: string) => {
  urls.push(url);
  if (url.endsWith('/archives')) return Response.json({ archives: ['https://api.chess.com/pub/player/meme/games/2026/08', 'https://api.chess.com/pub/player/meme/games/2026/09', 'https://evil.example/x'] });
  return Response.json({ games: [{ url: url + '#a' }, { url: url + '#b' }] });
}) as unknown as typeof fetch;
const got = await fetchGames(' Meme ', { get: fake, months: 2, max: 100 });
assert.deepEqual(urls.slice(1), ['https://api.chess.com/pub/player/meme/games/2026/09', 'https://api.chess.com/pub/player/meme/games/2026/08']);
assert.equal(got.length, 4); assert.ok(got[0].url!.endsWith('09#b'));
await assert.rejects(fetchGames('a b', { get: fake, months: 1, max: 1 }), /username/);
await assert.rejects(fetchGames('nobody', { get: (async () => new Response('', { status: 404 })) as unknown as typeof fetch, months: 1, max: 1 }), /No chess.com player/);
console.log('games ok');
// incremental: counts add up, `last` moves forward, the latest follow-up wins, the cap holds
import { mergeImports } from '../src/games.ts';
assert.equal(r.last, 1_700_000_100);
const later = analyzeGames([game([...dev(), reply], { url: 'https://chess.com/game/3', end_time: 1_700_000_900 }, 'white', 'win')], 'me', [bird]);
const both = mergeImports(r, later);
const m3 = both.mistakes.find(x => x.p === 2 && x.s === alt && x.k === m.k)!;
assert.equal(m3.n, 3); assert.equal(m3.w, 2); assert.equal(m3.u, 'https://chess.com/game/3');
assert.equal(both.games, 3); assert.equal(both.left, 3); assert.equal(both.last, 1_700_000_900);
assert.equal(mergeImports(r, later, 1).mistakes.length, 1);
console.log('incremental ok');
