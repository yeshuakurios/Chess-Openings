// Small feedback effects: haptics, a floating "+XP", the combo chip, a board glow, toasts and confetti.
// Everything here is overlaid with position absolute/fixed and pointer-events none, so nothing moves the board
// (Chessground caches its tap positions). Motion is skipped under prefers-reduced-motion.

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Haptic pulse where the browser supports it (Android Chrome; iOS Safari ignores it). */
export function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
export const HAPTIC = { right: 8, wrong: [12, 60, 12], mark: [10, 40, 10, 40, 24], win: [16, 50, 16, 50, 40] };

const restart = (el: HTMLElement, cls: string) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

/** "+2" rising over the board after a correct move. */
export function floatXp(n: number) {
  const wrap = document.querySelector<HTMLElement>('.board-wrap');
  if (!wrap || n <= 0 || reduced()) return;
  const el = document.createElement('span');
  el.className = 'xpfloat'; el.textContent = `+${n}`; el.setAttribute('aria-hidden', 'true');
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/** The combo chip in the header: hidden below 2, bumps on every gain, glows at a milestone. */
export function showCombo(n: number, mark = false) {
  const el = document.getElementById('combo');
  if (!el) return;
  el.hidden = n < 2;
  if (n < 2) return;
  el.textContent = `×${n}`;
  el.classList.toggle('hot', n >= 5);
  if (!reduced()) restart(el, mark ? 'mark' : 'bump');
}

/** A short glow around the board when a line is finished cleanly. */
export function glowBoard() {
  const wrap = document.querySelector<HTMLElement>('.board-wrap');
  if (wrap && !reduced()) restart(wrap, 'win');
}

/** A message floating above the page for a few seconds; it never takes layout space. */
export function toast(html: string, ms = 3200) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.innerHTML = html;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** A light confetti burst over the whole screen, for milestones only. */
export function confetti(count = 36) {
  if (reduced()) return;
  const box = document.createElement('div');
  box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const colors = ['#ff9f43', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585'];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    s.style.left = `${Math.random() * 100}%`;
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = `${Math.random() * 0.35}s`;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
    s.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2200);
}
