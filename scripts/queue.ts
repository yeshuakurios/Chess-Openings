// `npm run queue` prints the next batch of 10 pending explanation requests. `npm run queue -- done <id> ...` marks items done after they are written.
import { readFileSync, writeFileSync } from 'node:fs';
import { nextBatch, type QueueItem } from './queue-lib.ts';
const FILE = 'docs/explain-queue.json';
const queue: QueueItem[] = JSON.parse(readFileSync(FILE, 'utf8'));
const [cmd, ...ids] = process.argv.slice(2);
if (cmd === 'done') {
  for (const x of queue) if (ids.includes(x.id)) x.status = 'done';
  writeFileSync(FILE, JSON.stringify(queue, null, 2) + '\n');
  console.log(`marked ${ids.length} done`);
} else {
  const batch = nextBatch(queue);
  console.log(`${batch.length} of ${queue.filter(x => x.status === 'pending').length} pending (batch of 10)\n`);
  for (const x of batch) console.log(`--- ${x.id} (${x.k})\n${x.prompt}\n`);
}
