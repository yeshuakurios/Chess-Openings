// Shared by the Worker (calls Workers AI) and the app (asks the Worker). Pure: no DOM and no Workers APIs, so it can be unit tested.
export type Kind = 'tactical' | 'other-line' | 'move-order' | 'hint' | 'slow' | 'other';

/** Only verified facts. The line's correct move is deliberately absent, so the model cannot leak it. */
export interface ExplainFacts {
  opening: string; line: string; plan: string;
  side: 'white' | 'black'; moveNumber: number;
  kind: Kind; played?: string;
  wrong: number; hints: number; slow: number;
  /** The rule-based explanation, already verified; the model only rephrases it. */
  rule: string;
}

const KINDS = new Set<Kind>(['tactical', 'other-line', 'move-order', 'hint', 'slow', 'other']);
const str = (v: unknown, max: number): string => { if (typeof v !== 'string' || v.length > max) throw new Error('bad string'); return v; };
const num = (v: unknown): number => { if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1000) throw new Error('bad number'); return v; };

/** Validate untrusted JSON into facts, or throw. */
export function parseFacts(raw: unknown): ExplainFacts {
  if (typeof raw !== 'object' || raw === null) throw new Error('bad body');
  const r = raw as Record<string, unknown>;
  const kind = r.kind as Kind;
  if (!KINDS.has(kind)) throw new Error('bad kind');
  if (r.side !== 'white' && r.side !== 'black') throw new Error('bad side');
  return {
    opening: str(r.opening, 80), line: str(r.line, 120), plan: str(r.plan, 120), side: r.side, moveNumber: num(r.moveNumber), kind,
    ...(r.played === undefined ? {} : { played: str(r.played, 12) }),
    wrong: num(r.wrong), hints: num(r.hints), slow: num(r.slow), rule: str(r.rule, 400)
  };
}

export const SYSTEM_PROMPT =
  'You are a patient chess coach. Rephrase the verified note below as a short, friendly explanation, at most two sentences in plain words, ' +
  'for a learner who just made this mistake. Use only the facts given. Never invent moves, evaluations, tactics or plans. ' +
  'Mention at most one move: the one the learner played, if any. Do not say what the correct move is. Reply with the explanation only.';

export function buildMessages(f: ExplainFacts): { role: 'system' | 'user'; content: string }[] {
  const lines = [
    `Opening: ${f.opening} (the learner plays ${f.side}). Line: ${f.line}.`,
    `Plan of the opening: ${f.plan}.`,
    `Position: the learner's move number ${f.moveNumber}. Kind of mistake: ${f.kind}.`,
    f.played ? `Move the learner played: ${f.played}.` : 'The learner did not play a wrong move (hint or slow).',
    `Recent history here: ${f.wrong} wrong, ${f.hints} hints, ${f.slow} slow.`,
    `Verified note to rephrase: ${f.rule}`
  ];
  return [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: lines.join('\n') }];
}

const SAN = /\b(?:[NBRQK][a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?|[a-h]x?[a-h]?[1-8]|\d+\.{1,3})[+#]?/g;

/** Clean the model's answer, or return null to fall back to the rule-based text. Rejects any move other than the one played. */
export function cleanAnswer(text: unknown, played?: string): string | null {
  if (typeof text !== 'string') return null;
  const t = text.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  if (t.length < 20 || t.length > 320) return null;
  const allowed = played?.replace(/[+#]$/, '');
  for (const m of t.match(SAN) ?? []) if (m.replace(/[+#]$/, '') !== allowed) return null;
  return t;
}

/** Pull the text out of either response shape Workers AI chat models use. */
export function extractText(out: unknown): string | undefined {
  const o = out as { response?: unknown; choices?: { message?: { content?: unknown } }[] } | null;
  if (typeof o?.response === 'string') return o.response;
  const c = o?.choices?.[0]?.message?.content;
  return typeof c === 'string' ? c : undefined;
}

/** Same facts and model always give the same key, so the answer is cached once. */
export async function cacheKey(f: ExplainFacts, model: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([model, f])));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
