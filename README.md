# WaSphere

> Open-source WhatsApp automation platform — built for developers, businesses,
> and hosting providers.

WaSphere is a self-hosted WhatsApp automation platform. It exposes the full Baileys
API as a clean REST interface, with a Zender-style architecture: a standalone
**WA Server** binary runs WhatsApp sessions, and a central **Dashboard** manages
everything.

**MIT Core. Pro Power.** — the engine and dashboard (v1) are fully open source;
the Pro layer (automation builder, CRM, WHMCS, AI) ships in v2.

---

## Repository structure

```
wasphere/
├── packages/
│   └── wa-server/        WA Server binary — NestJS + Baileys (MIT)
├── docs/
│   └── PRD.md            Full Product Requirements Document (v2.1)
├── pnpm-workspace.yaml
└── package.json
```

> `dashboard-api/` and `dashboard-ui/` are added during v1.0 development —
> see `docs/PRD.md` Section 6.

---

## Quick start (WA Server)

```bash
pnpm install
cd packages/wa-server
npm run dev -- --port 3001 --token test123
```

Then create a session and scan the QR with WhatsApp:

```bash
curl -X POST http://localhost:3001/api/sessions \
  -H "X-Api-Token: test123" \
  -H "Content-Type: application/json" \
  -d '{"id": "my-phone"}'

curl http://localhost:3001/api/sessions/my-phone -H "X-Api-Token: test123"
```

---

## Where to start

Read `docs/PRD.md` — Section 12 ("Where to Start") has the day-by-day plan.
The first real task is the **Baileys adapter refactor** (PRD Section 2.2).

---

## Important notes

- **Baileys is pinned to exact `6.7.21`** — never change to `^` or `latest`.
  See PRD Section 9 for the update strategy.
- The `sessions/` folder contains WhatsApp account credentials — it is gitignored
  and must never be committed.
- WaSphere is for legitimate customer communication. Users must comply with
  WhatsApp's Business Policy. Do not spam.

## License

MIT — see PRD Section 4 for the open-core model and the Baileys/libsignal
licensing note.
