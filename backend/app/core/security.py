"""Shared Role and Security Scope Constants (SRS §3.4 & NFR-09).

Defines role names and fine-grained security scopes in one canonical module.
"""

ROLE_ADMIN = "admin"
ROLE_STUDENT = "student"
ROLE_GUEST = "guest"

SCOPE_COURSES_WRITE = "courses:write"
SCOPE_MATERIALS_WRITE = "materials:write"
SCOPE_CONTRIBUTIONS_MODERATE = "contributions:moderate"
SCOPE_CONTRIBUTIONS_WRITE = "contributions:write"
SCOPE_REQUESTS_WRITE = "requests:write"

ROLE_SCOPES: dict[str, list[str]] = {
    ROLE_ADMIN: [
        SCOPE_COURSES_WRITE,
        SCOPE_MATERIALS_WRITE,
        SCOPE_CONTRIBUTIONS_MODERATE,
        SCOPE_CONTRIBUTIONS_WRITE,
        SCOPE_REQUESTS_WRITE,
    ],
    ROLE_STUDENT: [
        SCOPE_CONTRIBUTIONS_WRITE,
        SCOPE_REQUESTS_WRITE,
    ],
    ROLE_GUEST: [],
}
