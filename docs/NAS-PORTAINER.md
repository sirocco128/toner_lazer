# NAS Portainer + Cloudflare — smartgift.next-dev.net

Deploy the full Terabis stack on the NAS at `192.168.1.30` and publish `https://smartgift.next-dev.net` through a Cloudflare Tunnel.

Related: [STAGING-DEPLOY.md](./STAGING-DEPLOY.md) · [GIT-REMOTES.md](./GIT-REMOTES.md)

## What runs

| Service | LAN | Notes |
| --- | --- | --- |
| Next.js `web` | http://192.168.1.30:33100 | Public via Cloudflare |
| Strapi `cms` | http://192.168.1.30:33137/admin | LAN (optional extra hostname) |
| MinIO console | http://192.168.1.30:33921 | LAN only |
| MinIO API | http://192.168.1.30:33920 | LAN only |
| Postgres | internal | not published |
| Gitea (existing) | :3000 | do not bind the web container to 3000 |

`CMS_MODE=mock` and `NEXT_PUBLIC_ALLOW_INDEXING=false` until legal/content gates pass.

## Gitea

```
http://192.168.1.30:3000/tong/mcp-alibaba.git
https://git.next-dev.net/tong/mcp-alibaba
```

Push `main` (or the current branch), then point Portainer at that repo.

## Portainer stack

1. Open Portainer on the NAS (`https://192.168.1.30:9443` or `:9000`).
2. Stacks → Add stack → **Repository**.
3. Repository URL: `http://192.168.1.30:3000/tong/mcp-alibaba.git`
4. Compose path: `docker-compose.portainer.yml`
5. Authenticate as Gitea user `tong`.
6. Paste env from `.env.portainer.example` into the stack environment (never commit a filled `.env.portainer`).
7. Deploy. Images build on the NAS from the Dockerfiles in the repo.

Health:

```bash
curl -fsS http://192.168.1.30:33100/api/health
curl -fsS "http://192.168.1.30:33100/api/health?deep=1"
```

## Cloudflare Tunnel

`next-dev.net` is already on Cloudflare (`git.next-dev.net`). Add a public hostname on the existing tunnel, or run `cloudflared` in this stack:

1. Zero Trust → Networks → Tunnels → create (or reuse) a tunnel.
2. Public hostname: `smartgift.next-dev.net` → `http://web:3000` (or `http://192.168.1.30:33100` if the tunnel is not on the compose network).
3. SSL/TLS: **Full**.
4. Copy the tunnel token into Portainer env `TUNNEL_TOKEN`.
5. Enable compose profile `tunnel` so the `cloudflared` service starts.

Optional: `cms.smartgift.next-dev.net` → `http://cms:1337` (restrict in Cloudflare Access).

Do not open NAS ports 80/443 to the internet.

## Local check of the compose file

```bash
docker compose -f docker-compose.portainer.yml config
```
