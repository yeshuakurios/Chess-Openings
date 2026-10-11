import assert from 'node:assert/strict';
import { MIN_GAMES, lineReach, movePopularity, reachText } from '../src/stats.ts';
import { PHASES } from '../src/roadmap.ts';
import type { Move, Opening, Variation } from '../src/types.ts';

const mv = (san: string, stats?: Move['stats']): Move => ({ san, note: '', eval: 0, ...(stats ? { stats } : {}) });

// opponent move with alternatives
assert.equal(movePopularity(mv('d5', { total: 100, n: 41, w: 0, d: 0, b: 0, alts: [{ san: 'Nf6', n: 17 }, { san: 'e6', n: 13 }, { san: 'c5', n: 5 }] }), false),
  'Among players rated around 1000, 41% reply this way. Also common: Nf6 17%, e6 13%.');
assert.equal(movePopularity(mv('Nf3', { total: 200, n: 150, w: 0, d: 0, b: 0 }), true), 'Among players rated around 1000, 75% choose this move here.');
assert.equal(movePopularity(mv('x'), false), '');
assert.match(movePopularity(mv('x', { total: MIN_GAMES - 1, n: 1, w: 0, d: 0, b: 0 }), false), /Too few games/);
assert.match(movePopularity(mv('x', { total: 10000, n: 3, w: 0, d: 0, b: 0 }), false), /under 1%/);

// reach: opponent replies multiply; the opponent's first move (ply 0) is skipped; user moves are ignored
const s = (n: number) => ({ total: 100, n, w: 0, d: 0, b: 0 });
const white: Opening = { id: 'w', name: 'w', color: 'white', summary: '', status: 'draft', goal: { title: '', text: '', plans: [] }, variations: [] };
const black: Opening = { ...white, color: 'black' };
const line = (moves: Move[]): Variation => ({ id: 'v', name: 'v', strategy: '', moves });
assert.equal(lineReach(white, line([mv('f4', s(1)), mv('d5', s(50)), mv('Nf3', s(1)), mv('Nf6', s(40))])), 0.2);
assert.equal(lineReach(black, line([mv('d4', s(1)), mv('Nf6', s(1)), mv('c4', s(50)), mv('e5', s(1)), mv('dxe5', s(50))])), 0.25);
assert.equal(lineReach(white, line([mv('f4', s(1)), mv('d5')])), undefined);
assert.equal(lineReach(white, line([mv('f4', s(1)), mv('d5', { total: 5, n: 5, w: 0, d: 0, b: 0 })])), undefined);
assert.equal(reachText(undefined), '');
assert.match(reachText(0.2), /about 20%/);

// roadmap covers phases 0-6
assert.deepEqual(PHASES.map(p => p.id).filter(id => id !== 'L'), ['0', '1', '2', '3', '4', '5', '6']);
console.log('stats ok');
