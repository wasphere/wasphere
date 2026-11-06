# Canonical host for wasphere.com

The public marketing site (`https://wasphere.com`) is not served by this
repository. This repo is the self-hosted product (dashboard UI, dashboard API,
WA server). Dokploy runs it with the Traefik labels in
`docker-compose.prod.yml` and `docker-compose.demo.yml`, which match only:

- `Host(${DASHBOARD_UI_DOMAIN})` → dashboard UI
- `Host(${DASHBOARD_API_DOMAIN})` → dashboard API
- `Host(${WA_SERVER_DOMAIN})` and `/api/meta/webhook` → WA server
- `Host(demo.wasphere.com)` → the demo UI

Checked 26 October 2026: `https://wasphere.com` and `https://www.wasphere.com`
both return `200` from LiteSpeed (`x-turbo-charged-by: LiteSpeed`) behind
Cloudflare. DNS for both names is Cloudflare-proxied. HTTP already 301s to
HTTPS on the same host and keeps the path and query, for example
`http://www.wasphere.com/pricing/?plan=shopify` →
`https://www.wasphere.com/pricing/?plan=shopify`. A trailing-slash redirect
also stays on `www`. Nothing in this repo can emit the missing host redirect.

Do not add a redirect to `wasphere.com` in the Next.js app or in the shipped
Traefik labels. Anyone who deploys this stack on their own domain would then
send their `www` host to WaSphere's site.

## Redirect to apply

Use a Cloudflare Redirect Rule on the wasphere.com zone so it runs before
LiteSpeed. `http.request.uri` is the path plus the query string.

- Match: `(http.host eq "www.wasphere.com")`
- Then: Dynamic, `301`
- Expression: `concat("https://wasphere.com", http.request.uri)`

`https://www.wasphere.com/pricing/?plan=shopify` must land on
`https://wasphere.com/pricing/?plan=shopify`, not on the homepage.

If the zone cannot use a Redirect Rule, put this on the marketing vhost
instead (LiteSpeed / Apache):

```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} ^www\.wasphere\.com$ [NC]
RewriteRule ^ https://wasphere.com%{REQUEST_URI} [R=301,L]
```

`REQUEST_URI` includes the path and query. Do not add a second rule that
strips them.

Only if the marketing origin is later moved onto this Dokploy Traefik
instance, add a router for `www.wasphere.com` that does nothing except
redirect. Do not attach it to the dashboard, API, or demo routers.
RedirectRegex matches the request URL, and in a Compose label every `$` has
to be written `$$`:

```yaml
- traefik.http.routers.wasphere-www.rule=Host(`www.wasphere.com`)
- traefik.http.routers.wasphere-www.entrypoints=websecure
- traefik.http.routers.wasphere-www.tls.certresolver=letsencrypt
- traefik.http.routers.wasphere-www.middlewares=wasphere-www
- traefik.http.routers.wasphere-www.service=wasphere-www
- traefik.http.middlewares.wasphere-www.redirectregex.regex=^https://www\.wasphere\.com(.*)
- traefik.http.middlewares.wasphere-www.redirectregex.replacement=https://wasphere.com$${1}
- traefik.http.middlewares.wasphere-www.redirectregex.permanent=true
- traefik.http.services.wasphere-www.loadbalancer.server.port=80
```

After any Traefik cutover, request
`https://www.wasphere.com/pricing/?plan=shopify` and confirm the `Location`
is `https://wasphere.com/pricing/?plan=shopify`. If the query is missing, the
regex matched a URL that did not include it; capture the query as well
before shipping the rule.

After the 301 is live, resubmit `https://wasphere.com/sitemap.xml` in
Search Console. Google's last read of that sitemap (19 July 2026) still
showed 32 URLs; the live file has 46.
