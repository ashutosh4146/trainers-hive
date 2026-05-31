---
name: Trainers Hive EC2 deploy
description: Production for trainers-hive runs on a self-managed EC2 box (nginx + PM2), not Replit Deployments
---

# Trainers Hive EC2 deployment

Production is a self-managed AWS EC2 host, NOT a Replit Deployment. Changes made in the Replit workspace do NOT reach prod until manually shipped to EC2.

- Host: `ubuntu@13.234.17.80`. SSH key comes from the `EC2_SSH_KEY` secret; prod DB from `EC2_DATABASE_URL`.
- API: Express bundled by `artifacts/api-server/build.mjs` (esbuild → CJS), run under PM2 as process `api-server` on port 8080.
- Frontend: Vite build output lands in `artifacts/trainers-hive/dist/public/` (NOT repo-root `dist/`), served by nginx from `/var/www/html`.
- nginx config: `/etc/nginx/sites-available/trainershive`; `/api` proxies to `localhost:8080`. Assets are cached 1yr `immutable`, so content-hash filenames matter and users may need a hard refresh to pick up a new main bundle.

**Why these bite:** EC2 has ~900MB RAM — Vite build OOMs without `NODE_OPTIONS='--max-old-space-size=1536'`. Vite also caches aggressively; clear `artifacts/trainers-hive/node_modules/.vite` before rebuilding or the new code may not bundle.

**How to ship:** frontend → scp changed source to EC2, copy into `~/trainers-hive/...`, clear `.vite`, build with the NODE_OPTIONS flag, then `sudo rm -rf /var/www/html/assets && sudo cp -r artifacts/trainers-hive/dist/public/. /var/www/html/`. api-server → scp source, `node artifacts/api-server/build.mjs`, `pm2 restart api-server --update-env`. Schema drift must be applied to the prod DB by hand (ALTER TABLE ... IF NOT EXISTS) since there's no migration runner on prod.

**Real client IP:** Express has `trust proxy` on and reads `req.ip`; nginx must send `X-Forwarded-For` (and `X-Forwarded-Proto`) or `req.ip` falls back to `::ffff:127.0.0.1`. Already added to the `/api` block.
