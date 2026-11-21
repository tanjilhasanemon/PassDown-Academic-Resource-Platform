# Security Policy

## Supported Versions

| Version | Release Stage | Supported |
| ------- | ------------- | --------- |
| `0.1.x` | MVP (`v0.1.0`) | Yes |
| `0.2.x` | Beta (`v0.2.0` - Planned) | Yes |

## Security Measures in PassDown

PassDown is designed with layered security controls documented in [`docs/02-srs.md`](./docs/02-srs.md) and [`docs/03-tdd.md`](./docs/03-tdd.md):

- **SQL Injection Prevention (`NFR-03`)**: All database queries use SQLAlchemy 2.0 ORM with bound parameters; raw string-concatenated SQL is strictly prohibited.
- **Malicious Link Protection (`NFR-04`)**: Pydantic v2 schemas validate that all submitted material and contribution URLs use `http://` or `https://` schemes (`javascript:` and `data:` URIs are rejected with `422 Unprocessable Entity`), and all external links render with `target="_blank"` and `rel="noopener noreferrer"`.
- **Secret Management (`NFR-14`)**: Database credentials and secrets are loaded exclusively via environment variables (`DATABASE_URL`) and are never committed to version control.
- **Authentication & RBAC (Beta `v0.2.0`)**: Passwords are hashed using Argon2id (`NFR-12`), endpoints are protected with short-lived HS256 JWTs and FastAPI `SecurityScopes`, and repeated failed logins trigger temporary account lockouts (`FR-31`).

## Reporting a Vulnerability

If you discover a security vulnerability in PassDown:

1. **Do not open a public issue** containing live exploit details or sensitive credentials.
2. Report the finding directly to the repository owner (**Tanjil Hasan Emon**) via GitHub's private vulnerability reporting or by contacting the author through [`github.com/tanjilhasanemon`](https://github.com/tanjilhasanemon).
3. Include steps to reproduce, the affected endpoint or component, and the potential impact. You will receive an acknowledgment within 48 hours.
