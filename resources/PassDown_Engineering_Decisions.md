# PassDown — Software Engineering Decisions, Justifications & GitHub Wiki Templates

**Course:** CSE 451 — Software Engineering

**Institution:** Independent University, Bangladesh (IUB)

**Project:** PassDown — Academic Resource-Sharing Platform

**Baseline Reference:** PassDown SRS v1.0 & JU-High-Fives/Dhar-Hobe Repository Standard

| Role | Full Name | Initials | Student ID | Assigned Functional Requirements | 
| ----- | ----- | ----- | ----- | ----- | 
| **Member 1 (Team Lead)** | Tanjil Hasan Emon | `THE` | 2331024 | FR-01, FR-02, FR-03 | 
| **Member 2** | Tanjil Sarkar | `TS` | 2312026 | FR-04, FR-05, FR-06 | 
| **Member 3** | Md Jawad Abdullah | `MJA` | 2230325 | FR-07, FR-08, FR-09 | 
| **Member 4** | S M Mashraful Islam | `SMMI` | 2230836 | FR-10, FR-11, FR-12 | 

## Part 1: Next Project Work — Decisions & Justifications

### 1. Decisions on Programming Languages and Frameworks

#### 1.1 Programming Languages

* **Backend Language:** **Python 3.11+**

* **Frontend Language:** **TypeScript 5.x** (compiled to JavaScript ES2022)

* **Database Query / Schema Language:** **SQL (PostgreSQL 15+)** managed via **SQLAlchemy 2.0 ORM**

**Justification:**

1. **SRS & Course Stack Compliance:** Preserves the approved stack mandated in PassDown SRS §2.4 and §2.5 (`Python + FastAPI` backend and `Vite + React + TypeScript` frontend).

2. **End-to-End Type Safety:** TypeScript on the frontend combined with Python 3.11+ type annotations (`typing` + `Pydantic v2`) on the backend eliminates runtime type mismatches across the `/api/v1` REST boundary and directly satisfies `NFR-08` (consistent JSON error shapes) and `NFR-09` (shared role/scope names and API types).

3. **Ecosystem Maturity for Security & Testing:** Python offers first-class cryptographic and authentication libraries (`passlib[bcrypt]`, `python-jose` / `PyJWT`) required by `FR-01` and `FR-02`, alongside `pytest` for high-coverage unit and integration testing (`NFR-12`).

#### 1.2 Frameworks & Core Libraries

| Layer | Selected Framework / Tool | Role in PassDown | 
| ----- | ----- | ----- | 
| **Backend Web Framework** | **FastAPI** | Exposes the 16 REST endpoints under `/api/v1`, enforces OAuth2 JWT `SecurityScopes`, and auto-generates OpenAPI 3.1 schemas. | 
| **Data Validation & Serialization** | **Pydantic v2** | Validates URL syntax (`https://`), enums (`slides`, `notes`, `past_paper`, `book`, `other`), string lengths, and strips sensitive fields (`password_hash`). | 
| **Database ORM & Persistence** | **SQLAlchemy 2.0 + Supabase PostgreSQL** | Maps the 5 relational entities (`User`, `Course`, `CoreMaterial`, `Contribution`, `Request`) and enforces foreign-key and uniqueness constraints (`NFR-10`). | 
| **Frontend UI Framework** | **React 18 + Vite** | Renders the responsive single-page application (SPA), manages in-memory JWT state (`AuthContext`), and handles role-guarded navigation. | 
| **Frontend Styling** | **Tailwind CSS** | Ensures desktop and mobile viewport responsiveness without horizontal scrolling (`NFR-07`) and enforces Nielsen's 10 Usability Heuristics. | 
| **Automated Testing** | **Pytest + FastAPI TestClient + Vitest** | Executes unit tests on service-layer business rules and integration tests across the Guest/Student/Admin permission matrix. | 

**Justification:**

1. **Built-in Fine-Grained Scope Enforcement:** PassDown requires separate concepts for user roles (`admin`, `student`, `Guest`) and fine-grained security scopes (`courses:write`, `materials:write`, `contributions:moderate`, `contributions:write`, `requests:write` per SRS §3.4). FastAPI's native `SecurityScopes` dependency injection enforces this cleanly at the router/service boundary without boilerplate middleware.

2. **Performance Under Free-Tier Constraints (`NFR-05`):** FastAPI's asynchronous ASGI execution and Vite's lightweight bundle generation ensure that public course browsing and `?search=` queries achieve the required `p95 <= 2.0 seconds` warm response time on Vercel and Supabase free tiers.

### 2. Actions: Coding Standards, Documentation Tool & Architectural Pattern

#### 2.1 Selected Coding Standards \[AI-Assisted\]

