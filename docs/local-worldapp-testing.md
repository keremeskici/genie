# Local World App Testing

How to run Genie locally and test the full World Mini App flow on your phone.

Genie is now a **single Next.js app** (`apps/web`) that serves both the UI and all `/api/...`
routes from the same origin. There is no separate backend service and no API proxy — so local
testing only needs **one dev server and one tunnel**.

## Why a tunnel is needed

Inside the World App webview on your phone, `localhost` means the phone, not your laptop. To open
the Mini App from World App you expose your local dev server over a public HTTPS tunnel.

```txt
World App on phone
  -> public HTTPS tunnel (ngrok)
  -> local Next app on localhost:3000  (UI + /api/* route handlers, same origin)
  -> Supabase / OpenAI / World Chain
```

## Run it

```bash
# from the repo root
pnpm install
pnpm --filter @worldcoin/next-15-template dev   # or: cd apps/web && pnpm dev
```

The app listens on `http://localhost:3000`. Expose only that:

```bash
ngrok http 3000
# -> https://abc123.ngrok-free.app
```

Use the ngrok HTTPS URL as the Mini App URL in the World Developer Portal. `next.config.ts`
already allows ngrok origins:

```ts
allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io', 'localhost']
```

## Local env (`apps/web/.env.local`)

All env lives in one place now. There is **no** `NEXT_PUBLIC_API_URL` / `BACKEND_API_URL` —
the API is same-origin. Copy `.env.example` and fill in:

```txt
DATABASE_URL=...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
WORLD_APP_ID=...
WORLD_ACTION=...
WORLD_CHAIN_RPC_URL=...
WORLD_CHAIN_TESTNET=true
RELAYER_PRIVATE_KEY=...          # the agent key that moves vault funds
GENIE_VAULT_ADDRESS=...          # deployed custodial GenieVault
YIELD_VAULT_ADDRESS=...          # RE7 ERC-4626 yield vault
AUTH_SECRET=...
HMAC_SECRET_KEY=...
NEXTAUTH_URL=https://abc123.ngrok-free.app   # set to your tunnel URL
NEXT_PUBLIC_APP_ID=...
NEXT_PUBLIC_WORLD_CHAIN_RPC_URL=...
NEXT_PUBLIC_USDC_ADDRESS=...
NEXT_PUBLIC_GENIE_VAULT_ADDRESS=...
```

Restart the dev server after changing env vars.

If chain execution isn't what you're testing, you can still exercise chat, auth, DB lookups, and
model/tool selection without a deployed vault (vault calls will simply error and log).

## Portal checklist

1. `cd apps/web && pnpm dev` (port 3000).
2. `ngrok http 3000`.
3. Set `NEXTAUTH_URL` in `apps/web/.env.local` to the ngrok HTTPS URL; restart dev.
4. Set the Mini App URL in the World Developer Portal to the same ngrok HTTPS URL.
5. Open the app from World App and reproduce the issue.

## Logs

Everything runs in the single Next.js dev process — watch that one terminal. Useful prefixes:

```txt
[route:chat]  [agent]       [route:send]   [route:confirm]
[route:verify] [route:users] [users]       [tool:send_usdc]
```

Verify the API responds (same origin):

```bash
curl -i http://localhost:3000/api/version
curl -i https://abc123.ngrok-free.app/api/version   # through the tunnel
```

## Browser-only testing

For plain UI work (no MiniKit/World App flows) you can skip ngrok and just open
`http://localhost:3000`. MiniKit-dependent flows (wallet auth, vault funding) won't behave like
they do inside World App.

## Common issues

- **World App opens an old URL** — update the Mini App URL in the World Developer Portal whenever
  ngrok gives you a new tunnel (or use a reserved ngrok domain).
- **Auth callback points at the wrong host** — set `NEXTAUTH_URL` to the current tunnel URL and
  restart the dev server.
- **Vault calls fail** — make sure `GENIE_VAULT_ADDRESS` / `RELAYER_PRIVATE_KEY` are set and the
  vault is deployed on the chain your RPC points at.
