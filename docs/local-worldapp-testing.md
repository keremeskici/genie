# Local World App Testing

This guide describes how to run the frontend, backend, and World Mini App flow locally while preserving an easy switch back from Railway deployment mode.

For the Railway production setup, see:

```txt
docs/railway-deployment.md
```

## Why Local World App Testing Is Tricky

When the app runs inside the World App on your phone, browser code cannot call your laptop's `localhost`.

This does not work from a phone:

```txt
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Inside the phone webview, `localhost` means the phone, not your laptop.

The clean local setup is:

```txt
World App on phone
  -> public HTTPS tunnel
  -> local Next frontend on localhost:3000
  -> Next rewrite/proxy
  -> local API on localhost:3001
```

This requires only one public tunnel.

## Recommended Setup: One Tunnel To The Frontend

Run the backend locally but keep it private:

```bash
cd apps/api
npm run dev
```

The API should listen on:

```txt
http://localhost:3001
```

Run the frontend locally:

```bash
cd apps/web
npm run dev
```

The frontend should listen on:

```txt
http://localhost:3000
```

Expose only the frontend with a public HTTPS tunnel.

Using ngrok:

```bash
ngrok http 3000
```

Example tunnel URL:

```txt
https://abc123.ngrok-free.app
```

Use that tunnel URL as the Mini App URL in the World Developer Portal.

## Local Frontend Env

For this single-tunnel setup, set the frontend env like this:

```txt
NEXT_PUBLIC_API_URL=
BACKEND_API_URL=http://localhost:3001
NEXTAUTH_URL=https://abc123.ngrok-free.app
```

Important:

- `NEXT_PUBLIC_API_URL` should be empty for this mode.
- Browser code will call same-origin URLs like `/api/chat`.
- `BACKEND_API_URL` is server-only. Next.js rewrites same-origin backend API requests to the local Hono API.
- Restart `npm run dev` after changing env vars.

The rewrite is configured in:

```txt
apps/web/next.config.ts
```

It forwards these frontend URLs to the local API when `BACKEND_API_URL` is set:

```txt
/api/chat
/api/send
/api/confirm
/api/balance
/api/transactions
/api/verify
/api/version
/api/users/*
```

It does not rewrite the Next.js BFF/auth routes:

```txt
/api/auth/*
/api/verify-proof
/api/rp-signature
/api/initiate-payment
```

Those still run in the local Next.js app.

## Local Backend Env

The local API needs the same kind of env vars it needs in Railway:

```txt
DATABASE_URL=...
OG_COMPUTE_URL=...
OG_API_KEY=...
OG_PLANNING_MODEL=...
OG_ACTION_MODEL=...
WORLD_APP_ID=...
WORLD_ACTION=...
WORLD_CHAIN_RPC_URL=...
WORLD_CHAIN_TESTNET=true
RELAYER_PRIVATE_KEY=...
GENIE_ROUTER_ADDRESS=...
PAY_HANDLER_ADDRESS=...
```

These live in:

```txt
apps/api/.env
```

If chain execution is not what you are testing, you can still debug chat request flow, auth, DB lookup, and model/tool selection without successfully submitting a transaction.

## World Developer Portal Checklist

For real World App testing on your phone:

1. Start `apps/api` on `localhost:3001`.
2. Start `apps/web` on `localhost:3000`.
3. Start `ngrok http 3000`.
4. Set `NEXTAUTH_URL` in `apps/web/.env.local` to the ngrok HTTPS URL.
5. Set the Mini App URL in the World Developer Portal to the same ngrok HTTPS URL.
6. Restart the frontend dev server after env changes.
7. Open the app from World App and reproduce the issue.

The local `next.config.ts` already allows ngrok origins:

```ts
allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io', 'localhost']
```

## What To Watch In Logs

Keep three terminals open:

### Terminal 1: API logs

```bash
cd apps/api
npm run dev
```

Look for:

```txt
[route:chat]
[agent]
[route:send]
[route:confirm]
[route:verify]
[route:users]
```

### Terminal 2: Web logs

```bash
cd apps/web
npm run dev
```

Look for:

```txt
/api/auth
/api/verify-proof
/api/rp-signature
NEXT_PUBLIC_API_URL is missing
```

### Terminal 3: Tunnel logs

```bash
ngrok http 3000
```

This shows whether World App is actually hitting your local frontend.

## Verify The Proxy Works

From your laptop:

```bash
curl -i http://localhost:3000/api/version
```

Expected result:

- The request enters Next.js on port `3000`.
- Next rewrites it to the local API on port `3001`.
- You get the API JSON response.

From the public tunnel:

```bash
curl -i https://abc123.ngrok-free.app/api/version
```

Expected result:

- The request enters ngrok.
- ngrok forwards to local Next.js.
- Next rewrites to local API.
- You get the API JSON response.

If this works, the World App webview should also be able to reach the local backend through the frontend tunnel.

## Alternative Setup: Two Tunnels

You can expose both services:

```bash
ngrok http 3000
ngrok http 3001
```

Then set:

```txt
NEXT_PUBLIC_API_URL=https://api-tunnel.ngrok-free.app
NEXTAUTH_URL=https://web-tunnel.ngrok-free.app
```

This works, but it is easier to misconfigure:

- `NEXT_PUBLIC_API_URL` must be the API tunnel, not localhost.
- CORS must allow the frontend tunnel origin.
- Both tunnel URLs change unless you have reserved ngrok domains.

The one-tunnel proxy setup is usually easier.

## Browser-Only Local Testing

If you are not testing MiniKit or World App-specific flows, you can skip ngrok:

```txt
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Then run:

```bash
cd apps/api && npm run dev
cd apps/web && npm run dev
```

Open:

```txt
http://localhost:3000
```

This is good for normal UI work, but MiniKit-dependent flows may not behave like they do inside World App.

## Common Local Issues

### The phone cannot reach the API

Cause:

```txt
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Fix:

Use the one-tunnel setup with:

```txt
NEXT_PUBLIC_API_URL=
BACKEND_API_URL=http://localhost:3001
```

### The app still calls production Railway

Cause:

`NEXT_PUBLIC_API_URL` is still set to:

```txt
https://genie-production-1171.up.railway.app
```

Fix:

Clear `NEXT_PUBLIC_API_URL`, set `BACKEND_API_URL`, and restart the frontend dev server.

### Auth callback points at the wrong host

Cause:

`NEXTAUTH_URL` is not set to the tunnel URL.

Fix:

```txt
NEXTAUTH_URL=https://abc123.ngrok-free.app
```

Restart the frontend dev server.

### World App opens an old URL

Cause:

The World Developer Portal still points to an old tunnel URL.

Fix:

Update the Mini App URL in the World Developer Portal each time ngrok gives you a new URL, or use a reserved tunnel domain.

## Recommended Daily Workflow

1. Start the API locally.
2. Start the web app locally.
3. Start the frontend tunnel.
4. Confirm `/api/version` works through the tunnel.
5. Open the app in World App.
6. Reproduce the issue.
7. Read local API logs first for chat/tool failures.
8. Read local web logs for auth/BFF failures.
9. Fix locally.
10. Run tests.
11. Push to GitHub only after the local flow is understood.