Following the dual-standard approach modeled in `JU-High-Fives/Dhar-Hobe` (*Coding Standard 01* & *Coding Standard 02*), the team adopts language-specific standards enforced automatically in CI via linters:

* **Backend (Python / FastAPI):** **PEP 8** + **Google Python Style Guide** (enforced via **Ruff** and **Black**).

* **Frontend (React / TypeScript):** **Airbnb React/TypeScript Style Guide** (enforced via **ESLint** and **Prettier**).

**Key Conventions Summary:**

| Element | Python Backend (`PEP 8`) | TypeScript/React Frontend (`Airbnb`) | PassDown Codebase Example | 
| ----- | ----- | ----- | ----- | 
| **Packages & Modules** | `snake_case` (short, lowercase) | `kebab-case` or `camelCase` | `course_service.py`, `authContext.tsx` | 
| **Classes / ORM Models / Components** | `PascalCase` | `PascalCase` | `CoreMaterial`, `CourseDetailPage.tsx` | 
| **Functions & Methods** | `snake_case` (action verb prefix) | `camelCase` (action verb prefix) | `approve_contribution()`, `fetchCourses()` | 
| **Variables & Parameters** | `snake_case` | `camelCase` | `submitted_by`, `semesterOffered` | 
| **Constants & Security Scopes** | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` | `SCOPE_COURSES_WRITE = "courses:write"` | 
| **Indentation & Line Length** | 4 spaces; max 88 chars (Black/Ruff) | 2 spaces; max 100 chars (Prettier) | Enforced via pre-commit & GitHub Actions | 
| **Type Annotations** | Mandatory on all function signatures | Strict mode (`"strict": true` in `tsconfig.json`) | `def get_course(course_id: int) -> Course:` | 

**Justification:**

* **Consistency Across 4 Developers:** Because all 4 team members touch shared models (`Course`, `User`) and status enums (`pending`, `approved`, `rejected`, `open`, `fulfilled`), strict naming and typing rules prevent integration bugs during Pull Request merges.

* **Automated Code Review Integration:** Pairing PEP 8 / ESLint with GitHub Actions CI allows automated checks on every PR, directly earning the marks for **Utilization of Code Review Tools (10 marks)** and **Source Code Documentation / Coding Standard (10 marks)**.

#### 2.2 Selected Source Code Documentation Tools \[AI-Assisted\]

Following the multi-tool documentation model in `JU-High-Fives/Dhar-Hobe` (*Documentation Tool 1: Sphinx* and *Documentation Tool 2: JSDoc*), PassDown uses three complementary documentation generators matched to our stack:

1. **Primary Backend Documentation Tool — Sphinx (`sphinx` + `sphinx.ext.autodoc` + `sphinx.ext.napoleon` + `sphinx_rtd_theme`):**

   * Parses Google-style Python docstrings (`Args:`, `Returns:`, `Raises:`) from our FastAPI routers, services, repositories, and SQLAlchemy models to generate a static HTML technical reference manual in `docs/build/html`.

2. **Primary Frontend Documentation Tool — TypeDoc / JSDoc (`typedoc`):**

   * Extracts `@param`, `@returns`, and `@example` annotations from React components, custom hooks, and API client functions into browsable HTML documentation.

3. **REST API Contract Documentation — FastAPI Built-in OpenAPI / Swagger UI (`/docs` & `/redoc`):**

   * Automatically generates interactive REST API documentation directly from Pydantic schemas and router docstrings, fulfilling SRS §3.3.2 ("The exact request schemas, response schemas, error shape, and status codes shall be documented in the repository's API documentation or OpenAPI output").

**Justification:**

* **Direct Compatibility with Python + TypeScript:** `Sphinx` is the industry and academic standard for Python projects (and explicitly recommended in the faculty prompt and `Dhar-Hobe` sample repo), while `TypeDoc`/`JSDoc` covers our TypeScript React frontend.

* **Zero Drift Between Code and Docs:** With `sphinx.ext.autodoc` and `napoleon`, updating a function's Google-style docstring or type hint in a service class automatically updates the generated HTML documentation without manual copy-pasting.

#### 2.3 Selected Architectural Pattern \[AI-Assisted\]

* **Selected Pattern:** **Entity–Control–Boundary (ECB) Architectural Pattern** implemented as a **Strict 4-Layer Backend Architecture** (`Routers [Boundary] → Services [Control] → Repositories & Models [Entity]`) paired with a **Component-Based Presentation Layer** (`React SPA [Boundary]`).

```
+-------------------------------------------------------------------------+
|                           BOUNDARY LAYER                                |
|  1. React + TypeScript UI Views (Course Catalogue, Moderation Queue)    |
|  2. FastAPI Routers (/api/v1/auth, /courses, /contributions, /requests) |
|     - Handles HTTP requests/responses, status codes (200/201/401/403/   |
|       404/409), and Pydantic input/output schema validation.            |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            CONTROL LAYER                                |
|  FastAPI Services + RBAC Security Scopes (services/, core/security.py)  |
|  - Enforces all business rules, JWT verification, role/scope checks     |
|    (courses:write, contributions:moderate, etc.), service-layer         |
|    ownership checks (FR-09, FR-12), course deletion dependency checks   |
|    (409 Conflict in FR-04), and status transitions (pending->approved). |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            ENTITY LAYER                                 |
|  Repositories + SQLAlchemy ORM Models (repositories/, models/)          |
|  - Encapsulates PostgreSQL persistence for User, Course, CoreMaterial,  |
|    Contribution, and Request. Enforces FK and uniqueness constraints.   |
+-------------------------------------------------------------------------+

