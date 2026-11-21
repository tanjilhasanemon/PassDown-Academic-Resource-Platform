# PassDown — Academic Course Archive & Resource-Sharing Platform

> *"Browse university courses, share peer-verified study materials, collaborate in study groups, and fulfill academic resource requests."*

**Course:** CSE 451 — Software Engineering  
**Institution:** Department of Computer Science & Engineering, Independent University, Bangladesh (IUB)  
**Main Repository:** [https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform](https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform)

## 1. Platform Features

* **Course Catalog & Directory:** Browse and search offered IUB courses by code or title, filter by department and course level (`100`–`400`), sort dynamically, and switch between Card Grid and Table views.
* **Curated Core Materials & Community Contributions:** Access official admin-curated slides, notes, past papers, and reference books alongside peer-submitted contributions moderated through an Admin approval workflow (`pending -> approved / rejected`).
* **Course Resource Requests:** Post open requests for missing study materials and track fulfillment (`open -> fulfilled`).
* **Collaborative Study Groups:** Create course-linked study groups with fine-grained per-member permissions (`can_create`, `can_edit`, `can_assign`) and shared resource boards.
* **Stateless Security, Refresh Rotation & Audit Hub:** Argon2id password hashing with server-side pepper, 15-minute JWT access tokens, 7-day rotating refresh tokens with server-side session revocation, account lockout protection, and an Admin Hub with User Management, Activity Audit Logs (CSV export & purge), and Security Overview.
* **Swiss Academic Archive UI:** Full-viewport editorial design system with Warm Archival Stone light theme (`#f5f4f0`) and Carbon dark theme (`#0b0c0e`), Forest Emerald accents (`#0f5338`), `Plus Jakarta Sans` + `JetBrains Mono` typography, and live network progress bar.

## 2. Architectural Pattern (Entity–Control–Boundary / Layered Design)

| Layer | Directory / Stack | Responsibility |
| :--- | :--- | :--- |
| **Boundary Layer (Frontend)** | `frontend/src/` (React 19, TypeScript, Vite, React Router, Axios, Lucide) | Renders the Swiss Academic Archive SPA, manages authentication state, and communicates with `/api/v1`. |
| **Boundary Layer (Backend HTTP)** | `backend/api/v1/` & `backend/schemas/` (FastAPI + Pydantic v2) | Validates HTTP requests, enforces JWT/RBAC dependencies, and serializes public-safe JSON responses. |
| **Control Layer (Business Logic)** | `backend/services/` & `backend/core/` | Enforces ownership checks, moderation transitions, Argon2id/JWT security, RBAC rules, and audit logging. |
| **Entity Layer (Persistence)** | `backend/models/` & `backend/repositories/` (SQLAlchemy 2.0 + Alembic) | Maps relational entities (`AppUser`, `Course`, `CoreMaterial`, `Contribution`, `MaterialRequest`, `StudyGroup`, `UserSession`, `AuditLog`) on PostgreSQL (Supabase) / SQLite. |

## 3. Quality Gates, Testing & Documentation Tools

* **Coding Standards & Static Analysis:** Ruff (`E, F, W, B` via `backend/pyproject.toml`), Bandit security scanning, TypeScript strict compiler (`tsc --noEmit`), and GitHub CodeQL (`.github/workflows/codeql.yml`).
* **Automated Testing (`Pytest`):** Unit, security/RBAC, API integration, and 100.0% docstring coverage suites (`backend/tests/`).
* **Source Code Documentation:** Sphinx (`docs/source/` with `autodoc` + `napoleon` Google-style docstrings) for Python and TypeDoc (`frontend/typedoc.json`) for TypeScript, plus live OpenAPI Swagger UI (`/api/docs`).
* **Continuous Integration:** Automated GitHub Actions pipeline (`.github/workflows/ci.yml`) running on every push and pull request.

## 4. Local Development Setup

### Backend (FastAPI + SQLAlchemy)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --only-binary=:all: -r requirements-dev.txt

# Run Code Review Tools, Full Pytest Suite & Sphinx Docs
python -m ruff check --select E9,F .
python -m bandit -r api core dependencies models repositories schemas services main.py -ll
python -m pytest -v --cov=. --cov-report=term-missing --cov-report=html
sphinx-build -b html ../docs/source ../docs/build/html

# Start Backend Server (http://127.0.0.1:8000/api/docs)
python -m uvicorn main:app --reload --port 8000
```

### Frontend (React + TypeScript + Vite)

```powershell
cd frontend
npm install
npm run typecheck
npm run build
npm run dev
```

* **Frontend URL:** `http://localhost:5173`
* **Demo Credentials (Pre-Seeded):**
  * **Admin:** `admin@passdown.edu` / `Admin1234`
  * **Student:** `student@passdown.edu` / `Student1234`

## 5. Cloud Deployment (Single Unified Vercel Services Project + Supabase)

This repository includes a root `vercel.json` configured with **Vercel Services** to host both the FastAPI backend (`/api/*`) and the React/Vite frontend (`/*`) on a single domain:

1. Import `PassDown-Academic-Resource-Platform` in [Vercel](https://vercel.com/new) with **Root Directory = `./`** and **Application Preset = `Services`**.
2. Add your Supabase PostgreSQL **Session Pooler** URI as `DATABASE_URL` plus `JWT_SECRET` in **Environment Variables**.
3. Click **Deploy** — both the SPA frontend and `/api/docs` Swagger UI go live on one URL with zero CORS configuration.
