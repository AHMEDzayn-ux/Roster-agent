# CallRoster Pro — Complete Testing Guide

How to verify the app end-to-end: a manual walkthrough of every feature by
role, the core roster workflow, role-based access checks, API testing, and the
110-test automated suite.

## Environments & access

| | URL |
|---|---|
| **Frontend (live)** | https://callcenter-roster.vercel.app |
| **Backend API (live)** | https://callroster-api-1065763220768.us-central1.run.app |
| **API docs (Swagger)** | https://callroster-api-1065763220768.us-central1.run.app/docs |
| **Health check** | https://callroster-api-1065763220768.us-central1.run.app/api/health |

### Demo logins (also available as one-click buttons on the login page)

| Role | Email | Password |
|---|---|---|
| Manager | `manager@callroster-demo.com` | `TempCheck123!` |
| Agent | `ravi@callroster-demo.com` | `AgentDemo123!` |

> First request after idle has a few-second cold start (Cloud Run scales to
> zero) — this is expected, not a bug.

### Seeded demo data (baseline expectations)

100 agents · 44 skills · 6 shift templates · 42 rosters · ~25,073 roster
assignments · 5 weekly cycles · 318 coverage requirements. Numbers you see
should be in this ballpark.

---

## 0. Smoke test (2 minutes — do this first)

- [ ] Open the health URL → returns `{"status":"ok"}`.
- [ ] Open `/docs` → Swagger UI loads and lists all endpoints.
- [ ] Open the frontend → the **Published Roster** page renders without login.
- [ ] Click **Manager demo** on the login page → lands on the Manager Dashboard.
- [ ] Log out, click **Agent demo** → lands on the Agent Dashboard.

If all five pass, the full stack (Vercel → Cloud Run → Supabase) is healthy.

---

## 1. Public (unauthenticated) — Published Roster

Route: `/` · No login required.

- [ ] The published roster grid renders with shifts and agent assignments.
- [ ] Only **published/locked** rosters are visible (drafts must not appear).
- [ ] The "Login" action is visible; no manager/agent-only nav is shown.

**Negative:** with the browser dev-tools network tab open, confirm the page
only calls public endpoints (`/api/roster/...` public reads), never manager
routes.

---

## 2. Agent role

Log in via **Agent demo** (`ravi@callroster-demo.com`). Nav: Dashboard ·
My Requests · My Appeals · Audit Trail.

### 2.1 Dashboard
- [ ] Shows the agent's own upcoming shifts / current cycle summary.
- [ ] No manager-only links (Configuration, Requests Inbox) appear in the nav.

### 2.2 My Requests (submit a request)
- [ ] Open **My Requests** → existing requests for this agent are listed.
- [ ] Submit a new request (e.g. an **off-day** or **leave** request) for the
      current open cycle → it appears with status **pending**.
- [ ] Request types available match the spec: off_day, leave_full, leave_half
      (first/second half), leave_multi, shift_change, overtime, other.
- [ ] **Negative:** submitting for a non-open (published/locked) cycle is
      rejected with a clear error.

### 2.3 My Appeals
- [ ] Submit an appeal → appears with status **pending**.
- [ ] Only this agent's own appeals are visible (not other agents').

### 2.4 Audit Trail
- [ ] Shows a history of actions relevant to this agent.

---

## 3. Manager role — core workflow

Log in via **Manager demo**. Nav: Dashboard · Requests · Roster · Appeals ·
Configuration · Audit Log.

### 3.1 Requests Inbox
- [ ] **Requests** lists submitted requests across agents.
- [ ] Approve one → status flips to **approved**; deny another → **denied**.
- [ ] The action is written to the **Audit Log** (verify in §3.6).

### 3.2 Roster generation (the flagship OR-Tools feature)

This is the most important thing to demo. In **Roster**:

- [ ] Select an **open** weekly cycle and click **Generate**.
- [ ] The solver (Google OR-Tools) runs and returns a **draft** roster with:
  - [ ] assignments across all agents/shifts,
  - [ ] a **conflicts** report (info/warning/critical), and
  - [ ] **satisfaction metrics** (how well agent requests were honored).
- [ ] Regenerating produces a fresh draft (the old draft is superseded).
- [ ] **Negative:** generating for a cycle that isn't open / has no coverage
      requirements returns a meaningful error, not a 500.

> Generation is CPU-heavy; on the free Cloud Run instance it may take a few
> seconds. That's expected.

### 3.3 Manual override
- [ ] Open a draft roster and manually change an assignment (override).
- [ ] The change is saved and the assignment is marked source
      **manual_override** (vs solver).
- [ ] Conflicts re-evaluate to reflect the override.

### 3.4 Publish & lock (lifecycle: draft → published → locked)
- [ ] **Publish** a draft → cycle/roster status becomes **published**; it now
      appears on the public `/` page.
- [ ] **Lock** a published roster → status **locked**; no further edits allowed.
- [ ] **Negative:** attempting to edit/override a **locked** roster is rejected.

### 3.5 Export / Import (Excel)
- [ ] **Export** a roster → downloads an `.xlsx` file that opens in Excel with
      the assignments laid out.
- [ ] **Import** an edited `.xlsx` back → changes are applied and validated;
      malformed files return a clear validation error, not a crash.

