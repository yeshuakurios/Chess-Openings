# Opening Goals

A personal opening trainer PWA. For each variation it teaches the positional goal, then the strategy, then drills the line with spaced repetition (FSRS). Works offline.

Openings so far (draft content, needs your review): Bird's Opening, Portuguese Gambit (Scandinavian 3...Bg4), Budapest Gambit.

```
npm install
npm run dev        # develop
npm run validate   # content check
npm run build      # typecheck + production build
```

Deploy: pushes to `main` publish to GitHub Pages through `.github/workflows/pages.yml` (set Settings → Pages → Source to "GitHub Actions"). For cross-device progress sync (Cloudflare Worker + D1) see `docs/deploy-cloudflare.md`; GitHub Pages alone has no sync.