```

**Why ECB / Layered Architecture Was Chosen Over Standard MVC or CQRS:**

1. **Direct Alignment with PassDown SRS (§2.1 & `NFR-09`):** SRS §2.1 explicitly mandates: *"Routers handle HTTP concerns, services enforce business rules, repositories perform database access, and schemas validate/shape data."* This maps 1-to-1 to the **Entity–Control–Boundary (ECB)** pattern:

   * **Boundary:** FastAPI Routers + React Views (interface with external actors: Guest, Student, Admin).

   * **Control:** Service Layer + Security Dependencies (orchestrates use-case workflows, RBAC scopes, ownership validation, and state transitions).

   * **Entity:** Repositories + SQLAlchemy Domain Models (`User`, `Course`, `CoreMaterial`, `Contribution`, `Request`).

2. **Why Better Than Traditional Monolithic MVC for PassDown:** In standard server-rendered MVC (like basic Django templates), business rules and ownership checks often leak into "fat controllers" or views. Because PassDown is a decoupled SPA + REST API where *"the frontend shall not be treated as a security boundary"* (SRS §2.1), isolating all authorization and state-transition logic inside a dedicated **Control (Service) layer** makes every business rule independently unit-testable with `pytest` without spinning up a browser.

3. **Why Better Than CQRS for PassDown:** Command Query Responsibility Segregation (CQRS) splits read and write databases/models for high-throughput event-sourced systems. For a 5-entity university resource platform on a zero-budget free tier (SRS §2.5), CQRS would introduce unnecessary complexity and schema duplication, violating `NFR-09` (which prohibits duplicating shared types inconsistently).

## Part 2: Ready-to-Use GitHub Wiki Pages (Following `JU-High-Fives/Dhar-Hobe` Style)

Below are the exact templates formatted to match the `JU-High-Fives/Dhar-Hobe` Wiki structure so you can paste them directly into your GitHub Wiki pages (`Home`, `Coding-Standard-01`, `Documentation-Tool-1-:-Sphinx`, and `Architectural-Pattern`).

### Wiki Page 1: `Home.md`

```
# Welcome to PassDown — An Academic Resource-Sharing Platform!
*"PassDown — Preview courses, share trusted study materials, and fulfill academic resource requests!"*

## Team Information
**Course:** CSE 451 — Software Engineering  
**Institution:** Department of Computer Science & Engineering, Independent University, Bangladesh (IUB)

### Team Members:
1. **Tanjil Hasan Emon (THE)** — ID: 2331024 *(Member 1: FR-01, FR-02, FR-03)*
2. **Tanjil Sarkar (TS)** — ID: 2312026 *(Member 2: FR-04, FR-05, FR-06)*
3. **Md Jawad Abdullah (MJA)** — ID: 2230325 *(Member 3: FR-07, FR-08, FR-09)*
4. **S M Mashraful Islam (SMMI)** — ID: 2230836 *(Member 4: FR-10, FR-11, FR-12)*

## Quick Navigation (Wiki Index)
* **Software Requirements Specification (SRS)**
* **Software Design Specification (SDS) — UML, Use Case, DFD & State Diagrams**
* **Architectural Pattern (ECB / Layered Architecture)**
* **Coding Standard 01 — Python & FastAPI Backend**
* **Coding Standard 02 — TypeScript & React Frontend**
* **Documentation Tool 1 : Sphinx (Backend Python)**
* **Documentation Tool 2 : TypeDoc / JSDoc (Frontend TypeScript)**
* **CI/CD Pipeline using GitHub Actions**
* **Unit Testing Documentation (Pytest & Coverage Report)**
* **UI Design & Nielsen's 10 Usability Heuristics Evaluation**

