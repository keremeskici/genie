# Railway Deployment

This repo supports two web-to-API modes without code changes:

- Railway deployment mode
- local ngrok proxy mode

The switch is controlled by env vars only.

## Railway Mode

Use this when the frontend and API are deployed remotely.

### Web env

```txt
NEXT_PUBLIC_API_URL=https://your-api-service.up.railway.app
BACKEND_API_URL=
NEXTAUTH_URL=https://your-web-service.up.railway.app
```

Notes:

- browser requests go directly to the Railway API URL
- Next.js rewrites are not used in this mode
- `NEXT_PUBLIC_API_URL` must be the public API service URL, not the web URL

### API env

Set the normal API env vars in Railway, including:

```txt
DATABASE_URL=...
WORLD_APP_ID=...
WORLD_ACTION=...
WORLD_CHAIN_RPC_URL=...
RELAYER_PRIVATE_KEY=...
GENIE_ROUTER_ADDRESS=...
PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3
```

### World Developer Portal

Set the Mini App URL to the Railway web service URL.

## Local ngrok Mode

Use this when the frontend runs locally on port `3000`, the API runs locally on port `3001`, and only the frontend is exposed publicly.

### Web env

```txt
NEXT_PUBLIC_API_URL=
BACKEND_API_URL=http://localhost:3001
NEXTAUTH_URL=https://your-ngrok-url.ngrok-free.app
```

Notes:

- browser requests stay same-origin, like `/api/chat`
- Next.js rewrites proxy those requests to the local API
- this is the easiest phone-testing setup because only one tunnel is needed

### API env

Use the same API env vars as Railway, but locally in `apps/api/.env`.

## How The Web App Chooses The API Base

- if `NEXT_PUBLIC_API_URL` is set, the browser uses that public API origin
- if `NEXT_PUBLIC_API_URL` is empty, the browser uses same-origin requests
- if `BACKEND_API_URL` is set, `next.config.ts` rewrites same-origin API requests to that backend

That means:

- Railway: set `NEXT_PUBLIC_API_URL`, leave `BACKEND_API_URL` empty
- local ngrok: leave `NEXT_PUBLIC_API_URL` empty, set `BACKEND_API_URL=http://localhost:3001`

## Switching Between Modes

To switch from Railway back to local testing:

1. clear `NEXT_PUBLIC_API_URL`
2. set `BACKEND_API_URL=http://localhost:3001`
3. set `NEXTAUTH_URL` to the current ngrok frontend URL
4. restart `apps/web`

To switch from local testing to Railway:

1. set `NEXT_PUBLIC_API_URL` to the Railway API URL
2. clear `BACKEND_API_URL`
3. set `NEXTAUTH_URL` to the Railway web URL
4. restart `apps/web`
