# AGENTS.md — Chant League Build Rules (Codex-First)

## Non-negotiable rule
**Codex does ALL work inside the repository.**
That includes: coding, refactors, bug fixes, route fixes, tests, linting, commits, pushes, pull requests, and verifying previews.

The user should only be asked to do tasks that Codex cannot do due to permissions, secrets, or external dashboards.

---

## What Codex must do by default (no asking)
### Repo work (always)
- Implement requested features and fixes directly in the repo
- Run QA checks (below) before claiming “done”
- Commit changes with a clear message
- Push branch + open PR if required by the repo workflow (otherwise push to main if that’s the established flow)

### Quality check loop (MANDATORY)
Before finishing any task, Codex must:
1) `pnpm lint` (or `npm run lint`)
2) `pnpm typecheck` (or `npm run typecheck`) if available
3) `pnpm test` (or `npm test`) if available
4) Start dev server and verify key routes render without errors:
   - `/`
   - `/battles`
   - battle detail route (e.g. `/battles/<id-or-slug>`)
   - any club-routing paths in use
5) Confirm no console errors in the dev log related to:
   - Supabase client
   - missing env vars
   - fetch/CORS
   - route not found (404)

If a check fails, Codex fixes and repeats the loop until clean.

---

## What Codex is allowed to ask the user to do (ONLY these)
Codex may request user “takeover” only for:
- Logging into Supabase / Vercel / GitHub / any external service
- Creating or copying secrets/keys (e.g. Supabase anon key)
- Adding environment variables in external dashboards (Vercel, GitHub, Supabase)
- Enabling settings in dashboards (RLS, Data API, CORS in Supabase UI if applicable)
- Payments / billing / irreversible settings changes

**Codex must not ask the user to manually edit code** unless the user explicitly insists.

---

## Supabase integration rules
### Codex handles (in repo)
- Correct Supabase client initialization:
  - Uses `NEXT_PUBLIC_SUPABASE_URL`
  - Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Ensures env vars are referenced correctly in code
- Ensures API calls use the correct client (server vs client usage)
- Adds safe error logging and user-friendly UI states
- Adds a `/test` page or equivalent sanity check only if needed
- Removes any broken test routes once validated

### User handles (external)
- Creating the Supabase project
- Copying:
  - Project URL
  - Anon key
- Adding env vars in:
  - Vercel project env vars
  - Local `.env.local` (if asked)
- Running SQL in Supabase SQL Editor when schema changes are needed

Codex must provide the exact SQL when required.

---

## Routing / navigation rules
- No route should 404 in production for known links.
- Tabs must map to real routes (e.g. `battles` vs `battle`).
- When linking to a battle detail page, Codex must confirm the route pattern matches the data (id/slug).

---

## Deployment rules
- If production differs from local preview, Codex checks:
  - env vars exist in Vercel
  - build output logs
  - route config
  - basePath / redirects / middleware effects
- Codex must not declare success until the deployed URL confirms the fix.

---

## Consent checkpoints
Codex must stop and ask the user before:
- Changing external account settings
- Publishing anything publicly
- Enabling paid features
- Rotating keys / deleting data

---

## “One instruction at a time” user preference
When directing the user for external steps (Supabase/Vercel), Codex must:
- Give **one step only**
- Wait for confirmation
- Then give the next step
