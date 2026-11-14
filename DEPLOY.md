# Slowfield Stays — Production Deployment Guide

## Architecture

```
Internet → Caddy (HTTPS) → Frontend (Next.js :3000)
                          → Backend  (FastAPI :8000)
                          → Media    (local volume, Phase 2: Object Storage)

PostgreSQL :5432 (internal only)
```

Target: **Linode 4GB** (Akamai) + Object Storage (Phase 2)

---

## Prerequisites

- Linode instance with Docker + Docker Compose installed
- Domain DNS A record pointing to Linode IP
- SSH access to server

### Install Docker (Ubuntu/Debian)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Re-login for group to take effect
```

---

## Quick Start

> **The frontend is built on your machine, not on the server.**
> `docker-compose.prod.yml` uses `frontend/Dockerfile.deploy`, which copies a
> finished `.next/` rather than building from source — and `.next/` is
> gitignored. A `git clone` on the server therefore has nothing to copy and the
> build fails at `COPY .next/standalone`. Ship the bundle instead.

> **`npm run dev` destroys the build output.** Starting the dev server rewrites
> `.next/` and removes `.next/standalone` — the very directory `Dockerfile.deploy`
> copies. Observed directly: an image that built fine failed at
> `COPY .next/standalone ./` with `"/.next/standalone": not found` after nothing
> changed but a dev server restart.
>
> `scripts/build-deploy-tarball.sh` is unaffected, because it builds and packs in
> one go. But if you run the dev server and then `docker compose build`, or pack
> a second time without rebuilding, that is the error you will get. Re-run the
> script; do not go hunting for a Docker problem.

**On your machine**

```bash
# Builds the frontend, packs the bundle, and verifies its contents both ways.
bash scripts/build-deploy-tarball.sh
scp deploy.tar.gz you@server:/opt/slowfield/
```

**On the server**

```bash
cd /opt/slowfield

# 1. Back up first — this is the only restore point (see Backups below).
#    The script verifies the dump can be read back before it counts; a bare
#    pg_dump that fails halfway leaves a truncated file that looks fine until
#    the day you need it.
bash scripts/backup.sh

# 2. Unpack over the existing tree
tar -xzf deploy.tar.gz

# 3. .env must already exist and must NOT be in the bundle. Confirm it survived:
grep -q '^SECRET_KEY=.\{32,\}' .env || echo "SECRET_KEY missing or too short — the backend will refuse to start"

# 4. Validate the Caddyfile BEFORE restarting anything.
#    A Caddyfile that does not parse means Caddy will not start, and Caddy is
#    the only thing terminating TLS — the site is simply gone. This costs two
#    seconds and is the difference between a failed command and an outage.
docker compose -f docker-compose.prod.yml run --rm --no-deps --entrypoint caddy caddy \
  validate --config /etc/caddy/Caddyfile

# 5. Is any newsletter mid-flight? The scheduler drains every site that has
#    mail waiting, so a campaign left in `queued` with pending deliveries starts
#    sending within a minute of the restart. Look before you leap.
docker compose -f docker-compose.prod.yml exec -T db psql -U staycation -d slowfield -c \
  "SELECT c.id, c.subject, c.status, count(*) FILTER (WHERE d.status = 'pending') AS waiting
     FROM newsletter_campaigns c JOIN newsletter_deliveries d ON d.campaign_id = c.id
    WHERE c.status IN ('queued','scheduled') GROUP BY c.id, c.subject, c.status;"

# 5b. What will the subscriber merge actually touch?
#     Migration 202608300003 collapses duplicate live subscriptions and, where
#     any copy of an address had opted out, the survivor is left unsubscribed.
#     That is a change to real people's consent, so look at it BEFORE it runs.
#     An empty result means the migration has no data work to do.
docker compose -f docker-compose.prod.yml exec -T db psql -U staycation -d slowfield -c \
  "SELECT coalesce(site_id, -1) AS site, lower(email) AS address, count(*) AS copies,
          bool_or(status = 'unsubscribed') AS any_opt_out
     FROM newsletter_subscribers
    WHERE deleted_at IS NULL
    GROUP BY 1, 2 HAVING count(*) > 1
    ORDER BY copies DESC;"

