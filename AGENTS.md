# Agent Guidelines for chant-platform

This repository is managed by an automated assistant ("Codex"). To maintain consistency and efficiency, the following rules govern all interactions and tasks.

## 1. Codex-First Rule
- Codex is responsible for all repository work: writing, editing, refactoring, testing, linting, and generating commits and pull requests.
- The user should **only** be asked to perform actions that require external access, credentials, or the Supabase/hosting dashboards (e.g. adding environment variables, making a Supabase schema change, or approving a billing plan).

## 2. QA Loop Requirement
- Before declaring a task complete, Codex must run through a quality‑assurance loop:
  1. Ensure the code builds (lint, typecheck).
  2. Execute tests and confirm they pass.
  3. Manually verify any new or changed routes in development mode to avoid runtime 404s.
  4. Validate that the project behaves as expected locally before concluding.
- The user should not be told a task is done until this loop is satisfied or a blocker is identified.

## 3. Local Operations Codex Must Perform
- Linting (`npm run lint` or equivalent).
- Type checking (`tsc --noEmit` or built‑in Next check).
- Running the test suite (`npm test` or `npm run smoke`).
- Visiting new/affected development routes (e.g. `http://localhost:3000/whatever`) to confirm they render without 404s or JavaScript errors.

## 4. Deployment Rules
- Any change that should be deployed requires a commit and push.
- If the change is non‑trivial or user-facing, Codex should create a pull request with a descriptive title and summary.
- The user or a maintainer should merge the PR; Codex should not self-merge.

## 5. Supabase Checklist
**Codex Actions:**
- Create or update connection code (`lib/supabase.ts`).
- Write queries and helpers in the application code.
- Prepare migration files or SQL if necessary (but not execute them on Supabase itself).
- Document required environment variables and when they need to be set.

**User Responsibilities:**
- Provide Supabase project URL and anon key via environment variables or dashboard.
- Make schema changes through the Supabase UI/CLI and share details if Codex needs to adapt code.
- Grant access or share secrets only when absolutely needed.

## 6. Routing Checks
- Verify that all new or modified routes return a 200 status in development.
- Explicitly check key paths like `/battles` and individual battle detail routes (e.g., `/battle/slug`) after changes.
- Ensure there are no accidental 404s or broken links.

## 7. Stop Conditions & Consent Checkpoints
- Codex stops and asks the user only when it reaches a step that requires external access or human decision:
  - Adding environment variables.
  - Changing a third‑party service configuration.
  - Deploying to production or altering billing settings.
  - When unsure about user intent or scope of a requested feature.

By following these guidelines, the repository workflow remains predictable, automated, and efficient while respecting the boundary between code management and external systems.