# Deploy to Cloudflare (hosting + D1 progress sync)
One Worker serves the built app (`dist/`) and the `/api/progress` endpoint. Free plan, no card needed (limits: 100k Worker requests/day, D1 5 GB, 100k writes/day).

1. `npx wrangler login`
2. `npx wrangler d1 create chess-openings`, then paste the printed `database_id` into `wrangler.toml`.
3. `npx wrangler d1 execute chess-openings --remote --file worker/schema.sql`
4. `npm run build && npx wrangler deploy`
5. `npx wrangler secret put SYNC_TOKEN` and enter a long random string (this is your single-user password).
6. Open the deployed URL on each device, tap **Set up sync** on the home screen, paste the same token.

Auto-deploy from GitHub: Cloudflare dashboard → Workers & Pages → Create → Import a repository. Build command `npm run build`, deploy command `npx wrangler deploy`. Add `SYNC_TOKEN` as a secret under the Worker's settings.

Local test: put `SYNC_TOKEN=anything` in `.dev.vars`, run `npx wrangler d1 execute chess-openings --local --file worker/schema.sql`, `npm run build`, `npx wrangler dev`.

How sync behaves: the app keeps working offline from IndexedDB. With a token set, it pulls the server copy on launch, merges (learned lines are unioned; per line, the most recently reviewed card wins; best combo is the max), and pushes the result a few seconds after each change. A wrong token clears itself and shows a message.