```

### Wiki Page 2: `Coding-Standard-01.md` (Python & FastAPI Backend)

````
# Coding Conventions and Guidelines (Backend: Python & FastAPI)
**Author:** Tanjil Hasan Emon (THE) - 2331024

## 1. Overview
PassDown's backend follows **PEP 8** and the **Google Python Style Guide**, enforced automatically via **Ruff** and **Black** in our GitHub Actions CI pipeline.

## 2. Naming Conventions
* **Packages & Modules:** Use short, all-lowercase `snake_case` names (e.g., `auth_router.py`, `course_service.py`, `contribution_repo.py`).
* **Classes & ORM Models:** Use `PascalCase` (e.g., `User`, `CoreMaterial`, `CourseCreateSchema`).
* **Functions & Methods:** Use `snake_case` starting with an action verb (e.g., `register_student()`, `verify_jwt_token()`, `approve_contribution()`).
* **Constants & Security Scopes:** Use `UPPER_SNAKE_CASE` defined once in `app/core/security.py`:
  ```python
  SCOPE_COURSES_WRITE = "courses:write"
  SCOPE_MATERIALS_WRITE = "materials:write"
  SCOPE_CONTRIBUTIONS_MODERATE = "contributions:moderate"
  SCOPE_CONTRIBUTIONS_WRITE = "contributions:write"
  SCOPE_REQUESTS_WRITE = "requests:write"

````

* **Variables:** Use descriptive `snake_case` names (e.g., `password_hash`, `pending_contributions`, `course_id`).

## 3. Code Layout & Formatting

* **Indentation:** 4 spaces per indentation level (never tabs).

* **Line Length:** Maximum 88 characters (formatted automatically by `black` / `ruff format`).

* **Imports:** Grouped in three sections separated by a blank line:

  1. Standard library imports (`datetime`, `typing`, `enum`)

  2. Third-party imports (`fastapi`, `sqlalchemy`, `pydantic`)

  3. Local application imports (`app.models`, `app.services`, `app.schemas`)

## 4. Layer Separation & Error Handling Rules (`NFR-08` & `NFR-09`)

* **Never query the database inside a Router:** Routers only parse HTTP requests and call a `Service` method.

* **Consistent JSON Error Responses:** Raise FastAPI `HTTPException` with explicit status codes (`401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`).

* **Never Echo Secrets:** User response schemas (`UserRead`) must never include `password_hash` (`NFR-01`).

````

### Wiki Page 3: `Documentation-Tool-1-:-Sphinx.md`

```markdown
# Documentation Tool 1 : Sphinx (Python Backend)
**Author:** Tanjil Hasan Emon (THE) - 2331024

## 1. Introduction
### What is Sphinx?
**Sphinx** is an automatic documentation generator for Python that converts structured reStructuredText (`.rst`) and Google-style Python docstrings into browsable HTML and PDF technical documentation.
* **Official Documentation:** https://www.sphinx-doc.org/

### Why Sphinx for PassDown?
PassDown's backend follows a 4-layer Entity-Control-Boundary (ECB) architecture (`Routers -> Services -> Repositories -> Models/Schemas`). Using Sphinx extensions (`sphinx.ext.autodoc`, `sphinx.ext.napoleon`, and `sphinx.ext.viewcode`), every function signature, Pydantic schema, and business rule is automatically extracted into a searchable HTML manual.

## 2. Installation & Setup
```bash
# 1. Install Sphinx and the ReadTheDocs theme
pip install sphinx sphinx-rtd-theme sphinx-autodoc-typehints

# 2. Initialize Sphinx inside the docs/ directory
mkdir docs && cd docs
sphinx-quickstart

````

In `docs/source/conf.py`, enable automatic docstring extraction:

```
import os
import sys
sys.path.insert(0, os.path.abspath('../../backend'))

extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.napoleon',      # Supports Google-style docstrings
    'sphinx.ext.viewcode',      # Adds links to highlighted source code
    'sphinx_autodoc_typehints', # Renders Python 3.11+ type annotations
]
html_theme = 'sphinx_rtd_theme'

```

## 3. Usage Example in PassDown Source Code

Every Service, Repository, and Router method in PassDown uses Google-style docstrings:

```
def delete_course(db: Session, course_id: int) -> None:
    """Deletes a course record if and only if no dependent records exist.

    Enforces SRS FR-04 and Risk Mitigation Policy (§1.6): blocks course deletion
    when dependent Core Materials, Contributions, or Requests exist to prevent
    accidental cascade deletion of student data.

    Args:
        db (Session): Active SQLAlchemy database session.
        course_id (int): Unique identifier of the course to delete.

    Raises:
        HTTPException (404): If no course exists with the given `course_id`.
        HTTPException (409): If the course has dependent CoreMaterials,
            Contributions, or Requests.

    Returns:
        None
    """

```

## 4. Building the HTML Documentation

```
cd docs
make html
# Open docs/build/html/index.html in any browser

```

```

```