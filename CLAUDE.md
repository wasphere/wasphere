# WaSphere — Claude Code Rules

## Project Identity
Self-hosted WhatsApp automation platform.
Two parts: **WA Server** (NestJS + Baileys, MIT) and **Dashboard** (NestJS + Next.js, MIT core / Pro closed).

## Tech Stack
- WA Server: NestJS · TypeScript · Baileys **pinned to exact `6.7.21`** (never `^` or `latest`)
- Dashboard API: NestJS · TypeScript · Prisma · PostgreSQL 16 · Redis · BullMQ
- Dashboard UI: Next.js 15 (App Router) · TailwindCSS · ShadCN UI · Framer Motion
- Monorepo: pnpm workspaces

## WORKFLOW RULE — Most Important
**Always present a plan and wait for explicit approval before creating or editing any file.**
When asked only to read or explain something — do exactly that and stop.
Never start coding on your own.

## Architecture Rule
All Baileys code must stay isolated in `packages/wa-server/src/whatsapp/baileys.adapter.ts`.
No other file may import `@whiskeysockets/baileys` directly.

## Licensing Rule (CRITICAL)
Only the WA Server binary may import Baileys. Closed-source Pro code must **never**
import Baileys or the binary's internals — HTTP API calls only.
Reason: Baileys depends on `libsignal` (GPLv3). See PRD Section 4.3.

## Testing Rule
No mock tests for WhatsApp behaviour. All tests run against a real PostgreSQL (Docker)
and a real test WhatsApp number. Real data only.

## Security Rules
- Secrets via environment variables only — never hardcoded.
- WA Server token accepted via `X-Api-Token` header only — never query string.
- `sessions/` contains account credentials — gitignored, must never be committed.

## Git Rules
- Never commit directly to `main`.
- Every feature lives on a branch named `feature/<short-name>`, created from `main` before any work begins.
- **Every agent that edits files must commit its changes before handing off to the next agent. The next agent always starts from committed code.**
- PRs are opened at the end of the pipeline; merged to `main` by Waqas only.
- **Every PR description AND every squash commit message MUST include `Closes #N` (or `Fixes #N`) for every GitHub issue resolved.** GitHub only auto-closes issues from the exact keyword syntax — prose like "closes issue 1" does nothing. Without this, the issues list silently drifts out of sync with merged code. Example: `Closes #3, Closes #5` in the PR body or commit message.
- **Before any commit, verify git config:** `git config user.name` must be `Waqas Ahmed Waseer` and `git config user.email` must be `waqasahmadwaseer@gmail.com`. Fix before committing — wrong attribution cannot be cleanly corrected after force-push to a shared branch.
- **Never use Co-Authored-By trailers.** Commits use the repository git user only — no AI/Claude attribution lines.
- **Delete feature branches from origin immediately after their PR is merged into main.** Stale merged branches clutter the repo and obscure the true state of work.

## Active Branches

| Branch | Status | Notes |
|---|---|---|
| `feature/design-system` | **PARKED** | Dashboard UI shell, login page, sidebar, header, theme. Wakes up in Phase 5 when backend is complete. **DO NOT delete. DO NOT merge until rebased onto main with real API integration.** |

## Code Style
- Small, typed, well-named functions. Comments only when the WHY is non-obvious.
- Follow the existing NestJS module structure (module / controller / service).
- Keep files under 500 lines.

---

## Feature Workflow

### Trivial change (typo, tiny config fix)
Branch from main → fix → commit → PR. No pipeline needed.

### Standard feature pipeline

**Waqas approves at exactly two points. Everything between those points runs automatically.**

```
[0] Create branch feature/<short-name> from main

[1] architect
    └─ writes docs/designs/<feature>.md, STOPS
         ↓
    ★ WAQAS APPROVAL #1 — approve design before implementation starts

[2] backend-engineer / frontend-engineer / db-migration
    └─ implement → commit → hand off to qa-tester automatically
         ↓
[3] qa-tester ←──────────────────────────────────────────────────────────────┐
    ├─ FAIL → routes defect to responsible agent                             │
    │         (backend-engineer / frontend-engineer / db-migration)          │
    │         agent fixes → commits → back to qa-tester (automatic)         │
    │         if same defect unresolved after 3 attempts:                    │
    │         STOP — report to Waqas ─────────────────────────────────────── ┘
    └─ PASS → hands off to security-auditor automatically
         ↓
[4] security-auditor ←───────────────────────────────────────────────────────┐
    ├─ CRITICAL/HIGH found → routes to responsible agent                     │
    │  agent fixes → commits → qa-tester re-tests → security-auditor again  │
    │  if same finding unresolved after 3 attempts:                          │
    │  STOP — report to Waqas ────────────────────────────────────────────── ┘
    └─ PASS → STOPS, reports
         ↓
    ★ WAQAS APPROVAL #2 — review security report, open PR, merge to main
```

**No agent ever merges to main. Waqas does the final merge.**

### Invoke agents

| Stage | Command |
|---|---|
| Design | `/agent:architect` |
| Backend | `/agent:backend-engineer` |
| Frontend | `/agent:frontend-engineer` |
| Database | `/agent:db-migration` |
| QA | `/agent:qa-tester` |
| Security | `/agent:security-auditor` |
