import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { Shape } from './types.ts';
import { Chess } from 'chess.js';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';

const toDraw = (shapes: Shape[] = []): DrawShape[] =>
  shapes.map(s => ({ orig: s.from as Key, dest: s.to as Key | undefined, brush: s.color ?? 'green' }));

/** Read-only board showing one position with shapes on it. */
export function staticBoard(el: HTMLElement, orientation: 'white' | 'black', fen: string, shapes: Shape[]): Api {
  return Chessground(el, { fen, orientation, coordinates: true, viewOnly: true, animation: { enabled: false }, drawable: { autoShapes: toDraw(shapes) } });
}
export const fenAfter = (sans: string[], ply: number) => { const c = new Chess(); sans.slice(0, ply).forEach(m => c.move(m)); return c.fen(); };

export interface Board {
  cg: Api;
  show(chess: Chess, last?: [Key, Key]): void;
  allowMoves(chess: Chess, color: 'white' | 'black', onMove: (from: Key, to: Key) => void, last?: [Key, Key]): void;
  lock(): void;
  arrow(from: Key, to: Key): void;
  clearArrow(): void;
  shapes(list?: Shape[]): void;
}

const dests = (chess: Chess) => {
  const m = new Map<Key, Key[]>();
  for (const mv of chess.moves({ verbose: true })) {
    const list = m.get(mv.from as Key) ?? [];
    list.push(mv.to as Key); m.set(mv.from as Key, list);
  }
  return m;
};
const colorOf = (chess: Chess) => (chess.turn() === 'w' ? 'white' : 'black') as 'white' | 'black';

export function createBoard(el: HTMLElement, orientation: 'white' | 'black'): Board {
  const cg = Chessground(el, {
    orientation, coordinates: true, animation: { enabled: !matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 180 },
    movable: { free: false, showDests: true }, draggable: { showGhost: true },
    highlight: { lastMove: true, check: true }
  });
  return {
    cg,
    show(chess, last) {
      cg.set({ fen: chess.fen(), turnColor: colorOf(chess), check: chess.inCheck(), lastMove: last, movable: { color: undefined, dests: new Map() } });
    },
    allowMoves(chess, color, onMove, last) {
      cg.cancelMove(); // drop any leftover selection from a rejected move
      cg.set({
        fen: chess.fen(), turnColor: colorOf(chess), check: chess.inCheck(), lastMove: last,
        movable: { color, dests: dests(chess), free: false, events: { after: (from, to) => onMove(from, to) } }
      });
    },
    lock() { cg.set({ movable: { color: undefined, dests: new Map() } }); },
    arrow(from, to) { cg.setAutoShapes([{ orig: from, dest: to, brush: 'green' }]); },
    clearArrow() { cg.setAutoShapes([]); },
    shapes(list) { cg.setAutoShapes(toDraw(list)); }
  };
}
