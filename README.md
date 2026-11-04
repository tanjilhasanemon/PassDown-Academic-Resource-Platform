# PassDown — An Academic Resource-Sharing Platform

> *"Preview courses, share trusted study materials, and fulfill academic resource requests!"*

**Course:** CSE 451 — Software Engineering  
**Institution:** Department of Computer Science & Engineering, Independent University, Bangladesh (IUB)

## Team Information

| Role | Full Name | Initials | Student ID | Assigned Functional Requirements |
| :--- | :--- | :---: | :---: | :--- |
| **Member 1 (Team Lead)** | Tanjil Hasan Emon | `THE` | 2331024 | FR-01, FR-02, FR-03 |
| **Member 2** | Tanjil Sarkar | `TS` | 2312026 | FR-04, FR-05, FR-06 |
| **Member 3** | Md Jawad Abdullah | `MJA` | 2230325 | FR-07, FR-08, FR-09 |
| **Member 4** | S M Mashraful Islam | `SMMI` | 2230836 | FR-10, FR-11, FR-12 |

## Technology Stack & Architecture

* **Architectural Pattern:** Entity–Control–Boundary (ECB) / 4-Layer Architecture (`Routers [Boundary] -> Services [Control] -> Repositories & Models [Entity]`)
* **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
* **Backend:** Python 3.11+ + FastAPI (`/api/v1`) + Pydantic v2
* **Database & ORM:** PostgreSQL (Supabase) + SQLAlchemy 2.0
* **Authentication & Authorization:** OAuth2 Password Bearer with signed JWTs and fine-grained `SecurityScopes`
* **Documentation Tools:** Sphinx (`autodoc` + `napoleon`) for Python, TypeDoc/JSDoc for TypeScript, and OpenAPI/Swagger UI
* **Testing & CI:** Pytest + FastAPI `TestClient` + Ruff + ESLint via GitHub Actions

## Repository Structure

```text
PassDown-Academic-Resource-Platform/
├── .github/
│   ├── workflows/ci.yml          # Automated linting & unit test pipeline
│   └── pull_request_template.md  # PR review & SRS traceability checklist
├── backend/
│   ├── app/
│   │   ├── core/                 # Config, JWT & RBAC security scopes
│   │   ├── models/               # SQLAlchemy ORM entities (Entity layer)
│   │   ├── schemas/              # Pydantic request/response models
│   │   ├── repositories/         # Database access queries (Entity layer)
│   │   ├── services/             # Business rules & ownership checks (Control layer)
│   │   ├── routers/              # FastAPI HTTP endpoints (Boundary layer)
│   │   └── main.py               # FastAPI application entrypoint
│   ├── tests/                    # Pytest unit & integration test suites
│   ├── .env.example              # Environment variable template (no secrets)
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── src/                      # React + TypeScript SPA views & AuthContext
│   └── .env.example              # Frontend API URL template
├── docs/                         # Sphinx & TypeDoc configuration
├── resources/                    # SRS PDF, SDS, engineering decisions & meeting minutes
├── .gitignore                    # Excludes .env, node_modules, __pycache__, venv
├── LICENSE                       # MIT License
└── README.md                     # Project overview & developer workflow
```

## How to Use (Local Setup)

### 1. Clone the Project
1. Install **Git Bash** and open your terminal.
2. Configure Git with your GitHub identity:
   ```bash
   git config --global user.name "<your_github_username>"
   git config --global user.email "<your_github_email>"
   ```
3. Clone the repository and navigate into the project folder:
   ```bash
   git clone https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform.git
   cd PassDown-Academic-Resource-Platform
   ```

### 2. Run the Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Activate virtual environment (Windows Git Bash: source .venv/Scripts/activate | macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
* **API Base URL:** `http://127.0.0.1:8000/api/v1`
* **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`

### 3. Run the Frontend (React + TypeScript)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
* **Frontend URL:** `http://localhost:5173`

## How to Develop (Git Branching, CI & Pull Request Workflow)

1. **Create a Feature Branch (1 Branch per FR or Task):**
   ```bash
   git checkout -b feat/fr-01-auth-register
   ```
2. **Make Changes & Run Local Checks:**
   * Format and lint backend code:
     ```bash
     cd backend && ruff check . && pytest
     ```
3. **Commit and Push Changes:**
   ```bash
   git add .
   git commit -m "feat(FR-01): implement student registration and /auth/me endpoint by THE"
   git push origin feat/fr-01-auth-register
   ```
4. **Check CI Pipeline:**
   * Go to the **Actions** tab on GitHub.
   * Click on the latest workflow run and verify that linting and unit tests pass.
5. **Create a Pull Request:**
   * Open a Pull Request from `feat/fr-01-auth-register` into `main` using the PR template and link the corresponding Trello card.
6. **Code Review and Merge:**
   * Team members review the diff, verify SRS confirmation criteria, leave review comments, and merge into `main`.
7. **Update Local Repository:**
   ```bash
   git checkout main
   git pull origin main
   git branch -d feat/fr-01-auth-register
   ```
