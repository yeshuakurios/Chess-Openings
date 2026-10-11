import { authHeader } from './store.ts';
import type { ExplainFacts } from './explainShared.ts';

/**
 * Ask the Worker to rephrase a verified, rule-based explanation with Workers AI.
 * Returns null on any problem (offline, no token, over the free allowance, model refused), and the caller keeps the rule-based text.
 */
export async function aiExplain(facts: ExplainFacts): Promise<string | null> {
  try {
    const res = await fetch('./api/explain', { method: 'POST', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(facts) });
    if (!res.ok) return null;
    const j = (await res.json()) as { text?: unknown };
    return typeof j.text === 'string' ? j.text : null;
  } catch { return null; }
}
