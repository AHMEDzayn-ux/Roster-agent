# Deploying CallRoster Pro

This covers what's needed to take the app from local dev to a DigitalOcean
deployment, per the spec's stated preference (§3). **Nothing in this file has
been executed** — it requires a DigitalOcean account/API access that this
assistant doesn't have, and provisioning billed cloud infrastructure is not
something to do without your explicit go-ahead anyway. The Dockerfiles and
compose file are written to standard patterns but have not been build-tested
in this environment (no Docker CLI is installed here) — verify with
`docker compose build` before relying on them.

## Components

- **backend/** — FastAPI + OR-Tools, containerized (`backend/Dockerfile`).
  Runs `alembic upgrade head` on container start, then serves via
  gunicorn+uvicorn workers (`backend/docker-entrypoint.sh`).
- **frontend/** — React PWA, static build served by nginx
  (`frontend/Dockerfile`). `VITE_API_BASE_URL` is baked in at *build* time
  (Vite convention), so it must be set correctly when the image is built,
  not just at container runtime.
- **Postgres** — recommend DigitalOcean **Managed Database** in production
  rather than a Postgres container, for automated backups/failover. The
  `postgres` service in `docker-compose.yml` is for local testing only.
- **Auto-lock cron** (`backend/scripts/auto_lock_cycles.py`) — must run on a
  schedule outside the web process (spec §2.2's Saturday-midnight hard
  cutoff). Deliberately not a background thread in the app itself — see the
  script's docstring for why.

## Environment variables (backend)

See `backend/.env.example`. In production, at minimum:
- `DATABASE_URL` — the DO Managed Postgres connection string
- `JWT_SECRET_KEY` — generate a real secret (`python -c "import secrets; print(secrets.token_urlsafe(48))"`), never reuse the dev one
- `CORS_ALLOWED_ORIGINS` — the deployed frontend's actual URL(s)

## Environment variables (frontend)

See `frontend/.env.example`. Set `VITE_API_BASE_URL` to the backend's public
URL (e.g. `https://api.yourdomain.com/api`) before running `npm run build` /
building the Docker image.

## Path A: DigitalOcean App Platform (simpler, recommended to start)

1. Create a DO Managed PostgreSQL database (Postgres 16). Note the connection string.
2. Push this repo to a GitHub repo DO can access.
3. Create an App Platform app with two components:
   - **backend**: source = `backend/` directory, Dockerfile build, HTTP port 8000. Set env vars from above (mark `JWT_SECRET_KEY` and `DATABASE_URL` as encrypted secrets).
   - **frontend**: source = `frontend/` directory, Dockerfile build with `VITE_API_BASE_URL` build arg set to the backend component's public URL, HTTP port 80.
4. After first deploy, run once (via `doctl apps console` or a one-off job) against the backend container:
   ```
   python scripts/seed_admin.py you@yourcompany.com <a-real-password>
   ```
   This creates the first manager account — there's no self-registration endpoint by design (spec §2.4: managers create users).
5. Set up the auto-lock schedule: DO App Platform supports **scheduled jobs** as a third component — point one at `python scripts/auto_lock_cycles.py`, run every 5 minutes.
6. Point your domain(s) at the app; set `CORS_ALLOWED_ORIGINS` on the backend to match the frontend's final domain.

## Path B: Single droplet + docker-compose

Closer to `docker-compose.yml` as-is, useful if you want more direct compute
control (per the spec's stated reasoning for preferring DO — headroom for
future ML workloads).

1. Create a droplet (Docker-ready image is available directly in DO's marketplace).
2. Still use a DO Managed Database for Postgres rather than the `postgres` service in the compose file — edit `docker-compose.yml` to remove that service and point `backend`'s `DATABASE_URL` at the managed DB instead. Running Postgres in a container on the same droplet works for a demo but loses managed backups/failover.
3. `git clone` the repo onto the droplet, set real secrets in a `.env` file (not committed), then:
   ```
   docker compose up -d --build
   ```
4. Seed the first manager account (same command as Path A, run inside the backend container: `docker compose exec backend python scripts/seed_admin.py ...`).
5. Add a cron entry on the droplet for the auto-lock script:
   ```
   */5 * * * * docker compose -f /path/to/docker-compose.yml exec -T backend python scripts/auto_lock_cycles.py
   ```
6. Put a reverse proxy (Caddy or nginx) in front of both containers for TLS/domain routing, or use DO's Load Balancer product.

## Not yet automated

- No CI/CD pipeline is set up (no GitHub Actions). App Platform can auto-deploy
  on push if you connect the repo directly; the droplet path needs a manual
  `git pull && docker compose up -d --build` (or your own CI runner).
- No infrastructure-as-code (Terraform/Pulumi) — everything above is manual
  console/CLI setup.
