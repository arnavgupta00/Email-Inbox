# Aliasr.xyz — Disposable Email Service

Disposable email service at **@aliasr.xyz** with password-protected inboxes.

## Architecture

| Component | Directory | Purpose |
|---|---|---|
| **Email Router** | `email-router/` | Cloudflare Worker — receives emails via CF Email Routing, parses, forwards to WS service |
| **WebSocket Service** | `email-router-websocket/` | Cloudflare Worker + Durable Objects — real-time email delivery, password auth, message storage |
| **Web Frontend** | `nextjs-web/` | Next.js 15 on Cloudflare Workers — inbox UI, compose, password gates |

## Environment Variables

### email-router
| Variable | Description | Default |
|---|---|---|
| `WS_BASE_URL` | WebSocket service URL | `https://aliasr-ws.aliasr.xyz` |

### email-router-websocket
| Variable | Description | Default |
|---|---|---|
| `MASTER_KEY` | Master key that can access any protected inbox (set via `wrangler secret`) | `papasmurfy3035` |

### nextjs-web
| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_WS_BASE_URL` | WebSocket service URL (client-side) | `https://aliasr-ws.aliasr.xyz` |

## Password Protection

- **Any email** can optionally have a password added via the "Protect" button in the inbox
- **Dot-suffix emails** (e.g., `name.oracia@aliasr.xyz`, `name.secret@aliasr.xyz`) automatically require password setup on first visit
- **Master key** bypasses all passwords — validated server-side only, never exposed to frontend
- Each email gets its own independent password
- Passwords are hashed with SHA-256 and stored in Durable Object storage

## Deployment

### Prerequisites
- Cloudflare account with domain `aliasr.xyz`
- Cloudflare Email Routing configured for `aliasr.xyz`
- Node.js 18+

### Deploy Email Router
```bash
cd email-router
npm install
wrangler deploy
```

### Deploy WebSocket Service
```bash
cd email-router-websocket
npm install
# Set the master key as a secret (recommended over env var):
wrangler secret put MASTER_KEY
# Then deploy:
wrangler deploy --minify
```

### Deploy Frontend
```bash
cd nextjs-web
npm install
npm run deploy
```

### Cloudflare Email Routing
Configure Email Routing in Cloudflare Dashboard:
1. Go to `aliasr.xyz` → Email → Email Routing
2. Set catch-all rule to route to the `aliasr-email-router` worker

## Local Development

```bash
# Terminal 1: WebSocket service
cd email-router-websocket && npm run dev

# Terminal 2: Frontend
cd nextjs-web && npm run dev
```

Frontend runs at `http://localhost:3000`, WebSocket service at `http://localhost:8787`.
