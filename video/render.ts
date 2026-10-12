// Renders narrated variations to videos/<opening>/<variation>.mp4 + .srt.
//   npm run video -- modern-defence/e4-classical     one video
//   npm run video -- --changed                       every stale or missing video
// Needs: ffmpeg, python3 with piper-tts, Playwright's Chromium. See video/README.md.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { segmentMs, TAIL_MS, LEAD_MS, type Segment } from '../src/segments.ts';
import { listItems, readManifest, ROOT, stateOf, VIDEOS, VOICE, VOICE_URL, writeManifest, type Item } from './lib.ts';

const TMP = join(ROOT, 'video', '.tmp'), CACHE = join(ROOT, 'video', '.cache');
const W = 1080, H = 1920; // vertical, fits Shorts/Reels/TikTok; the app doubles itself in ?autoplay mode (style.css)

// ---------- voice ----------
function ensureVoice() {
  mkdirSync(CACHE, { recursive: true });
  for (const ext of ['.onnx', '.onnx.json']) {
    const f = join(CACHE, VOICE + ext);
    if (!existsSync(f)) execFileSync('curl', ['-fsSL', '-o', f, `${VOICE_URL}${ext}?download=true`], { stdio: 'inherit' });
  }
  return join(CACHE, VOICE + '.onnx');
}
/** Piper with the noise terms at 0: the same text always gives the same samples. Squares are spelled out ("d 4") so they are not read as one word. */
function speak(voice: string, text: string, out: string) {
  const spoken = text.replace(/\b([a-h])([1-8])\b/g, '$1 $2');
  execFileSync(process.env.PIPER_PYTHON ?? 'python3', ['-m', 'piper', '-m', voice, '-f', out, '--noise-scale', '0', '--noise-w-scale', '0'], { input: spoken, stdio: ['pipe', 'ignore', 'inherit'] });
}

// ---------- wav ----------
interface Wav { rate: number; pcm: Buffer }
function readWav(file: string): Wav {
  const b = readFileSync(file);
  let p = 12, rate = 0;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') { if (b.readUInt16LE(p + 10) !== 1 || b.readUInt16LE(p + 22) !== 16) throw new Error('expected mono 16-bit PCM'); rate = b.readUInt32LE(p + 12); }
    if (id === 'data') return { rate, pcm: b.subarray(p + 8, p + 8 + size) };
    p += 8 + size + (size & 1);
  }
  throw new Error(`no data chunk in ${file}`);
}
function writeWav(file: string, rate: number, pcm: Buffer) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(file, Buffer.concat([h, pcm]));
}

