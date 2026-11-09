/**
 * Shared TypeScript API Contracts & Security Scope Constants (ECB Boundary Layer).
 *
 * Mirrors the backend Pydantic v2 schemas in `app/schemas/` and security scopes in
 * `app/core/security.py` to satisfy PassDown SRS NFR-09.
 *
 * @module types/api
 * @author Tanjil Hasan Emon (THE - 2331024)
 */

/** Application roles defined in SRS §2.2 and §3.4. */
export type UserRole = "guest" | "student" | "admin";

/** Fine-grained RBAC security scopes defined in SRS §3.4. */
export const SECURITY_SCOPES = {
  COURSES_WRITE: "courses:write",
  MATERIALS_WRITE: "materials:write",
  CONTRIBUTIONS_MODERATE: "contributions:moderate",
  CONTRIBUTIONS_WRITE: "contributions:write",
  REQUESTS_WRITE: "requests:write",
} as const;

export type SecurityScope =
  (typeof SECURITY_SCOPES)[keyof typeof SECURITY_SCOPES];

/** Resource types accepted by Contribution submission and editing (FR-07, FR-09). */
export type ContributionType =
  | "slides"
  | "notes"
  | "past_paper"
  | "book"
  | "other";

/** Payload sent when submitting or editing a Contribution (FR-07, FR-09). */
export interface ContributionPayload {
  title: string;
  type: ContributionType;
  url: string;
  description?: string | null;
}

/** Editable fields for an existing pending Contribution (FR-09). */
export type ContributionUpdatePayload = ContributionPayload;

/** Response returned after an authenticated contribution submission (FR-07). */
export interface ContributionSubmission
  extends Omit<ContributionPayload, "description"> {
  id: number;
  course_id: number;
  submitted_by: number;
  description: string | null;
  status: string;
  created_at: string;
}

/** Pending contribution metadata returned to authorized Admin moderators (FR-08). */
export interface ContributionModerationItem extends ContributionSubmission {
  course: CourseSummary;
  submitter: UserProfile;
}

/** Safe user profile returned by `/api/v1/auth/register` and `/api/v1/auth/me` (FR-01). */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: "student" | "admin";
  created_at: string;
}

/** Payload sent to `POST /api/v1/auth/register` (FR-01). */
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

/** Payload sent to `POST /api/v1/auth/login` (FR-02). */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Signed JWT session response from `POST /api/v1/auth/login` (FR-02). */
export interface TokenSessionResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  role: "student" | "admin";
  scopes: SecurityScope[];
  user: UserProfile;
}

/** Response from `/api/v1/auth/scopes/*` verification endpoints (FR-02). */
export interface ScopeVerificationResult {
  authorized: boolean;
  user_id: number;
  role: string;
  verified_scope: string;
}

/** Summary Course item returned by `GET /api/v1/courses` (FR-03). */
export interface CourseSummary {
  id: number;
  code: string;
  title: string;
  department: string;
  semester_offered: string;
  created_at: string;
}

/** Hypermedia resource section links inside CourseDetail (FR-03). */
export interface CourseResourceLinks {
  core_materials: string;
  approved_contributions: string;
  requests: string;
}

/** Detailed Course record returned by `GET /api/v1/courses/{id}` (FR-03). */
export interface CourseDetail extends CourseSummary {
  resource_links: CourseResourceLinks;
}

/** Request returned by `POST /api/v1/courses/{id}/requests` (FR-10). */
export interface ResourceRequest {
  id: number;
  course_id: number;
  submitted_by: number;
  description: string;
  status: string;
  created_at: string;
}

/** Public request fields returned by `GET /api/v1/courses/{id}/requests` (FR-11). */
export interface PublicResourceRequest {
  id: number;
  submitted_by: number;
  description: string;
  status: string;
  author_name: string;
  created_at: string;
}
