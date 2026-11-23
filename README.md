# Todo list

A to-do list shaped like kitchen order tickets. React Router on Cloudflare Workers, data in D1, Durable Objects for rate limiting and cross-device sync.

## How it works

- **6-digit PIN** stored as a Cloudflare secret (`PIN`). One PIN for the whole site.
- **D1** stores every card (`migrations/0001_init.sql`).
- **`RateLimiter` Durable Object** limits PIN attempts and card changes.
- **`Board` Durable Object** broadcasts a signal over WebSocket so other devices refresh.

Limits:

| What is limited | Limit |
| --- | --- |
| Failed PIN attempts per IP | 5 per 15 minutes |
| Failed PIN attempts across all IPs | 100 per hour |
| Card changes per session | 120 per minute |

A session is a signed cookie valid for 30 days. Changing `PIN` or `SESSION_SECRET` signs everyone out.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Active cards (add, edit, drag to reorder, archive, delete) |
| `/archive` | Archived cards (restore, delete) |
| `/login` | PIN screen |
| `/logout` | Clears the session (POST) |
| `/cards` | Mutations for all card actions (POST only) |
| `/ws` | WebSocket to the `Board` Durable Object |

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # then set PIN and SESSION_SECRET
npm run db:migrate:local
npm run dev
```

Note: live sync over WebSocket does not work under `npm run dev` because the Vite proxy drops WebSocket upgrades. Use `npm run preview` to try it locally.

## Deploy

```bash
npx wrangler d1 create todo-list          # copy database_id into wrangler.jsonc
npx wrangler secret put PIN               # 6 digits
npx wrangler secret put SESSION_SECRET    # random, at least 16 characters (openssl rand -base64 32)
npm run db:migrate:remote
npm run deploy
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Build, then run locally on workerd |
| `npm run typecheck` | Typegen and type check |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply D1 migrations |
| `npm run deploy` | Build and deploy |
