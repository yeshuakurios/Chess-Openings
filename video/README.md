# Companion videos

One vertical 1080x1920 MP4 + `.srt` per narrated variation, built from `content/*.json` only. No paid services, no LLM at build time: the narration is committed text, the voice is Piper (local, noise terms fixed at 0 so the same text gives the same audio), the picture is the app's own `?autoplay=` page recorded by Playwright, ffmpeg burns the captions.

## Render one video locally

```
npm ci
pip install piper-tts                      # plus ffmpeg and fonts-dejavu on PATH / installed
npx playwright install chromium            # skip if a Chromium exists (set CHROMIUM_PATH)
npm run video -- modern-defence/e4-classical
```
Output: `videos/modern-defence/e4-classical.mp4`, `.srt`, and its entry in `videos/manifest.json`. The Piper voice (~60 MB) downloads once into `video/.cache/`.

- `npm run video -- --changed` renders every stale or missing video.
- `npm run video:status` lists fresh / stale / not built.
- Preview the animation without audio: `npm run dev`, open `/?autoplay=modern-defence/e4-classical`.

## Add a video
Add `narration` to a variation (the strategy intro), to each of its moves, and once to the opening's `goal` (the intro). Write moves in words ("bishop to g7"); `npm run validate` rejects notation. Narration is teaching text: why the move, the common mistake, the plan. Then `npm run video -- <opening>/<variation>`.

## Staleness
`manifest.json` stores a hash per video of everything it shows or says (moves, notes, evals, shapes, narration, voice, and the video code in `src/segments.ts`, `src/autoplay.ts`, `video/lib.ts`, `video/render.ts`). `.github/workflows/videos.yml` runs on push to main, flags stale videos in the run summary, re-renders only those, and uploads `videos/` as an artifact. Commit the artifact's files to clear the flags.
