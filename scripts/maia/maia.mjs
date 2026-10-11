import { spawn } from 'node:child_process';
// Needs a built lc0 and a Maia network; see scripts/maia/README.md. MAIA_DIR holds `lc0` (the binary) and `maia-1100.pb.gz`.
const SP = process.env.MAIA_DIR ?? './maia';
const lc0 = spawn(`${SP}/lc0`, [`--weights=${SP}/maia-1100.pb.gz`, '--backend=blas'], { stdio: ['pipe', 'pipe', 'ignore'] });
let buf = '', waiter = null;
lc0.stdout.on('data', d => { buf += d; check(); });
function check() { if (waiter && waiter.test(buf)) { const w = waiter; waiter = null; const out = buf; buf = ''; w.res(out); } }
const until = re => new Promise(res => { waiter = { test: b => re.test(b), res }; check(); });
const send = s => lc0.stdin.write(s + '\n');
send('uci'); await until(/uciok/);
send('setoption name VerboseMoveStats value true'); send('isready'); await until(/readyok/);
/** Maia's probability for each legal move after the given UCI moves from the start position (one network evaluation). */
export async function policy(uciMoves) {
  send(`position startpos${uciMoves.length ? ' moves ' + uciMoves.join(' ') : ''}`); send('go nodes 1');
  const out = await until(/bestmove/);
  const res = [];
  for (const line of out.split('\n')) {
    const m = /^info string (\S+)\s+\(\s*\d+\s*\)\s+N:\s+\d+ \(\+\s*\d+\) \(P:\s*([\d.]+)%\)/.exec(line);
    if (m && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m[1])) res.push({ uci: m[1], p: Number(m[2]) / 100 });
  }
  return res.sort((a, b) => b.p - a.p);
}
export const close = () => { send('quit'); lc0.kill(); };
if (process.argv[1]?.endsWith('maia.mjs')) { console.log(JSON.stringify((await policy(process.argv.slice(2))).slice(0, 8))); close(); }
