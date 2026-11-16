/**
 * Shared TypeScript API Contracts & Role-Based Permission Scopes.
 *
 * Mirrors the backend Pydantic v2 schemas and OAuth2 security scopes for
 * end-to-end type safety across the React client.
 *
 * @module types/api
 */

/** Application roles supported by the platform. */
export type UserRole = "guest" | "student" | "admin";

/** Fine-grained OAuth2 permission scopes embedded in signed JWTs. */
export const SECURITY_SCOPES = {
  COURSES_WRITE: "courses:write",
  MATERIALS_WRITE: "materials:write",
  CONTRIBUTIONS_MODERATE: "contributions:moderate",
  CONTRIBUTIONS_WRITE: "contributions:write",
  REQUESTS_WRITE: "requests:write",
} as const;

export type SecurityScope =
  (typeof SECURITY_SCOPES)[keyof typeof SECURITY_SCOPES];

/** Supported academic resource categories. */
export type ContributionType =
  | "slides"
  | "notes"
  | "past_paper"
  | "book"
  | "other";

/** Payload for submitting a new community contribution. */
export interface ContributionPayload {
  title: string;
  type: ContributionType;
  url: string;
  description?: string | null;
}

/** Editable fields for a pending community contribution. */
export type ContributionUpdatePayload = ContributionPayload;

/** Persisted community contribution record returned by the API. */
export interface ContributionSubmission
  extends Omit<ContributionPayload, "description"> {
  id: number;
  course_id: number;
  submitted_by: number;
  description: string | null;
  status: string;
  created_at: string;
}

/** Pending contribution record enriched with course and submitter details for moderation. */
export interface ContributionModerationItem extends ContributionSubmission {
  course: CourseSummary;
  submitter: UserProfile;
}

/** Public-safe user profile returned by authentication endpoints. */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: "student" | "admin";
  created_at: string;
}

/** Payload sent when registering a student account. */
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

/** Payload sent when authenticating with email and password. */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Signed JWT session payload returned upon successful sign-in. */
export interface TokenSessionResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  role: "student" | "admin";
  scopes: SecurityScope[];
  user: UserProfile;
}

/** Result returned by scope verification endpoints. */
export interface ScopeVerificationResult {
  authorized: boolean;
  user_id: number;
  role: string;
  verified_scope: string;
}

/** Summary course record returned by the public catalogue endpoint. */
export interface CourseSummary {
  id: number;
  code: string;
  title: string;
  department: string;
  semester_offered: string;
  created_at: string;
}

/** Hypermedia links to a course's nested resource collections. */
export interface CourseResourceLinks {
  core_materials: string;
  approved_contributions: string;
  requests: string;
}

/** Detailed course record including hypermedia resource links. */
export interface CourseDetail extends CourseSummary {
  resource_links: CourseResourceLinks;
}

/** Persisted resource request record. */
export interface ResourceRequest {
  id: number;
  course_id: number;
  submitted_by: number;
  description: string;
  status: string;
  created_at: string;
}

/** Public resource request item enriched with the author's display name. */
export interface PublicResourceRequest {
  id: number;
  submitted_by: number;
  description: string;
  status: string;
  author_name: string;
  created_at: string;
}

/** Curated core course material record. */
export interface CoreMaterial {
  id: number;
  course_id: number;
  title: string;
  type: ContributionType;
  url: string;
  description: string | null;
  created_at: string;
}

/** Payload for creating or updating a curated core material. */
export interface CoreMaterialPayload {
  title: string;
  type: ContributionType;
  url: string;
  description?: string | null;
}

/** Payload for creating or updating an academic course. */
export interface CourseUpdatePayload {
  code?: string;
  title?: string;
  department?: string;
  semester_offered?: string;
}
