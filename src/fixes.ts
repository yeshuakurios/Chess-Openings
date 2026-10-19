import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import type { GameImport, GameMistake } from './games.ts';

/**
 * A mistake from the owner's games as a review card of its own. It is scheduled by FSRS like a line is, but only the one position is drilled
 * (the first move after the owner's slip). It is cleared once it was recalled cleanly on FIX_DAYS different days and FSRS says the memory
 * should last FIX_STABILITY days; a repeat of the mistake in a newer game reopens it. Placeholder thresholds, tune with real use.
 */
export interface Fix {
  id: string;
  k: string; p: number; s: string; f: string; // line to start from, ply, the wrong move, the position (FEN without counters)
  card: Card;
  days: number[];      // epoch days with a clean recall (drills and games)
  gd: number;          // newest game day already counted as a recall
  gt: number;          // time of the newest game in which the mistake was seen
  t: number;           // last change, epoch ms (the newer copy wins when devices sync)
  clearedAt?: number;
}
export const FIX_DAYS = 3, FIX_STABILITY = 21, MAX_FIXES = 100;
const scheduler = fsrs();
const DAY = 86_400_000;
export const dayOf = (ms: number) => Math.floor(ms / DAY);
export const fixId = (x: { f: string; s: string }) => `${x.f}|${x.s}`;
export const isOpen = (f: Fix) => !f.clearedAt;

export const newFix = (x: GameMistake, now: number): Fix => ({ id: fixId(x), k: x.k, p: x.p, s: x.s, f: x.f, card: createEmptyCard(new Date(now)), days: [], gd: dayOf(x.t), gt: x.t, t: now });

/** Dates come back from storage as strings. */
export const reviveFix = (f: Fix): Fix => ({ ...f, card: { ...f.card, due: new Date(f.card.due), last_review: f.card.last_review ? new Date(f.card.last_review) : undefined } });

/** One review. Good adds today to the clean days, Again takes one away; the fix clears when it has enough clean days and a long enough memory. */
export function applyReview(fix: Fix, rating: Grade, now: number): Fix {
  const card = scheduler.next(fix.card, new Date(now), rating).card;
  let days = fix.days;
  if (rating === Rating.Good) { const d = dayOf(now); if (days[days.length - 1] !== d) days = [...days, d]; }
  else if (rating === Rating.Again) days = days.slice(0, -1);
  const next: Fix = { ...fix, card, days, t: now };
  if (!fix.clearedAt && days.length >= FIX_DAYS && card.stability >= FIX_STABILITY) next.clearedAt = now;
  return next;
}

export const dueFixes = (fixes: Record<string, Fix>, now = Date.now()) =>
  Object.values(fixes).filter(f => isOpen(f) && +f.card.due <= now).sort((a, b) => +a.card.due - +b.card.due);
export const fixCounts = (fixes: Record<string, Fix>, now = Date.now()) => {
  const all = Object.values(fixes);
  return { open: all.filter(isOpen).length, cleared: all.filter(f => !isOpen(f)).length, due: dueFixes(fixes, now).length };
};

/**
 * Bring the cards up to date with the imported games: a new mistake gets a card (due now); a mistake seen again in a newer game counts as a
 * failed review (or reopens a cleared card); a later game in which the owner played the line's move at that position counts as a clean one.
 */
export function syncFixes(prev: Record<string, Fix>, imp: GameImport | undefined, now = Date.now()): Record<string, Fix> {
  if (!imp) return prev;
  const out = { ...prev }, seen = new Set<string>();
  for (const x of imp.mistakes) {
    if (!x.f) continue;
    const id = fixId(x);
    if (seen.has(id)) continue; // one real position can sit in several lines of an opening
    seen.add(id);
    let fx = out[id];
    if (!fx) { if (Object.keys(out).length >= MAX_FIXES) continue; fx = newFix(x, now); }
    else if (x.t > fx.gt) fx = fx.clearedAt ? { ...newFix(x, now), id } : { ...applyReview(fx, Rating.Again, now), gt: x.t };
    if (isOpen(fx)) {
      const days = (imp.recalls?.[`${fx.k}#${fx.p}`]?.ok ?? []).filter(d => d > fx.gd).sort((a, b) => a - b);
      for (const d of days) {
        const at = d * DAY + DAY / 2;
        if (!fx.card.last_review || at > +fx.card.last_review) fx = applyReview(fx, Rating.Good, at);
      }
      if (days.length) fx = { ...fx, gd: Math.max(fx.gd, days[days.length - 1]) };
    }
    out[id] = fx;
  }
  return out;
}

/** Per card, the newer change wins. */
export function mergeFixes(a: Record<string, Fix>, b: Record<string, Fix>): Record<string, Fix> {
  const out = { ...a };
  for (const [id, f] of Object.entries(b)) if (!out[id] || f.t > out[id].t) out[id] = f;
  return out;
}

/** "Due now", "Back later today", "Back tomorrow", "Back in 5 days". */
export function whenText(f: Fix, now = Date.now()): string {
  const ms = +f.card.due - now;
  if (ms <= 0) return 'Due now';
  if (ms < DAY * 0.75) return 'Back later today';
  const days = Math.round(ms / DAY);
  return days <= 1 ? 'Back tomorrow' : `Back in ${days} days`;
}
