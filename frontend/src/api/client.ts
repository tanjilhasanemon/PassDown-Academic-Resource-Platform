import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

export const TOKEN_STORAGE_KEY = "passdown_access_token";
export const REFRESH_STORAGE_KEY = "passdown_refresh_token";
export const AUTH_EXPIRED_EVENT = "passdown:auth-expired";

export function getStoredToken(): string | null {
  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredRefreshToken(): string | null {
  return window.sessionStorage.getItem(REFRESH_STORAGE_KEY);
}

export function setStoredRefreshToken(token: string | null): void {
  if (token) window.sessionStorage.setItem(REFRESH_STORAGE_KEY, token);
  else window.sessionStorage.removeItem(REFRESH_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

const CACHE_TTL_MS = 25000;
const responseCache = new Map<string, { timestamp: number; data: unknown }>();

function getCacheKey(config: InternalAxiosRequestConfig): string {
  const token = getStoredToken() ?? "anon";
  const params = config.params ? JSON.stringify(config.params) : "";
  return `${token}:${config.url ?? ""}:${params}`;
}


type LoadingListener = (activeCount: number) => void;
let activeRequests = 0;
const loadingListeners = new Set<LoadingListener>();

function notifyLoading(delta: number): void {
  activeRequests = Math.max(0, activeRequests + delta);
  loadingListeners.forEach((fn) => fn(activeRequests));
}

export function subscribeNetworkLoading(listener: LoadingListener): () => void {
  loadingListeners.add(listener);
  listener(activeRequests);
  return () => {
    loadingListeners.delete(listener);
  };
}

export function clearApiCache(): void {
  responseCache.clear();
}

apiClient.interceptors.request.use((config) => {
  notifyLoading(1);
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = (config.method ?? "get").toLowerCase();
  if (method !== "get") {
    responseCache.clear();
    return config;
  }

  const key = getCacheKey(config);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    config.adapter = async (): Promise<AxiosResponse> => ({
      data: cached.data,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    });
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    notifyLoading(-1);
    const method = (response.config.method ?? "get").toLowerCase();
    if (method === "get" && response.status === 200) {
      const key = getCacheKey(response.config);
      responseCache.set(key, {
        timestamp: Date.now(),
        data: response.data,
      });
    }
    return response;
  },
  async (error) => {
    notifyLoading(-1);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const origConfig = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
      const requestUrl = origConfig?.url ?? "";
      const isAuthRoute = requestUrl.includes("/auth/login") || requestUrl.includes("/auth/refresh");
      if (!isAuthRoute && origConfig && !origConfig._retry) {
        const refreshTok = getStoredRefreshToken();
        if (refreshTok) {
          origConfig._retry = true;
          try {
            const refreshRes = await axios.post<{ access_token: string; refresh_token?: string }>(
              "/api/v1/auth/refresh",
              { refresh_token: refreshTok }
            );
            setStoredToken(refreshRes.data.access_token);
            if (refreshRes.data.refresh_token) {
              setStoredRefreshToken(refreshRes.data.refresh_token);
            }
            responseCache.clear();
            if (origConfig.headers) {
              origConfig.headers.Authorization = `Bearer ${refreshRes.data.access_token}`;
            }
            return apiClient.request(origConfig);
          } catch {
            // Fall through to full sign-out
          }
        }
        const hadToken = Boolean(getStoredToken() || getStoredRefreshToken());
        setStoredToken(null);
        setStoredRefreshToken(null);
        responseCache.clear();
        if (hadToken) {
          window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Converts API or network failures into plain-language diagnostic messages
 * with actionable recovery steps (Nielsen Heuristic H9).
 *
 * @param error - Unknown thrown error from Axios or runtime code.
 * @returns Clear, user-friendly explanation without raw HTTP status jargon.
 */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string | Array<{ loc?: (string | number)[]; msg?: string }> }
      | undefined;

    if (typeof data?.detail === "string" && data.detail.trim().length > 0) {
      return data.detail;
    }

    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      return data.detail
        .map((err) => {
          const field = err.loc?.[err.loc.length - 1];
          const cleanMsg = (err.msg ?? "Invalid value").replace(
            /^Value error,\s*/i,
            "",
          );
          return field ? `${String(field)}: ${cleanMsg}` : cleanMsg;
        })
        .join(" • ");
    }

    const status = error.response?.status;
    if (status === 401) {
      return "Your session has expired or credentials are invalid. Please sign in again.";
    }
    if (status === 403) {
      return "You do not have permission to perform this action. Sign in with an authorized account.";
    }
    if (status === 404) {
      return "The requested course or resource could not be found. It may have been removed.";
    }
    if (status === 409) {
      return "This item already exists or conflicts with an existing record. Please review and try again.";
    }
    if (status === 422) {
      return "Some fields are invalid or incomplete. Check highlighted values and try again.";
    }
    if (status === 423) {
      return "This account is temporarily locked after repeated failed attempts. Wait 15 minutes or contact an Admin.";
    }
    if (status && status >= 500) {
      return "The PassDown server ran into a temporary issue. Please wait a moment and click Retry.";
    }
    if (error.code === "ERR_NETWORK" || !error.response) {
      return "Unable to reach the PassDown server. Check your internet connection and click Retry.";
    }
  }
  return "Something unexpected happened. Please refresh or try again.";
}
