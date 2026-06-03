# Contributing to WaSphere

Thank you for your interest in contributing. This document covers setup, workflow conventions, and the PR process.

---

## Setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL ≥ 14 (Docker is fine)

### Clone and install

```bash
git clone https://github.com/wasphere/wasphere.git
cd wasphere
pnpm install
```

### Configure environment

```bash
cp packages/wa-server/.env.example packages/wa-server/.env
cp packages/dashboard-api/.env.example packages/dashboard-api/.env
cp packages/dashboard-ui/.env.example packages/dashboard-ui/.env
```

Edit each `.env` file — minimum required variables are marked in the example files.

### Run database migrations

```bash
cd packages/dashboard-api
npx prisma migrate deploy
```

### Start dev servers

```bash
# From repo root — starts wa-server, dashboard-api, and dashboard-ui concurrently
pnpm dev
```

- WA Server: `http://localhost:3001`
- Dashboard API: `http://localhost:3000`
- Dashboard UI: `http://localhost:3004`

---

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| New feature | `feature/<short-name>` | `feature/bulk-send` |
| Bug fix | `fix/<short-name>` | `fix/session-status-badge` |
| Chore / infra | `chore/<short-name>` | `chore/upgrade-prisma` |
| Documentation | `docs/<short-name>` | `docs/api-auth-guide` |
| Refactor | `refactor/<short-name>` | `refactor/webhook-service` |

Always branch from `main`:

```bash
git checkout main && git pull
git checkout -b feature/your-feature
```

> ⚠️ **After any PR merges to `main`, run `git checkout main && git pull origin main` locally before branching again.** A squash-merge lands on the remote only — if your local `main` is stale, your next branch forks from an old base and silently misses the just-merged work (e.g. a new migration), which is painful to debug later.

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | New feature or behaviour |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Tooling, deps, config, no production code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |

**Examples:**

```
feat(webhooks): add per-webhook HMAC-SHA256 signing secret
fix(sessions): correct status badge colour for qr_expired state
docs(readme): add Docker quickstart section
chore(deps): upgrade Prisma to 6.x
```

Keep the subject line under 72 characters. Use the body to explain *why*, not *what*.

---

## Architecture Rules

- **Baileys isolation** — all Baileys code must stay in `packages/wa-server/src/whatsapp/baileys.adapter.ts`. No other file may import `@whiskeysockets/baileys` directly.
- **NestJS structure** — follow the existing module / controller / service pattern.
- **File size** — keep files under 500 lines.
- **No mock WhatsApp tests** — tests that verify WhatsApp behaviour must run against a real PostgreSQL database and a real test WhatsApp number.
- **Secrets in env** — never hardcode credentials. Use environment variables only.
- **WA Server token** — accepted via `X-Api-Token` header only, never query string.

---

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter dashboard-api test

# TypeScript type check
pnpm --filter dashboard-ui exec tsc --noEmit
```

---

## Pull Request Guidelines

1. **One logical change per PR** — separate bug fixes from features.
2. **Reference the issue** — every PR description must include `Closes #N` or `Fixes #N` for each resolved issue. GitHub only auto-closes on the exact keyword syntax.
3. **Screenshots for UI changes** — attach before/after screenshots or a short screen recording.
4. **TypeScript clean** — `tsc --noEmit` must pass with zero errors.
5. **No `main` merges** — PRs are merged to `main` by maintainers only after review.

### PR description template

```markdown
## Summary
- What changed and why

## Related issues
Closes #N

## Test plan
- [ ] TypeScript clean (`tsc --noEmit`)
- [ ] Tested in browser (light + dark mode)
- [ ] Edge cases covered

## Screenshots (UI changes)
<!-- before / after -->
```

---

## Security

If you discover a security vulnerability, please **do not** open a public GitHub issue. Email the maintainers privately (address in the GitHub Security tab). We aim to respond within 48 hours.
