// Used by the daily-answers workflow: reads the questions fetched from the Worker (file argument 1) and writes the ones that have no
// answer yet in src/answers.json (file argument 2), oldest first, as JSON. Prints how many there are. Nothing here talks to the network.
import { readFileSync, writeFileSync } from 'node:fs';

export interface AskedQuestion { id: string; t: number; q: string; k?: string }

/** Valid, unanswered questions, oldest first. Anything malformed is dropped. */
export function unanswered(fetched: unknown, answers: Record<string, unknown>): AskedQuestion[] {
  const list = (fetched as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is AskedQuestion => typeof x?.id === 'string' && typeof x.q === 'string' && typeof x.t === 'number' && !(x.id in answers))
    .sort((a, b) => a.t - b.t);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [fromWorker, answersFile, out] = process.argv.slice(2);
  const list = unanswered(JSON.parse(readFileSync(fromWorker, 'utf8')), JSON.parse(readFileSync(answersFile, 'utf8')));
  writeFileSync(out, JSON.stringify(list, null, 2));
  console.log(list.length);
}
