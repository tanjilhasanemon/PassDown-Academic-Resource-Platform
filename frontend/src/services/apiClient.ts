/**
 * HTTP Transport Client with In-Memory Bearer Token & 401 Interceptor (SRS §2.7 & FR-02).
 *
 * Strictly avoids `localStorage` for JWT persistence per SRS §2.7. Attaches the
 * active in-memory Bearer token and triggers registered 401 session-clear listeners
 * whenever an endpoint returns HTTP 401 Unauthorized.
 *
 * @module services/apiClient
 * @author Tanjil Hasan Emon (THE - 2331024)
 */

import type {
  CourseDetail,
  CourseSummary,
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

/** In-memory JWT storage (never persisted in localStorage per SRS §2.7). */
let inMemoryAccessToken: string | null = null;

/** Registered callback invoked automatically when a 401 response is intercepted. */
let onUnauthorizedCallback: ((reason: string) => void) | null = null;

/**
 * Sets or clears the active JWT access token in memory.
 *
 * @param token - Signed JWT string or null to clear.
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
 * Registers the response interceptor callback triggered on HTTP 401 responses (FR-02).
 *
 * @param listener - Callback that clears frontend session state and prompts re-login.
 */
export function registerUnauthorizedInterceptor(
  listener: (reason: string) => void
): void {
  onUnauthorizedCallback = listener;
}

/** Structured API error carrying HTTP status code and user-friendly message. */
export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Executes a typed HTTP request against the FastAPI `/api/v1` backend with
 * automatic Bearer token injection and 401 Unauthorized interception.
 *
 * @param path - Endpoint path relative to `/api/v1`.
 * @param options - Standard Fetch RequestInit options.
 * @param skipInterceptor - If true, suppresses global session reset (used on login).
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
 * Registers a new Student account via `POST /api/v1/auth/register` (FR-01).
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
 * Authenticates credentials via `POST /api/v1/auth/login` and stores JWT in memory (FR-02).
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
 * Fetches the authenticated user's safe profile via `GET /api/v1/auth/me` (FR-01).
 */
export async function fetchCurrentUserProfile(): Promise<UserProfile> {
  return request<UserProfile>("/auth/me", { method: "GET" });
}

/**
 * Tests a specific RBAC security scope endpoint on the backend (FR-02 live verification).
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
 * Lists public courses with optional `?search=` filter via `GET /api/v1/courses` (FR-03).
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
 * Fetches a single course's detail and resource links via `GET /api/v1/courses/{id}` (FR-03).
 */
export async function fetchCourseDetailById(
  courseId: number
): Promise<CourseDetail> {
  return request<CourseDetail>(`/courses/${courseId}`, { method: "GET" }, true);
}

/**
 * Submits an authenticated user's resource request for a course (FR-10).
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
 * Lists public requests for a course without requiring an authenticated session (FR-11).
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
 * Marks an owned or Admin-managed request fulfilled (FR-12).
 */
export async function fulfillCourseRequest(
  requestId: number
): Promise<ResourceRequest> {
  return request<ResourceRequest>(`/requests/${requestId}/fulfill`, {
    method: "PATCH",
  });
}

/**
 * Deletes an owned or Admin-managed request (FR-12).
 */
export async function deleteCourseRequest(requestId: number): Promise<void> {
  return request<void>(`/requests/${requestId}`, { method: "DELETE" });
}
