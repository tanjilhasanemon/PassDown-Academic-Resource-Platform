/**
 * HTTP Transport Client with In-Memory Bearer Token & Automatic 401 Interception.
 *
 * Holds the active JWT access token strictly in JavaScript memory, attaches
 * the Authorization header to outgoing requests, and invokes registered session
 * listeners when an endpoint returns HTTP 401 Unauthorized.
 *
 * @module services/apiClient
 */

import type {
  ContributionModerationItem,
  ContributionPayload,
  ContributionSubmission,
  ContributionUpdatePayload,
  CoreMaterial,
  CoreMaterialPayload,
  CourseDetail,
  CourseSummary,
  CourseUpdatePayload,
  LoginPayload,
  PublicResourceRequest,
  RegisterPayload,
  ResourceRequest,
  ScopeVerificationResult,
  TokenSessionResponse,
  UserProfile,
} from "../types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

/** In-memory JWT storage (never persisted in localStorage). */
let inMemoryAccessToken: string | null = null;

/** Callback invoked automatically when a 401 response is intercepted. */
let onUnauthorizedCallback: ((reason: string) => void) | null = null;

/**
 * Sets or clears the active JWT access token in memory.
 */
export function setInMemoryToken(token: string | null): void {
  inMemoryAccessToken = token;
}

/**
 * Returns the currently active in-memory JWT token, if any.
 */
export function getInMemoryToken(): string | null {
  return inMemoryAccessToken;
}

/**
 * Registers the response interceptor callback triggered on HTTP 401 responses.
 */
export function registerUnauthorizedInterceptor(
  listener: (reason: string) => void
): void {
  onUnauthorizedCallback = listener;
}

