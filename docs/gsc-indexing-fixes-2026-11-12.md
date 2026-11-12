# GSC indexing fixes, 12 Nov 2026 (wasphere/wasphere app repo)

Scope: this repo is the self-hosted product (dashboard UI, API, WA server). It
does not serve `wasphere.com` marketing pages, `/docs/...`, `/blog/...` or
`sitemap.xml` (those are in wasphere/website, PR wasphere/website#2). Only the
brief items that touch what this repo serves were done.

Base branch: `main`.

## Code changes

### Item 4: noindex the live demo (`demo.wasphere.com`)

- `packages/dashboard-ui/middleware.ts`: when `DEMO_MODE=true`, every response
  carries `X-Robots-Tag: noindex, follow`, including the `/` to
  `/dashboard/overview` redirect. A header (instead of a meta tag) also covers
  non-HTML documents, so `/favicon.ico` is included (added to the matcher).
- `packages/dashboard-ui/app/robots.ts` (new): serves `/robots.txt` with
  `Disallow: /api/`.

URLs affected: `https://demo.wasphere.com/dashboard/overview`,
`https://demo.wasphere.com/favicon.ico?favicon.…` and all other demo routes.

Deliberate deviation from the brief: page routes are NOT disallowed in
robots.txt. Google can only see `noindex` on a URL it is allowed to fetch, so
disallowing `/dashboard` would leave already-known URLs indexed and un-removable.
Only `/api/` is blocked. Once the demo URLs drop out of the index, a
`Disallow: /` could be added if wanted.

Only active on the demo deployment. Normal self-hosted installs are unchanged
apart from the `/robots.txt` file.

## Not applicable to this repo

- Items 1, 2, 3, 6 (www redirect, sitemap, `/demo/` landing page, hash URLs):
  served by the marketing site, not this repo.
- Item 5: `/messages`, `/sessions`, `/health`, `/chatwoot`, `/opt/`, `/proc/`
  are not marketing pages; the robots.txt for `wasphere.com` lives in
  wasphere/website. `/opt/wasphere-backup/backup.sh` is not served by anything
  in this repo (no static route, `public/` has no such file).

## Manual steps for Waqas

- Add the www to apex 301 as a Cloudflare Redirect Rule (see `CANONICAL_HOST.md`).
  It cannot be done in code here.
- Confirm on the marketing origin (LiteSpeed) that
  `https://wasphere.com/opt/wasphere-backup/backup.sh` is a 404 and that the
  directory is not web-reachable; this repo cannot verify that.
- After deploying wasphere/website, resubmit `https://wasphere.com/sitemap.xml`
  in the GSC UI.
- After deploying this change, check `curl -I https://demo.wasphere.com/dashboard/overview`
  shows `x-robots-tag: noindex, follow`.

## Verification

`pnpm --dir packages/dashboard-ui build` passes (Next.js 16.2.6); `/robots.txt`
appears as a dynamic route. Header behaviour was not exercised against a running
server.
