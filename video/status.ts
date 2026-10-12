// Lists which narrated videos are stale or missing. Writes a Markdown report to $GITHUB_STEP_SUMMARY when set; exits 0 always. `--list` prints only the keys to re-render.
import { appendFileSync } from 'node:fs';
import { listItems, readManifest, stateOf } from './lib.ts';

const m = readManifest(), items = listItems();
const todo = items.filter(i => stateOf(i, m) !== 'fresh');
if (process.argv.includes('--list')) { console.log(todo.map(i => i.key).join('\n')); process.exit(0); }
const rows = items.map(i => `| ${i.key} | ${stateOf(i, m) === 'fresh' ? 'fresh' : stateOf(i, m) === 'stale' ? '⚠️ STALE (data or narration changed)' : '⚠️ not built yet'} |`);
const md = `### Videos\n\n${items.length ? `| Video | State |\n|---|---|\n${rows.join('\n')}` : 'No variation has narration yet.'}\n`;
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
