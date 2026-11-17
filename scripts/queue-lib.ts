/** The explanation queue (docs/explain-queue.json): prompts the owner pasted from the app's "Ask a question" button, saved by Claude to be written up in batches. */
export interface QueueItem { id: string; k: string; prompt: string; status: 'pending' | 'done' }
export const BATCH = 10;
/** The next batch to write up: the oldest `BATCH` pending items, one per move (a repeated move id keeps only its first entry). */
export function nextBatch(queue: QueueItem[], size = BATCH): QueueItem[] {
  const seen = new Set<string>();
  return queue.filter(x => x.status === 'pending' && !seen.has(x.k) && !!seen.add(x.k)).slice(0, size);
}