/** Structured API error carrying HTTP status code and user-facing detail message. */
export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Executes a typed HTTP request against the `/api/v1` backend with automatic
 * Bearer token injection and 401 Unauthorized interception.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  skipInterceptor = false
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (inMemoryAccessToken) {
    headers.set("Authorization", `Bearer ${inMemoryAccessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !skipInterceptor) {
    inMemoryAccessToken = null;
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback(
        "Session expired – your login session has timed out. Please sign in again."
      );
    }
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (typeof errJson.detail === "string") {
        errorMessage = errJson.detail;
      } else if (Array.isArray(errJson.detail) && errJson.detail.length > 0) {
        errorMessage = errJson.detail
          .map((e: { msg?: string }) => e.msg || "Validation error")
          .join("; ");
      }
    } catch {
      // Fallback to status message if body is not JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Registers a new Student account via `POST /api/v1/auth/register`.
 */
export async function registerStudentAccount(
  payload: RegisterPayload & { role?: string }
): Promise<UserProfile> {
  return request<UserProfile>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true
  );
}

/**
 * Authenticates credentials via `POST /api/v1/auth/login` and stores JWT in memory.
 */
export async function loginWithCredentials(
  payload: LoginPayload
): Promise<TokenSessionResponse> {
  const session = await request<TokenSessionResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true
  );
  setInMemoryToken(session.access_token);
  return session;
}

/**
 * Fetches the authenticated user's profile via `GET /api/v1/auth/me`.
 */
export async function fetchCurrentUserProfile(): Promise<UserProfile> {
  return request<UserProfile>("/auth/me", { method: "GET" });
}

/**
 * Verifies a specific security scope endpoint on the backend.
 */
export async function verifySecurityScopeEndpoint(
  scopeEndpointSlug: string
): Promise<ScopeVerificationResult> {
  return request<ScopeVerificationResult>(
    `/auth/scopes/${scopeEndpointSlug}`,
    { method: "GET" },
    true
  );
}

/**
 * Lists public courses with optional `?search=` filter via `GET /api/v1/courses`.
 */
export async function fetchPublicCourses(
  search?: string
): Promise<CourseSummary[]> {
  const query =
    search && search.trim().length > 0
      ? `?search=${encodeURIComponent(search.trim())}`
      : "";
  return request<CourseSummary[]>(`/courses${query}`, { method: "GET" }, true);
}

/**
 * Fetches a single course's metadata and resource links via `GET /api/v1/courses/{id}`.
 */
export async function fetchCourseDetailById(
  courseId: number
): Promise<CourseDetail> {
  return request<CourseDetail>(`/courses/${courseId}`, { method: "GET" }, true);
}

/**
 * Creates a new academic course (Admin only).
 */
export async function createCourse(
  payload: CourseUpdatePayload
): Promise<CourseSummary> {
  return request<CourseSummary>("/courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Updates an existing academic course (Admin only).
 */
export async function updateCourse(
  courseId: number,
  payload: CourseUpdatePayload
): Promise<CourseSummary> {
  return request<CourseSummary>(`/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Deletes an existing course when no dependent records exist (Admin only).
 */
export async function deleteCourse(courseId: number): Promise<void> {
  return request<void>(`/courses/${courseId}`, { method: "DELETE" });
}

/**
 * Lists public core materials for a course, optionally filtered by type.
 */
export async function fetchCoreMaterials(
  courseId: number,
  typeFilter?: string
): Promise<CoreMaterial[]> {
  const query =
    typeFilter && typeFilter !== "all"
      ? `?material_type=${encodeURIComponent(typeFilter)}`
      : "";
  return request<CoreMaterial[]>(
    `/courses/${courseId}/core-materials${query}`,
    { method: "GET" },
    true
  );
}

/**
 * Publishes a new core material for a course (Admin only).
 */
export async function addCoreMaterial(
  courseId: number,
  payload: CoreMaterialPayload
): Promise<CoreMaterial> {
  return request<CoreMaterial>(`/courses/${courseId}/core-materials`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Updates an existing core material (Admin only).
 */
export async function updateCoreMaterial(
  materialId: number,
  payload: Partial<CoreMaterialPayload>
): Promise<CoreMaterial> {
  return request<CoreMaterial>(`/core-materials/${materialId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Deletes an existing core material (Admin only).
 */
export async function deleteCoreMaterial(materialId: number): Promise<void> {
  return request<void>(`/core-materials/${materialId}`, { method: "DELETE" });
}

/**
 * Lists approved community contributions for a course, optionally filtered by type.
 */
export async function fetchApprovedContributions(
  courseId: number,
  typeFilter?: string
): Promise<ContributionSubmission[]> {
  const query =
    typeFilter && typeFilter !== "all"
      ? `?material_type=${encodeURIComponent(typeFilter)}`
      : "";
  return request<ContributionSubmission[]>(
    `/courses/${courseId}/contributions${query}`,
    { method: "GET" },
    true
  );
}

/**
 * Submits a new pending community contribution for a course.
 */
export async function submitCourseContribution(
  courseId: number,
  payload: ContributionPayload
): Promise<ContributionSubmission> {
  return request<ContributionSubmission>(
    `/courses/${courseId}/contributions`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Lists all pending community contributions for the Admin moderation queue.
 */
export async function fetchPendingContributions(): Promise<
  ContributionModerationItem[]
> {
  return request<ContributionModerationItem[]>("/contributions/pending", {
    method: "GET",
  });
}

/**
 * Approves a pending community contribution (Admin only).
 */
export async function approveContribution(
  contributionId: number
): Promise<ContributionSubmission> {
  return request<ContributionSubmission>(
    `/contributions/${contributionId}/approve`,
    { method: "PATCH" }
  );
}

/**
 * Rejects a pending community contribution (Admin only).
 */
export async function rejectContribution(
  contributionId: number
): Promise<ContributionSubmission> {
  return request<ContributionSubmission>(
    `/contributions/${contributionId}/reject`,
    { method: "PATCH" }
  );
}

/**
 * Lists the authenticated user's own submitted contributions.
 */
export async function fetchMyContributions(): Promise<ContributionSubmission[]> {
  return request<ContributionSubmission[]>("/contributions/mine", {
    method: "GET",
  });
}

/**
 * Updates an owned pending contribution.
 */
export async function updateMyContribution(
  contributionId: number,
  payload: ContributionUpdatePayload
): Promise<ContributionSubmission> {
  return request<ContributionSubmission>(`/contributions/${contributionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Withdraws an owned pending contribution or deletes a contribution as Admin.
 */
export async function deleteContribution(
  contributionId: number
): Promise<void> {
  return request<void>(`/contributions/${contributionId}`, {
    method: "DELETE",
  });
}

/**
 * Submits a resource request for a course.
 */
export async function createCourseRequest(
  courseId: number,
  description: string
): Promise<ResourceRequest> {
  return request<ResourceRequest>(`/courses/${courseId}/requests`, {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}

/**
 * Lists public resource requests for a course.
 */
export async function fetchCourseRequests(
  courseId: number
): Promise<PublicResourceRequest[]> {
  return request<PublicResourceRequest[]>(
    `/courses/${courseId}/requests`,
    { method: "GET" },
    true
  );
}

/**
 * Marks an open resource request as fulfilled.
 */
export async function fulfillCourseRequest(
  requestId: number
): Promise<ResourceRequest> {
  return request<ResourceRequest>(`/requests/${requestId}/fulfill`, {
    method: "PATCH",
  });
}

/**
 * Deletes an owned or Admin-managed resource request.
 */
export async function deleteCourseRequest(requestId: number): Promise<void> {
  return request<void>(`/requests/${requestId}`, { method: "DELETE" });
}