# 6. Start
docker compose -f docker-compose.prod.yml up -d --build

# 7. Verify — `up -d` exits 0 even when the backend is crash-looping, so this
#    step is not optional.
docker compose -f docker-compose.prod.yml ps          # backend must be "healthy"
docker compose -f docker-compose.prod.yml logs backend | tail -50
curl -sf https://<your-domain>/healthz                # {"status":"ok"}
```

**Migrations run as the first half of the backend's CMD.** If one fails, the
container exits, `restart: unless-stopped` loops it, and the database stays on
the previous revision (Alembic runs the batch in one transaction). Since
`depends_on` now waits for `service_healthy`, the frontend and Caddy will not
start — the deploy fails visibly instead of serving an empty site.

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `s3cur3-rand0m-pa55` |
| `SECRET_KEY` | JWT signing key (min 32 chars) | `openssl rand -hex 32` |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `https://slowfield.example` |
| `FRONTEND_URL` | Public frontend URL | `https://slowfield.example` |
| `NEXT_PUBLIC_API_URL` | API URL accessible from browser | `https://slowfield.example/api/v1` |
| `DOMAIN` | Domain for Caddy auto-HTTPS | `slowfield.example` |
| `ADMIN_BOOTSTRAP_EMAIL` | Initial admin account email | `admin@slowfield.example` |
| `ADMIN_BOOTSTRAP_PASSWORD` | Initial admin password | `ChangeAfterFirstLogin!` |

### Generate SECRET_KEY

```bash
openssl rand -hex 32
```

---

## HTTPS (manual origin certificates)

Caddy runs with `auto_https off` and serves certificates from `./certs`:

```
certs/origin.pem
certs/origin-key.pem
```

These are origin certificates (Cloudflare Origin CA), bind-mounted read-only by
`docker-compose.prod.yml`. **There is no Let's Encrypt and no automatic
renewal.**

Two things to know:

- `./certs` is not in the repository and not in the deploy bundle. If the
  directory is missing, Docker creates an **empty** one instead of failing —
  Caddy then cannot load the certificate and the whole site becomes
  unreachable. Verify both files exist before every deploy.
- Check the expiry and that the SAN covers every villa domain you serve:
  `openssl x509 -in certs/origin.pem -noout -dates -ext subjectAltName`

---

## Common Operations

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Restart after code update

Code updates arrive as a bundle, not through git — see Quick Start. To restart
without changing code:

```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Run database migration manually

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

> Note: Migrations run automatically on container start. Manual run only if needed.

### Backups

`scripts/backup.sh` dumps the database **and** the uploaded media, then reads
both back — `pg_restore --list` on the dump, `tar -tzf` on the archive — and
exits non-zero if either cannot be re-read. It prunes only after those checks
pass, and refuses to prune at all if that would leave no database backup.

Media matters as much as the database here: the photographs live in a Docker
volume, not in git, and nothing else has a copy.

```bash
bash scripts/backup.sh
```

**Make it automatic.** A backup you have to remember is not a backup:

```bash
sudo crontab -e
# 03:15 every day; keep two weeks. Log it so a silent failure is visible.
15 3 * * * cd /opt/slowfield && KEEP_DAYS=14 bash scripts/backup.sh >> /var/log/staycation-backup.log 2>&1
```

Then **copy `backups/` off this host** (rsync, rclone, S3 — anything). A backup
on the same disk as the original does not survive the failure it exists for.

### Database restore

The dumps are pg_dump's **custom** format, so they are restored with
`pg_restore`, not `psql`. (An earlier version of this page said `psql` while the
backup command above wrote a custom-format file — the restore would have failed
at the exact moment it was needed.)

```bash
# Inspect first: this lists what the dump contains and fails on a truncated file.
pg_restore --list backups/db-20260830T031500Z.dump | head

# Restore into the running database.
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore --username=staycation --dbname=slowfield --clean --if-exists \
  < backups/db-20260830T031500Z.dump
