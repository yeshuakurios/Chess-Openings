import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync(process.argv[2] ?? 'replies.json', 'utf8'));
const pct = x => (x * 100).toFixed(0) + '%';
const seen = new Set();
// one line per distinct decision point, in line order, showing the scripted move and the likeliest alternatives
for (const id of [...new Set(rows.map(r => r.id))]) {
  console.log(`\n== ${id}`);
  for (const r of rows.filter(x => x.id === id)) {
    const alts = r.top.filter(t => t.san !== r.scripted).slice(0, 3).map(t => `${t.san} ${pct(t.p)}`).join(', ');
    console.log(`  ${r.moveNo}${r.color === 'w' ? '.' : '...'} ${r.scripted.padEnd(6)} ${pct(r.pScripted).padStart(4)}   others: ${alts}`);
  }
}
