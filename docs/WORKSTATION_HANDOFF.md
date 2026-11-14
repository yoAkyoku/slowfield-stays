# Workstation Handoff

Use this document to rebuild the project on a new work computer.

## 1. Required Software

- Git
- Docker Desktop
- Node.js 20 or newer
- Python 3.11 or newer
- A code editor

Recommended checks:

```bash
git --version
docker --version
node --version
npm --version
python --version
```

## 2. Clone and Enter the Project

```bash
git clone <repository-url>
cd slowfield
```

If the repository is transferred as a folder instead of cloned from GitHub, confirm these folders exist:

```text
backend/
frontend/
參考資料/
docs/
```

## 3. Start the Database

```bash
docker compose up -d db
```

Confirm the container is running:

```bash
docker compose ps
```

The local database uses:

```text
Database: slowfield
User: staycation
Password: staycation
Port: 5432
```

## 4. Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Backend URL:

```text
http://localhost:8000
```

API docs:

```text
http://localhost:8000/docs
```

## 5. Frontend Setup

Open a second terminal:

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## 6. Validation Commands

Backend:

```bash
cd backend
pytest
ruff check .
```

Frontend:

```bash
cd frontend
npm run build
npm run typecheck
```

If `npm run typecheck` reports missing `.next/types`, run:

```bash
npm run build
npm run typecheck
```

## 7. Admin Login

The bootstrap admin account comes from `backend/.env`:

```text
ADMIN_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_PASSWORD=ChangeMe123!
```

Change these values for any non-local environment.

## 8. Important Local Files

Do not commit local secrets or generated runtime files:

```text
backend/.env
frontend/.env.local
backend/.venv/
frontend/node_modules/
frontend/.next/
backend/storage/
```

Files that should be preserved in Git:

```text
README.md
docs/IMPLEMENTATION_CHECKLIST.md
docs/WORKSTATION_HANDOFF.md
docs/QA_HANDOFF.md
backend/.env.example
frontend/.env.example
backend/alembic/
backend/app/
frontend/app/
```

## 9. First Manual QA After Setup

1. Open `http://localhost:3000` and confirm the public home page loads.
2. Open `http://localhost:3000/admin/login` and log in.
3. Switch UI language between Chinese and English.
4. Open Admin Dashboard and confirm the reference-plan coverage panel appears.
5. Open Sites and confirm child-site creation UI is available.
6. Open CMS and confirm content list/create/edit pages load.
7. Open Stays and confirm stay list/create/edit pages load.
8. Open Booking Requests and confirm the queue page loads.
9. Open Newsletter and Email Settings, then confirm SMTP readiness checks display.
10. Follow `docs/QA_HANDOFF.md` for public, admin, site isolation, SEO, tracking, and newsletter QA.
11. Run `npm run build` and `npm run typecheck` before handing off changes.

## 10. Known First-Version Limits

- Child sites are copied once from a template. They do not sync automatically after creation.
- Booking requests are inquiries only. There is no room inventory, payment, or order system.
- Newsletter sending depends on SMTP provider limits.
- CMS data is not translated automatically; only interface text switches language.
- Final production QA is still required for GA/ad code, Cookie/GDPR, SEO/OG/JsonLd, sitemap, popup output, and SMTP retry behavior.
