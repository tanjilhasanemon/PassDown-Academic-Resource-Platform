# PassDown — Academic Course Archive & Resource-Sharing Platform

> *"Browse university courses, share peer-verified study materials, and fulfill academic resource requests."*

**Live Reference Design:** [https://passdown-weld.vercel.app/](https://passdown-weld.vercel.app/)  
**Main Repository:** [https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform](https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform)

## 1. Overview & Key Capabilities

**PassDown** is a full-stack academic resource-sharing platform built on a strict 4-layer **Entity–Control–Boundary (ECB)** architecture. It provides university students and course curators with a centralized, moderated archive for course study materials:

* **Course Catalog & Multi-Faceted Directory:** Browse offered courses with instant debounced search (`/` shortcut), department sidebar filters (`CS`, `CSE`, `EEE`, `MAT`), course level filters (`100-Level` to `400-Level`), sorting (`Code A–Z`, `Title A–Z`, `Newest`), Grid/Table layout toggle, and progress-bar pagination.
* **Curated Core Materials:** Course curators (`admin`) publish, edit, and manage official lecture slides, reference books, notes, and past examination papers with strict `https://` URL validation.
* **Community Contributions & Moderation Queue:** Students submit study material links (`status="pending"`), edit or withdraw their own pending submissions in **My Workspace**, and Admins review submissions in the **Moderation Queue** (`approve` to publish immediately or `reject` to keep hidden).
* **Course Resource Requests:** Students post open requests for missing course materials; the requester or an Admin can mark requests as `fulfilled` or delete them.
* **Stateless OAuth2 + JWT Security & Fine-Grained Scopes:** Bcrypt password hashing, in-memory JWT storage (`localStorage = 0`), automatic `401 Unauthorized` session interception, and FastAPI `SecurityScopes` enforcement (`courses:write`, `materials:write`, `contributions:moderate`, `contributions:write`, `requests:write`).
* **Swiss Academic Archive UI:** Editorial warm-stone light theme (`#f5f4f0`) and carbon dark theme (`#0b0c0e`) with forest emerald accents (`#0f5338`), responsive across desktop and mobile viewports.

## 2. Technology Stack & ECB Architecture

| Layer | Technology | Responsibility |
| :--- | :--- | :--- |
| **Boundary Layer (Frontend)** | React 18, TypeScript 5, Vite, Tailwind CSS + Editorial CSS | Renders the Swiss Academic Archive UI, manages in-memory JWT state (`AuthContext`), and communicates with `/api/v1`. |
| **Boundary Layer (Backend HTTP)** | FastAPI (`app/routers/`) & Pydantic v2 (`app/schemas/`) | Validates request payloads, enforces OAuth2 `SecurityScopes`, and serializes safe JSON responses. |
| **Control Layer (Business Logic)** | Python 3.11+ Services (`app/services/`) & Security (`app/core/`) | Enforces ownership rules, moderation state transitions, course dependency checks (`409 Conflict`), and JWT signing. |
| **Entity Layer (Persistence)** | SQLAlchemy 2.0 ORM (`app/models/` & `app/repositories/`) | Maps the 5 relational tables (`users`, `courses`, `core_materials`, `contributions`, `requests`) on PostgreSQL / SQLite. |
| **Quality Assurance & Docs** | Pytest, Ruff, Sphinx (`autodoc` + `napoleon`), TypeDoc, GitHub Actions | Enforces PEP 8 linting, 100% Google-style docstring coverage, AST ECB boundary rules, and automated HTML documentation builds. |

## 3. Repository Structure

```text
PassDown-Academic-Resource-Platform/
├── .github/
│   ├── workflows/ci.yml              # GitHub Actions CI (Ruff, Pytest, Sphinx, TypeScript, Vite, TypeDoc)
│   └── pull_request_template.md      # Pull Request review & quality gate checklist
├── backend/
│   ├── app/
│   │   ├── core/                     # Settings, SQLAlchemy engine, JWT/RBAC scopes, idempotent seeder
│   │   ├── models/                   # SQLAlchemy 2.0 ORM entities (User, Course, CoreMaterial, Contribution, Request)
│   │   ├── repositories/             # Parameterized data-access repositories (Entity layer)
│   │   ├── services/                 # Business logic, ownership & state transition services (Control layer)
│   │   ├── schemas/                  # Pydantic v2 input validation & safe response schemas (Boundary layer)
│   │   ├── routers/                  # FastAPI /api/v1 HTTP routers (Boundary layer)
│   │   └── main.py                   # FastAPI entrypoint, CORS middleware & startup lifespan hook
│   ├── tests/                        # 58 Pytest unit, integration, AST ECB & 100% docstring coverage tests
│   ├── .env.example                  # Backend environment variable template
│   └── requirements.txt              # Python package dependencies
├── frontend/
│   ├── src/
│   │   ├── context/AuthContext.tsx   # In-memory JWT state & 401 session interceptor
│   │   ├── services/apiClient.ts     # Typed HTTP client for all /api/v1 endpoints
│   │   ├── types/api.ts              # Shared TypeScript interfaces & OAuth2 scope constants
│   │   ├── App.tsx                   # Full-stack Swiss Academic Archive workspace
│   │   ├── index.css                 # Light & dark theme tokens and editorial layout rules
│   │   └── main.tsx                  # React 18 application root
│   ├── .env.example                  # Frontend API base URL template
│   ├── package.json                  # Frontend scripts & dependencies
│   ├── tsconfig.json                 # Strict TypeScript compiler configuration
│   └── typedoc.json                  # TypeDoc HTML documentation generator configuration
├── docs/
│   └── source/                       # Sphinx reStructuredText documentation sources (Entity, Control, Boundary)
├── resources/
│   └── PassDown_Engineering_Decisions.md # Architectural decisions, coding standards & engineering rationale
├── .gitignore                        # Excludes .env, .venv, node_modules, __pycache__, *.db
├── LICENSE                           # MIT License
└── README.md                         # Project documentation & setup guide
```

## 4. REST API Endpoints (`/api/v1`)

| Domain | Method & Path | Access / Scope | Description |
| :--- | :--- | :--- | :--- |
| **Health** | `GET /api/v1/health` | Public | Service health check (`200 OK`). |
| **Auth & Profile** | `POST /api/v1/auth/register` | Public | Register a student account with bcrypt password hashing (`201 Created`). |
| **Auth & Profile** | `POST /api/v1/auth/login` | Public | Authenticate via JSON or OAuth2 form and issue a signed scoped JWT (`200 OK`). |
| **Auth & Profile** | `GET /api/v1/auth/me` | Authenticated | Return current user profile excluding `password_hash` (`200 OK`). |
| **RBAC Scopes** | `GET /api/v1/auth/scopes/{scope}` | Scoped | Live verification endpoints for all 5 OAuth2 security scopes. |
| **Courses** | `GET /api/v1/courses` | Public | List courses ordered by code with optional `?search=` filtering (`200 OK`). |
| **Courses** | `GET /api/v1/courses/{id}` | Public | Retrieve course details and hypermedia resource links (`200 OK` / `404`). |
| **Courses** | `POST /api/v1/courses` | `courses:write` | Create a new academic course (`201 Created` / `409 Conflict`). |
| **Courses** | `PUT /api/v1/courses/{id}` | `courses:write` | Update course metadata (`200 OK` / `404` / `409`). |
| **Courses** | `DELETE /api/v1/courses/{id}` | `courses:write` | Delete an empty course; blocks with `409 Conflict` if dependents exist (`204`). |
| **Core Materials** | `GET /api/v1/courses/{id}/core-materials` | Public | List official core materials with optional `?material_type=` filter (`200 OK`). |
| **Core Materials** | `POST /api/v1/courses/{id}/core-materials` | `materials:write` | Publish a curated HTTPS core material (`201 Created`). |
| **Core Materials** | `PUT /api/v1/core-materials/{id}` | `materials:write` | Update an existing core material (`200 OK`). |
| **Core Materials** | `DELETE /api/v1/core-materials/{id}` | `materials:write` | Delete a core material (`204 No Content`). |
| **Contributions** | `GET /api/v1/courses/{id}/contributions` | Public | List approved student contributions with optional `?material_type=` filter (`200 OK`). |
| **Contributions** | `POST /api/v1/courses/{id}/contributions` | `contributions:write` | Submit a new pending study contribution (`201 Created`). |
| **Contributions** | `GET /api/v1/contributions/mine` | `contributions:write` | List the authenticated user's own submitted contributions (`200 OK`). |
| **Contributions** | `PUT /api/v1/contributions/{id}` | `contributions:write` | Edit an owned pending contribution (`200 OK` / `403` / `409`). |
| **Contributions** | `DELETE /api/v1/contributions/{id}` | `contributions:write` | Withdraw an owned pending contribution or delete as Admin (`204` / `403` / `409`). |
| **Moderation** | `GET /api/v1/contributions/pending` | `contributions:moderate` | List all pending contributions with course and submitter metadata (`200 OK`). |
| **Moderation** | `PATCH /api/v1/contributions/{id}/approve` | `contributions:moderate` | Approve a pending contribution for public display (`200 OK` / `409`). |
| **Moderation** | `PATCH /api/v1/contributions/{id}/reject` | `contributions:moderate` | Reject a pending contribution (`200 OK` / `409`). |
| **Requests** | `GET /api/v1/courses/{id}/requests` | Public | List public resource requests for a course (`200 OK`). |
| **Requests** | `POST /api/v1/courses/{id}/requests` | `requests:write` | Submit a new open resource request (`201 Created`). |
| **Requests** | `PATCH /api/v1/requests/{id}/fulfill` | `requests:write` | Mark an open request as fulfilled by its owner or Admin (`200 OK` / `403` / `409`). |
| **Requests** | `DELETE /api/v1/requests/{id}` | `requests:write` | Delete a request by its owner or Admin (`204 No Content`). |

## 5. How to Run Locally (Step-by-Step)

### Step 1: Start the FastAPI Backend & Run Tests

Open **PowerShell** in VS Code (`E:\SWE Project\1_Main_Repository_Files`):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd backend
if (!(Test-Path .\.venv)) { python -m venv .venv }
.\.venv\Scripts\Activate.ps1
python -m pip install --only-binary=:all: -r requirements.txt
Copy-Item .env.example .env -Force

# Optional: Remove any old local SQLite file so fresh 8-course demo data seeds cleanly
if (Test-Path .\passdown_dev.db) { Remove-Item .\passdown_dev.db -Force }

# 1. Verify PEP 8 Linting (Ruff) and Full Pytest Suite
python -m ruff check --select E9,F .
python -m pytest -v --cov=app --cov-report=term-missing

# 2. Launch the FastAPI Server
python -m uvicorn app.main:app --reload --port 8000
```

* **API Base URL:** `http://127.0.0.1:8000/api/v1`
* **Interactive Swagger UI:** `http://127.0.0.1:8000/docs`
* **Pre-Seeded Demo Accounts:**
  * **Demo Admin:** `admin@iub.edu.bd` / `AdminPass123!`
  * **Demo Student:** `2331024@iub.edu.bd` / `StudentPass123!`

### Step 2: Start the React + TypeScript Frontend

Open a second **PowerShell** terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env -Force
npm run typecheck
npm run dev
```

* **Frontend Application:** `http://localhost:5173`

### Step 3: Build Source Code Documentation (Sphinx & TypeDoc)

```powershell
# Backend Sphinx HTML Documentation
cd backend
.\.venv\Scripts\Activate.ps1
sphinx-build -b html ../docs/source ../docs/build/html

# Frontend TypeDoc HTML Documentation
cd ../frontend
npm run docs
```
