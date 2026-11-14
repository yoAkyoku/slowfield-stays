# Production Runbook

This runbook keeps the first production launch focused on the inquiry-first release. It does not add room inventory, payment, orders, or cancellation workflows.

## 1. Environment Variables

Backend `.env`:

```text
APP_NAME=Slowfield Stays API
APP_ENV=production
API_V1_PREFIX=/api/v1
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/slowfield
SECRET_KEY=replace-with-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=120
CORS_ORIGINS=https://www.example.com,https://admin.example.com
FRONTEND_URL=https://www.example.com
ADMIN_BOOTSTRAP_EMAIL=owner@example.com
ADMIN_BOOTSTRAP_PASSWORD=replace-before-first-login
```

Frontend `.env.local` or deployment variables:

```text
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_APP_ENV=production
```

### Email provider

Everything — newsletters, enquiry notifications, password resets — goes out over
SMTP, configured **per site** in Admin > Email Settings. That is what makes the
provider a setting rather than a deployment.

**Currently: Resend.** Its SMTP endpoint is `smtp.resend.com:587` with STARTTLS,
username `resend`, and the API key as the password. Moving to SES, Postmark, or
a mailbox provider is a host / port / credential change in the admin — no code
change, no redeploy.

Set `daily_cap` to match the plan: `0` means unlimited (Resend Pro, SES); `100`
matches the Resend free tier. When the cap is reached the remaining deliveries
stay pending and go out on the next day's ticks rather than failing.

SMTP passwords are encrypted at rest (`app/core/crypto.py`, keyed off
`SECRET_KEY`). In production, storing one is refused outright if encryption is
unavailable — the app will not silently write a credential in cleartext.

Do not store production SMTP passwords in the frontend environment.

A second transport routed through a Cloudflare Worker was removed: it was never
adopted, and it bypassed these per-site settings, so a villa's own From and
Reply-To were ignored whenever an env var happened to be set.

## 2. Database Migration

Run migrations before starting the production application:

```bash
cd backend
alembic upgrade head
```

If migration fails, stop the deployment and restore from the latest database backup before retrying.

## 3. First Admin Bootstrap

1. Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` before the first start.
2. Log in once with the bootstrap account.
3. Change the password immediately in Admin > Account.
4. Create named admin users and assign site roles.
5. Remove or rotate the bootstrap password from the runtime environment.

## 4. Nginx and HTTPS

Recommended routing:

- `https://www.example.com` -> Next.js frontend.
- `https://api.example.com/api/v1` -> FastAPI backend.
- Static media paths should be served from the backend media directory or an object storage/CDN origin.

Minimum Nginx requirements:

- Force HTTP to HTTPS.
- Pass `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers to the backend.
- Set upload body size high enough for media uploads.
- Enable gzip or Brotli for text assets.

Example backend proxy block:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 25m;
}
```

## 5. PostgreSQL Backup and Restore

Daily backup:

```bash
pg_dump --format=custom --file=backups/slowfield_$(date +%F).dump "$DATABASE_URL"
```

Restore rehearsal:

```bash
createdb slowfield_restore
pg_restore --clean --if-exists --dbname=slowfield_restore backups/slowfield_YYYY-MM-DD.dump
```

Verify backups by restoring to a separate database at least once before launch.

## 6. Media Backup

Back up the configured media storage with the database backup window. The database stores media metadata and paths; the actual image files must be backed up separately.

Local storage checklist:

- Archive the backend media/storage directory.
- Keep at least one off-machine copy.
- Restore a sample image and confirm the public URL renders.

Object storage checklist:

- Enable bucket versioning if available.
- Restrict public write permissions.
- Confirm lifecycle rules do not delete active media.

## 7. SMTP Test Flow

For each site:

1. Open Admin > Email Settings.
2. Fill SMTP host, port, TLS, username, password, sender name, and from email.
3. Send a test email to an internal mailbox.
4. Confirm delivery, sender identity, reply-to behavior, and spam classification.
5. Record the SMTP provider's hourly and daily limits.

Newsletter sending defaults to small queue batches. Confirm provider limits before sending to a production list.

## 8. Newsletter Operations

Before sending:

- Confirm subscribers and target groups.
- Confirm campaign subject, body, links, and unsubscribe footer.
- Queue the campaign.
- Process pending emails in small batches.

After sending:

- Review delivery statuses: `sent`, `failed`, `skipped`.
- Use retry failed deliveries only after fixing the SMTP or content issue.
- Unsubscribed contacts must remain excluded from future queues.

## 9. SEO, Tracking, and Compliance QA

For every production site:

- Confirm title, description, canonical, OG image, JSON-LD, sitemap, and robots output.
- Confirm GA/ad snippets render only when the site settings contain IDs or code.
- Confirm Cookie/GDPR notice text is visible and dismissible.
- Confirm announcement popups respect active dates and display mode.

## 10. Launch Checklist

- Backend tests pass: `python -m pytest`.
- Backend lint passes: `python -m ruff check app tests`.
- Frontend build passes: `npm.cmd run build`.
- Frontend typecheck passes: `npm.cmd run typecheck`.
- At least two sites pass site-isolation QA.
- SMTP test email is confirmed for each active site.
- Database and media backup restore has been rehearsed.
