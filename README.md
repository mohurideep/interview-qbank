
# Interview QBank

A full-stack question bank for interview prep, built with:

- Backend: FastAPI + SQLAlchemy + Alembic + PostgreSQL
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS

Use it to store interview questions, answers, follow-up threads, tags, sources, and spaced-repetition review metadata.

## What This Repo Includes

- Create, edit, delete interview questions
- Nested follow-up question threads (`parent_id`)
- Search over question + answer text
- Filter by source and tags
- Dashboard stats (counts, due items, weakest tags)
- Study mode with review actions (`forgot` / `almost` / `knew`)
- Source/tag autocomplete suggestions while typing in the Add/Edit modal

## Project Structure

```text
interview-qbank/
  backend/
    app/
      main.py
      routes/
      models.py
      crud.py
    alembic/
    requirements.txt
    .env
  frontend/
    app/
    lib/api.ts
    package.json
```

## Prerequisites

- Python 3.11+ (recommended)
- Node.js 20+ and npm
- PostgreSQL 14+ (local or hosted)

## 1) Clone and Install

```bash
git clone <your-fork-url>
cd interview-qbank
```

### Backend dependencies

```bash
cd backend
python -m venv .venv
```

Windows (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

macOS/Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend dependencies

```bash
cd ../frontend
npm install
```

## 2) Configure Environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://<user>:<password>@localhost:5432/<db_name>
CORS_ORIGINS=http://localhost:3000
DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001
JWT_SECRET=replace-with-a-strong-secret
```

Optional frontend env (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

If omitted, frontend defaults to `http://localhost:8000`.

## 3) Run Database Migrations

From `backend/`:

```bash
alembic upgrade head
```

This creates/updates all required tables.

## 4) Run the App Locally

Open two terminals.

### Terminal A: Backend

From `backend/`:

```bash
uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

### Terminal B: Frontend

From `frontend/`:

```bash
npm run dev
```

Open: `http://localhost:3000`

## API Overview

Base URL: `http://localhost:8000`

- `GET /health`
- `GET /v1/questions`
- `POST /v1/questions`
- `PATCH /v1/questions/{id}`
- `DELETE /v1/questions/{id}`
- `POST /v1/questions/{id}/review?rating=forgot|almost|knew`
- `GET /v1/questions/suggestions?field=source|tag&q=<text>&limit=8`
- `GET /v1/dashboard/stats`

Common `GET /v1/questions` query params:

- `search=<text>`
- `source=<text>`
- `tags=<comma,separated,tags>`
- `due_only=true|false`

## Important Current Behavior

- Questions/dashboard routes currently run in **single-user mode** via `DEFAULT_USER_ID`.
- Auth route code exists in `backend/app/routes/auth.py`, but auth router is not mounted in `backend/app/main.py` right now.
- You can still use the app fully for personal/local use.

## Troubleshooting

- CORS errors:
  - Ensure `CORS_ORIGINS` in `backend/.env` includes your frontend URL (for local: `http://localhost:3000`).
- DB connection errors:
  - Verify `DATABASE_URL`, DB server status, username/password, and db name.
- `relation does not exist` errors:
  - Run `alembic upgrade head` again from `backend/`.
- Frontend cannot reach backend:
  - Check backend is on port `8000` and `NEXT_PUBLIC_API_BASE` is correct.

## Development Notes

- Backend migrations: `backend/alembic/versions`
- Main frontend page: `frontend/app/page.tsx`
- Study mode page: `frontend/app/study/page.tsx`
- Dashboard page: `frontend/app/dashboard/page.tsx`

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/<name>`
3. Commit your changes
4. Open a pull request

If you're forking for personal use, the setup steps above are all you need to get started quickly.
