# Deploy to Cloudflare (hosting + D1 progress sync)
One Worker serves the built app (`dist/`) and the `/api/progress` endpoint. Free plan, no card needed (limits: 100k Worker requests/day, D1 5 GB, 100k writes/day).

Already done: the D1 database `chess-openings` exists (id in `wrangler.toml`) and the schema is applied.

1. Deploy the Worker, either way:
   - Dashboard: Workers & Pages → Create → Import a repository → this repo. Build command `npm run build`, deploy command `npx wrangler deploy`.
   - Or locally: `npx wrangler login`, `npm run build`, `npx wrangler deploy`.
2. Set the secret: Worker → Settings → Variables and Secrets → add secret `SYNC_TOKEN` (a long random string; this is your single-user password). Or `npx wrangler secret put SYNC_TOKEN`.
3. Open the deployed URL on each device, tap **Set up sync** on the home screen, paste the same token.

Auto-deploy from GitHub: Cloudflare dashboard → Workers & Pages → Create → Import a repository. Build command `npm run build`, deploy command `npx wrangler deploy`. Add `SYNC_TOKEN` as a secret under the Worker's settings.

Local test: put `SYNC_TOKEN=anything` in `.dev.vars`, run `npx wrangler d1 execute chess-openings --local --file worker/schema.sql`, `npm run build`, `npx wrangler dev`.

How sync behaves: the app keeps working offline from IndexedDB. With a token set, it pulls the server copy on launch, merges (learned lines are unioned; per line, the most recently reviewed card wins; best combo is the max), and pushes the result a few seconds after each change. A wrong token clears itself and shows a message.
