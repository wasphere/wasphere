# Security Policy

## Supported versions

| Version | Supported |
| ------- | :-------: |
| 1.0.x   |    ✅     |

WaSphere is under active development; security fixes land on the latest release.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through GitHub's [Private Vulnerability Reporting](https://github.com/wasphere/wasphere/security/advisories/new) — click **"Report a vulnerability"** on the repository's **Security** tab. This keeps the details confidential until a fix is released.

We aim to:

- Acknowledge your report within **72 hours**
- Provide an initial assessment within **7 days**
- Credit you in the published advisory (unless you'd rather stay anonymous)

## Self-hosting hardening notes

WaSphere runs on **your** infrastructure, so deployment security is shared:

- Generate every secret separately with `openssl rand -hex 32` — never reuse a value across settings.
- The `sessions/` directory holds raw WhatsApp credentials. It is gitignored — **never commit it**, and back it up encrypted.
- The WA Server token is accepted via the `X-Api-Token` header **only** — never in a query string.
- Terminate TLS at your own reverse proxy in production.
- API keys are Argon2id-hashed and shown once; the stored WA Server token is encrypted at rest (AES-256-GCM); webhooks are HMAC-signed and SSRF-guarded.

Thank you for helping keep WaSphere and its users safe. 🙏
