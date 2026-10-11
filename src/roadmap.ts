/** The roadmap shown on the Roadmap screen. Keep it in step with the status table in docs/HANDOFF.md. */
export interface Phase { id: string; title: string; built: boolean; what: string; left: string[] }

export const ROADMAP_UPDATED = '2026-10-11';

export const PHASES: Phase[] = [
  { id: '0', title: 'Foundations', built: true,
    what: 'A log of every attempt, a request to keep your data on the device, JSON export and import, and automatic checks on every change.',
    left: ['Try the attempt log on a real device and check it through Export.'] },
  { id: '1', title: 'Visual goals and plain language', built: true,
    what: 'Goals and strategies are written in plain language with arrows and rings drawn on the board.',
    left: ['A human review of the draft text. Nothing is marked reviewed yet.'] },
  { id: '2', title: 'Content coverage', built: true,
    what: 'Bird has 13 lines, Budapest 8, Portuguese Gambit 9 and the Modern Defence (Black, rare) 9, each checked with Stockfish. Real Lichess numbers now show how common each move is.',
    left: ['Add lines for the next gaps: Budapest 1.d4 Nf6 2.Nc3 (13.5%) and 2.e3 (11.2%), Portuguese 2.e5 Bf5 3.d4 (11.7%) and 2.Nf3 (6.2%).', 'All lines are still draft until a human reviews them.'] },
  { id: '3', title: 'Mastery levels', built: true,
    what: 'Each line is Learning, Familiar, Solid or Mastered, based on clean recalls on separate days and how long you hold the line in memory.',
    left: ['The "why" question that Mastered should require.', 'Scheduling per position instead of per line.', 'The level thresholds are placeholders to tune with real use.'] },
  { id: '4', title: 'Mistakes tracker', built: true,
    what: 'The Mistakes screen explains your trouble spots from verified facts. When sync is on, an AI rewords the text on the free plan and always falls back to the plain text.',
    left: ['The first real AI explanation on the live server has not been checked.', 'Compare AI models in the Cloudflare Playground.'] },
  { id: '5', title: 'Gamification', built: true,
    what: 'XP, a daily goal, streaks and badges, all computed from what you actually practise. No push reminders.',
    left: ['The XP and badge numbers are placeholders.'] },
  { id: '6', title: 'Polish', built: true,
    what: 'Drill sessions stop at 10 lines, a bar offers new versions instead of reloading under you, and the app respects reduced motion.',
    left: ['See the "new version" bar after the next deploy.', 'Lichess puzzles for each opening are optional and not built.'] },
  { id: 'L', title: 'Lichess stats', built: true,
    what: 'Every move carries counts from real games at the 1000 rating level. Learn shows how often each move is played, and each line shows how often opponents walk into it.',
    left: ['Refresh the numbers by running the Lichess stats workflow from the repo\'s Actions tab.'] }
];

export const OPEN_ITEMS = [
  'Test the app end to end on a real iPhone.',
  'Find out why Cloudflare builds fail on branches other than main (the log is in the Cloudflare dashboard).',
  'Have a human review the draft content.',
  'Two Portuguese lines expect different Black moves at the same position (after 3.d4 Bg4 4.Nf3: Nxd5 in one, Bxf3 in the other), but the app accepts one move per position. One of them needs to change.'
];