// ---------- captions ----------
const stamp = (ms: number) => { const t = Math.round(ms), p = (n: number, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(t / 3600000))}:${p(Math.floor(t / 60000) % 60)}:${p(Math.floor(t / 1000) % 60)},${p(t % 1000, 3)}`; };
/** Sentences, then split on word boundaries into pieces of at most `max` characters (two lines on screen). */
function chunks(text: string, max = 56): string[] {
  const out: string[] = [];
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    const n = Math.ceil(s.length / max), words = s.split(' ');
    let cur = '';
    for (const w of words) { if (cur && (cur + ' ' + w).length > Math.ceil(s.length / n) + 6) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    if (cur) out.push(cur);
  }
  return out;
}
function srtFor(segs: Segment[], starts: number[], audioMs: number[]): string {
  const cues: string[] = [];
  segs.forEach((s, i) => {
    if (!s.text) return;
    const parts = chunks(s.text), total = parts.reduce((a, p) => a + p.length, 0);
    let t = starts[i] + LEAD_MS;
    for (const p of parts) { const d = audioMs[i] * p.length / total; cues.push(`${cues.length + 1}\n${stamp(t)} --> ${stamp(t + d)}\n${p}\n`); t += d; }
  });
  return cues.join('\n');
}

// ---------- browser ----------
function chromePath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try { if (existsSync(chromium.executablePath())) return undefined; } catch { /* fall through */ }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  const dir = existsSync(base) ? readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().pop() : undefined;
  return dir ? join(base, dir, 'chrome-linux', 'chrome') : undefined;
}

async function renderOne(it: Item, voice: string, baseUrl: string, browser: Awaited<ReturnType<typeof chromium.launch>>) {
  const dir = join(TMP, it.key.replace('/', '__')); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  // 1. speech, one wav per segment, and the exact timeline it implies
  const rate = { v: 0 }, audio: (Buffer | null)[] = [], audioMs: number[] = [];
  it.segments.forEach((s, i) => {
    if (!s.text) { audio.push(null); audioMs.push(0); return; }
    const f = join(dir, `s${i}.wav`); speak(voice, s.text, f);
    const w = readWav(f); rate.v = w.rate; audio.push(w.pcm); audioMs.push(Math.round(w.pcm.length / 2 / w.rate * 1000));
  });
  const durs = it.segments.map((s, i) => segmentMs(s.text, audioMs[i]));
  const starts = durs.map((_, i) => durs.slice(0, i).reduce((a, b) => a + b, 0));
  const totalMs = durs.reduce((a, b) => a + b, 0) + TAIL_MS;
  const pcm = Buffer.alloc(Math.round(totalMs * rate.v / 1000) * 2);
  audio.forEach((a, i) => { if (a) a.copy(pcm, Math.round((starts[i] + LEAD_MS) * rate.v / 1000) * 2); });
  writeWav(join(dir, 'audio.wav'), rate.v, pcm);
  writeFileSync(join(dir, 'captions.srt'), srtFor(it.segments, starts, audioMs));

  // 2. record the autoplay page with those durations
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(`window.__autoplayDurations = ${JSON.stringify(durs)};`);
  const before = Date.now(), page = await ctx.newPage();
  await page.goto(`${baseUrl}?autoplay=${it.key}`);
  await page.waitForFunction('window.__autoplayDone === true', undefined, { timeout: totalMs + 60000 });
  const offset = ((await page.evaluate('window.__autoplayStart')) as number - before) / 1000; // video time at which the first segment appears
  const webm = await page.video()!.path();
  await ctx.close();

  // 3. mux: trim the lead-in, burn captions, add the audio
  const out = join(VIDEOS, it.opening, `${it.variation}.mp4`);
  mkdirSync(join(VIDEOS, it.opening), { recursive: true });
  const style = 'FontName=DejaVu Sans,Bold=1,Fontsize=8,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=22,MarginL=20,MarginR=20';
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', offset.toFixed(3), '-i', webm, '-i', join(dir, 'audio.wav'),
    '-vf', `tpad=stop_mode=clone:stop_duration=3,fps=30,subtitles=captions.srt:force_style='${style}'`,
    '-t', (totalMs / 1000).toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-map_metadata', '-1', '-fflags', '+bitexact', out], { cwd: dir, stdio: 'inherit' });
  writeFileSync(join(VIDEOS, it.opening, `${it.variation}.srt`), readFileSync(join(dir, 'captions.srt')));
  return { hash: it.hash, mp4: `videos/${it.key}.mp4`, srt: `videos/${it.key}.srt`, seconds: Math.round(totalMs / 100) / 10 };
}

// ---------- main ----------
const args = process.argv.slice(2), manifest = readManifest(), all = listItems();
const wanted = args.includes('--changed') ? all.filter(i => stateOf(i, manifest) !== 'fresh') : all.filter(i => args.includes(i.key));
if (!wanted.length) { console.log(args.includes('--changed') ? 'All videos are fresh.' : `Nothing to render. Narrated videos: ${all.map(i => i.key).join(', ') || 'none'}`); process.exit(0); }

const voice = ensureVoice();
const dist = join(TMP, 'dist'); mkdirSync(TMP, { recursive: true });
await build({ root: ROOT, logLevel: 'warn', build: { outDir: dist, emptyOutDir: true } });
const server = await preview({ root: ROOT, logLevel: 'warn', build: { outDir: dist }, preview: { port: 4173, strictPort: false } });
const baseUrl = server.resolvedUrls!.local[0];
const browser = await chromium.launch({ executablePath: chromePath() });
try {
  for (const it of wanted) {
    console.log(`Rendering ${it.key} ...`);
    manifest[it.key] = await renderOne(it, voice, baseUrl, browser);
    writeManifest(manifest); // after each video, so a later failure keeps the earlier ones
    console.log(`  -> ${manifest[it.key].mp4} (${manifest[it.key].seconds}s)`);
  }
} finally {
  await browser.close(); await new Promise(r => server.httpServer.close(r));
}
