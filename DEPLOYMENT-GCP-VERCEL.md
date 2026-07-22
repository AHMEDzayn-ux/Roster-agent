# Deploying CallRoster Pro — GCP (backend) + Supabase (DB) + Vercel (frontend)

Backend → **Cloud Run**, database → **Supabase (managed Postgres, free tier)**,
the auto-lock schedule → **Cloud Run Job + Cloud Scheduler**, frontend →
**Vercel**.

**Cost: ~$0 for a demo.** Cloud Run scales to zero, Supabase and Vercel both
have free tiers, and there's no Cloud SQL bill. None of this has been run for
you — you run the commands under **your own** GCP/Supabase/Vercel accounts
(I have no accounts and provision nothing). Delete the resources when done.

Prereqs: install the [gcloud CLI](https://cloud.google.com/sdk/docs/install),
then `gcloud auth login`. A GitHub account (for Vercel) and a Supabase account.

---

## 0. Create the Supabase database

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick a region
   near your GCP region (below we use GCP `us-central1`, so a US Supabase region).
2. Set a strong database password when prompted (save it).
3. Project → **Connect** → **Connection string** → **Session** mode (port 5432).
   You'll get something like:
   `postgresql://postgres.abcdefgh:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
4. This app uses SQLAlchemy with the `psycopg2` driver, so change the scheme to
   `postgresql+psycopg2://` and keep the rest. Save it as your `DATABASE_URL`.

> Use the **Session** pooler (5432), not the Transaction pooler (6543) —
> migrations and long-lived connections need session mode.

## 1. Set shell variables (reuse below)

```bash
export PROJECT_ID="callroster-demo-$RANDOM"   # must be globally unique
export REGION="us-central1"
export DATABASE_URL="postgresql+psycopg2://postgres.abcdefgh:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
export JWT_SECRET="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
echo "JWT_SECRET=$JWT_SECRET"     # save this
```

## 2. Create the GCP project + enable billing & APIs

```bash
gcloud projects create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Link billing (required even though usage stays in the free tier):
gcloud billing accounts list
export BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX"   # paste an ACCOUNT_ID from above
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com
```

## 3. Deploy the backend to Cloud Run (build from source)

Run from the repo root. `--source backend` makes Cloud Build build
`backend/Dockerfile` and deploy it. The entrypoint runs `alembic upgrade head`
on start, then gunicorn on `$PORT` (Cloud Run sets `PORT=8080` — the entrypoint
already honours it). No Cloud SQL flags — the DB is on Supabase, reached over a
normal host URL.

```bash
gcloud run deploy callroster-api \
  --source backend \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=$DATABASE_URL,JWT_SECRET_KEY=$JWT_SECRET,JWT_ALGORITHM=HS256,JWT_EXPIRE_MINUTES=480" \
  --min-instances 0 \
  --max-instances 1

# Public URL:
export API_URL="$(gcloud run services describe callroster-api --region "$REGION" --format='value(status.url)')"
echo "$API_URL"        # e.g. https://callroster-api-xxxx.a.run.app
```

`--max-instances 1` keeps it simple (avoids two instances racing on the
startup migration) and `--min-instances 0` keeps cost at zero — the first
request after idle has a few-second cold start, which you've said is fine.
CORS is set in step 7 once you know the Vercel domain.

## 4. Seed the first manager account (one-off Cloud Run Job)

No self-registration endpoint by design; create the first manager with a
one-off job reusing the deployed image:

```bash
export IMAGE="$(gcloud run services describe callroster-api --region "$REGION" --format='value(spec.template.spec.containers[0].image)')"

gcloud run jobs create seed-admin \
  --image "$IMAGE" \
  --region "$REGION" \
  --set-env-vars "DATABASE_URL=$DATABASE_URL,JWT_SECRET_KEY=$JWT_SECRET" \
  --command python \
  --args scripts/seed_admin.py,you@example.com,ChangeThisPassword123

gcloud run jobs execute seed-admin --region "$REGION" --wait
```

## 5. Auto-lock schedule (Cloud Run Job + Cloud Scheduler, every 5 min)

The Saturday-midnight lock must run outside the web process:

```bash
gcloud run jobs create auto-lock \
  --image "$IMAGE" \
  --region "$REGION" \
  --set-env-vars "DATABASE_URL=$DATABASE_URL,JWT_SECRET_KEY=$JWT_SECRET" \
  --command python \
  --args scripts/auto_lock_cycles.py

export PROJECT_NUM="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud scheduler jobs create http auto-lock-trigger \
  --location "$REGION" \
  --schedule "*/5 * * * *" \
  --uri "https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/auto-lock:run" \
  --http-method POST \
  --oauth-service-account-email "$PROJECT_NUM-compute@developer.gserviceaccount.com"
```

Same pattern applies to `auto_publish_cycles.py` and `ensure_weekly_cycles.py`
if you want them scheduled — duplicate the job + scheduler with new names and
the right cron.

---

## 6. Frontend on Vercel

The Vite bundle bakes `VITE_API_BASE_URL` in **at build time**. A `vercel.json`
(Vite preset + SPA rewrite) is already committed in `frontend/`.

1. Push this repo to GitHub.
2. Vercel → **New Project** → import the repo.
3. **Root Directory = `frontend`** (important — the app isn't at repo root).
4. Env var: `VITE_API_BASE_URL` = `<API_URL>/api`
   (e.g. `https://callroster-api-xxxx.a.run.app/api`).
5. Deploy. Note the domain, e.g. `https://callroster.vercel.app`.

## 7. Point the backend's CORS at the Vercel domain

```bash
export FRONTEND_URL="https://callroster.vercel.app"   # your real Vercel domain
gcloud run services update callroster-api \
  --region "$REGION" \
  --update-env-vars "CORS_ALLOWED_ORIGINS=$FRONTEND_URL"
```

Add any custom domain to this comma-separated list and re-run. Whenever you
change `VITE_API_BASE_URL`, redeploy the Vercel project (build-time bake).

---

## Verify

- `curl $API_URL/api/health` — backend up, DB reachable.
- Open the Vercel URL, log in with the seeded manager account.
- `gcloud scheduler jobs list --location "$REGION"` — schedule registered.

## Tear down

```bash
gcloud projects delete "$PROJECT_ID"   # removes Cloud Run + Scheduler
```

Then delete the Supabase project and the Vercel project from their dashboards.