```

Media is a plain tarball:

```bash
docker compose -f docker-compose.prod.yml exec -T backend \
  tar -xzf - -C /app/storage/media < backups/media-20260830T031500Z.tar.gz
```

### Access database shell

```bash
docker compose -f docker-compose.prod.yml exec db psql -U staycation slowfield
```

---

## Post-Deploy Checklist

### Check this on EVERY deploy, not just the first

- [ ] **The live `BUILD_ID` changed** to the one the bundle script printed. A
      deploy that silently no-ops leaves the old one serving.
- [ ] **Visitors are not all being seen as Cloudflare.** The Caddyfile resolves
      the client address from Cloudflare's published ranges. If that list is
      stale or wrong, `{client_ip}` falls back to the immediate peer and *every*
      visitor looks like the same handful of Cloudflare addresses — at which
      point the shared rate limiters start returning 429 to ordinary people on
      the public forms.

      This is the one thing that cannot be tested anywhere but production: there
      is no Cloudflare in front of a laptop. Check the access log shows varied
      real client addresses, not a repeating set of Cloudflare ones:

      ```bash
      docker compose -f docker-compose.prod.yml logs caddy --tail 200 \
        | grep -o '"remote_ip":"[^"]*"' | sort | uniq -c | sort -rn | head
      ```

      Cloudflare's ranges are listed at https://www.cloudflare.com/ips-v4 and
      /ips-v6. If the addresses above fall inside them, update the Caddyfile.

### After the first deployment

- [ ] Login to `/admin` with bootstrap credentials
- [ ] Change admin password immediately
- [ ] Configure SMTP in `/admin/email-settings` (for notifications)
- [ ] Set GA4 Measurement ID in `/admin/sites` settings
- [ ] Set cookie/GDPR notice text in `/admin/sites` settings
- [ ] Submit `https://yourdomain.com/sitemap.xml` to Google Search Console
- [ ] Test contact form → verify email delivery
- [ ] Verify OG tags at https://developers.facebook.com/tools/debug/

---

## Phase 2: Object Storage Migration

When ready to move media files to Linode Object Storage:

### 1. Copy existing files to bucket

```bash
# Install rclone
curl https://rclone.org/install.sh | bash

# Configure Linode Object Storage
rclone config
# Type: s3, Provider: Other, Endpoint: ap-south-1.linodeobjects.com

# Sync media volume to bucket
docker compose -f docker-compose.prod.yml exec backend ls /app/storage/media
rclone sync /var/lib/docker/volumes/<project>_media/_data/ remote:your-bucket/
```

### 2. Update Caddyfile

Replace the `/storage/*` block:

```
handle /storage/media/* {
    uri strip_prefix /storage/media
    reverse_proxy https://your-bucket.ap-south-1.linodeobjects.com {
        header_up Host your-bucket.ap-south-1.linodeobjects.com
    }
}
```

### 3. Reload Caddy

```bash
docker compose -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

No database changes needed. All existing image URLs continue working.

---

## Troubleshooting

### Container won't start

```bash
docker compose -f docker-compose.prod.yml logs backend
# Common: DATABASE_URL wrong, migration failure
```

### Frontend shows API errors

- Verify `NEXT_PUBLIC_API_URL` matches your domain
- Check CORS_ORIGINS includes your frontend domain
- Test: `curl https://yourdomain.com/api/v1/site/resolve`

### HTTPS not working

- Ensure DNS propagation complete: `dig yourdomain.com`
- Ensure ports 80/443 open: `sudo ufw allow 80,443/tcp`
- Check Caddy logs: `docker compose -f docker-compose.prod.yml logs caddy`

### Media upload fails

- Check volume mount: `docker compose -f docker-compose.prod.yml exec backend ls -la /app/storage/media`
- Check disk space: `df -h`

---

## Service Ports (Internal)

| Service | Port | Exposed |
|---------|------|---------|
| PostgreSQL | 5432 | No (internal only) |
| Backend | 8000 | No (via Caddy) |
| Frontend | 3000 | No (via Caddy) |
| Caddy | 80, 443 | Yes |