### 3.6 Appeals Inbox
- [ ] **Appeals** lists pending appeals (the sidebar badge shows the count).
- [ ] Approve/deny an appeal → status updates and is audited.

### 3.7 Audit Log
- [ ] Every manager action above (approve request, generate roster, publish,
      lock, review appeal) has a corresponding audit entry with actor,
      action type, target, and value.

---

## 4. Configuration (manager)

Under **Configuration**, verify each sub-page lists data and supports edits:

- [ ] **Skills** — 44 skills listed; create/edit works.
- [ ] **Shifts** — 6 shift templates; create/edit works.
- [ ] **Coverage** — coverage requirements per shift/day.
- [ ] **Agents** — 100 agents; view/edit, skill assignments.
- [ ] **Leave balances** — per-agent balances.
- [ ] **Weekly cycles** — 5 cycles with statuses (open/published/locked);
      create a new cycle.
- [ ] **Solver** — solver weights (the knobs the OR-Tools objective uses);
      changing a weight and regenerating changes the result.

---

## 5. Role-based access control (security)

These prove the authorization rules hold. Use the browser or `curl`.

- [ ] Logged in as **agent**, manually navigate to `/manager/config` → blocked
      / redirected (not rendered).
- [ ] Agent calling a manager-only API (e.g. `GET /api/agents`) → **403**.
- [ ] Manager calling an agent-only route (e.g. `POST /api/appeals` as manager)
      → rejected (appeals require an agent-linked account).
- [ ] No token / expired token on a protected route → **401**.
- [ ] Agent can only see **their own** requests/appeals via `/mine`, never
      others'.

### Quick curl RBAC check

```bash
API=https://callroster-api-1065763220768.us-central1.run.app

# Agent token
AT=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ravi@callroster-demo.com","password":"AgentDemo123!"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Manager-only endpoint with an agent token → expect 403
curl -s -o /dev/null -w "agent->/api/agents = %{http_code}\n" \
  $API/api/agents -H "Authorization: Bearer $AT"

# No token → expect 401
curl -s -o /dev/null -w "no-token->/api/agents = %{http_code}\n" $API/api/agents
```

---

## 6. Auto-lock schedule (background job)

Rosters lock automatically at the Saturday-midnight cutoff (spec §2.2), run by
a Cloud Scheduler → Cloud Run job every 5 minutes.

- [ ] Confirm the job runs (Google Cloud Console → Cloud Run → Jobs →
      `auto-lock` → executions show recent runs), or via CLI:

```bash
gcloud run jobs executions list --job=auto-lock --region=us-central1 \
  --project=callroster-demo-37283
```

- [ ] A cycle past its cutoff transitions to **locked** without manual action.

---

## 7. API testing via Swagger (`/docs`)

- [ ] Open `/docs`, use **POST /api/auth/login** with a demo account to get a
      token, click **Authorize**, paste `Bearer <token>`.
- [ ] Exercise the documented endpoints; each should match the schemas shown.
- [ ] Error responses use consistent shapes (see `app/api/errors.py`).

Key endpoint groups: `/api/auth`, `/api/agents`, `/api/skills`,
`/api/shift-templates`, `/api/coverage-requirements`, `/api/weekly-cycles`,
`/api/requests`, `/api/roster` (generate/publish/lock/export/import/override),
`/api/appeals`, `/api/leave-balance`, `/api/solver-config`, `/api/audit`.

---

## 8. Automated test suite (backend — 110 tests)

The repo ships **110 pytest tests** covering auth, agents, skills, shifts,
coverage, weekly cycles/requests, appeals, audit, leave balance, roster
generation, lifecycle, override, Excel import/export, and the solver model.

Run locally (needs a local Postgres and a **test** database):

```bash
cd backend
# Ensure TEST_DATABASE_URL points at a throwaway DB (see .env / .env.example)
pip install -r requirements.txt
pytest -q
```

- [ ] All 110 tests pass.
- [ ] Targeted runs work too, e.g. the solver:
      `pytest app/tests/test_roster_generation.py app/tests/test_solver_model.py -v`

> Tests use `TEST_DATABASE_URL` (a separate DB from `DATABASE_URL`) so they
> never touch demo/production data. Do **not** point `TEST_DATABASE_URL` at the
> live Supabase DB.

---

## 9. Edge cases & negative tests (regression checklist)

- [ ] Duplicate/overlapping requests for the same agent/day are handled.
- [ ] Generating a roster with insufficient staff surfaces **critical**
      conflicts rather than silently under-covering.
- [ ] Locked cycle: request submission, overrides, and re-publish are all
      blocked.
- [ ] Importing an Excel file with unknown agents/shifts is rejected with a
      validation message.
- [ ] Password with special characters logs in correctly (the demo manager's
      password contains `!`).
- [ ] CORS: the frontend origin is allowed; a random origin is not.

---

## 10. Sign-off checklist (demo-ready)

- [ ] Smoke test (§0) green.
- [ ] Full roster workflow: generate → override → publish → lock (§3.2–3.4).
- [ ] Agent and manager flows each verified (§2, §3).
- [ ] RBAC checks pass (§5).
- [ ] Auto-lock job executing on schedule (§6).
- [ ] `pytest` 110/110 passing (§8).
