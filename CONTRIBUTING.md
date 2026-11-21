# Contributing to PassDown

Thank you for your interest in contributing to **PassDown**! This repository is developed for **CSE 309: Web Applications & Internet** at Independent University, Bangladesh (IUB) and follows professional open-source engineering standards.

## Development Workflow

Every change must go through the following four steps (never push directly to `main`):

1. **Create an Issue**:
   - Open a new issue using the **Feature or Task** or **Bug Report** template.
   - Include a clear **Goal**, a **Tasks** checklist (`- [ ]`), and a **Definition of done**.
   - Assign the appropriate labels (`mvp`, `beta`, `backend`, `frontend`, `feature`, `bug`, `chore`, `docs`, `security`) and milestone (`MVP (v0.1.0)` or `Beta (v0.2.0)`).

2. **Create a Feature Branch**:
   - Always branch from an up-to-date `main` branch:

         git checkout main
         git pull origin main
         git checkout -b tanjilhasanemon/#<issue-number>-<short-kebab-description>

3. **Make Atomic Conventional Commits**:
   - Follow [Conventional Commits](https://www.conventionalcommits.org/) and reference the issue number:
     - `feat(backend): add course search endpoint (#7)`
     - `feat(frontend): add moderation queue filter pills (#15)`
     - `fix(backend): sanitize database URL on serverless startup (#19)`
     - `docs(readme): update MVP roadmap status (#17)`
     - `chore(deps): add SQLAlchemy 2.0 and psycopg (#3)`

4. **Open a Pull Request**:
   - Push your branch and open a Pull Request targeting `main`.
   - Complete the PR template (**Summary**, **Changes**, **How to test**, and `Closes #<issue-number>`).
   - Ensure the frontend TypeScript build (`npm run build`) and Vercel preview check succeed before merging.

## Local Setup in GitHub Codespaces

### Backend (FastAPI + SQLAlchemy 2.0)

    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    fastapi dev main.py

- Interactive OpenAPI documentation: `http://localhost:8000/api/docs`
- Health check endpoint: `http://localhost:8000/api/health`

### Frontend (React 19 + TypeScript + Vite)

    cd frontend
    npm install
    npm run dev

- Local web app: `http://localhost:5173`
- Production type-check and bundle verification: `npm run build`

## Architecture & Coding Standards

- **Backend Layering (`backend/`)**: Keep HTTP parsing in `api/v1/` routers, business rules in `services/`, database queries in `repositories/`, ORM tables in `models/`, and validation in Pydantic v2 `schemas/`.
- **Frontend Typing (`frontend/`)**: Maintain strict TypeScript mode (`tsc && vite build` must pass with 0 errors) and keep API calls inside `src/api/`.
- **No Secrets or Local DB Files in Git**: Never commit `.env` files or local `.db` SQLite files; document new environment variables in `.env.example`.
