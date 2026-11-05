/**
 * In-Memory Authentication & RBAC Scope Context (SRS §2.7, FR-01 & FR-02).
 *
 * Manages the active user profile, role ('guest' | 'student' | 'admin'),
 * fine-grained JWT scopes, and automatic 401 session cleanup without ever
 * writing sensitive tokens to `localStorage`.
 *
 * @module context/AuthContext
 * @author Tanjil Hasan Emon (THE - 2331024)
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  fetchCurrentUserProfile,
  getInMemoryToken,
  loginWithCredentials,
  registerUnauthorizedInterceptor,
  setInMemoryToken,
} from "../services/apiClient";
import type {
  LoginPayload,
  SecurityScope,
  TokenSessionResponse,
  UserProfile,
  UserRole,
} from "../types/api";

export interface AuthContextValue {
  user: UserProfile | null;
  role: UserRole;
  scopes: SecurityScope[];
  tokenPreview: string | null;
  sessionNotice: string | null;
  login: (payload: LoginPayload) => Promise<TokenSessionResponse>;
  logout: (notice?: string) => void;
  refreshProfileFromMe: () => Promise<UserProfile>;
  clearSessionNotice: () => void;
  simulate401Expiration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides reactive authentication and RBAC scope state across the React tree.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [scopes, setScopes] = useState<SecurityScope[]>([]);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    registerUnauthorizedInterceptor((reason: string) => {
      setUser(null);
      setScopes([]);
      setTokenPreview(null);
      setSessionNotice(reason);
    });
  }, []);

  const login = async (payload: LoginPayload): Promise<TokenSessionResponse> => {
    setSessionNotice(null);
    const session = await loginWithCredentials(payload);
    setUser(session.user);
    setScopes(session.scopes);
    const raw = getInMemoryToken();
    setTokenPreview(raw ? `${raw.slice(0, 18)}...${raw.slice(-10)}` : null);
    return session;
  };

  const logout = (notice?: string): void => {
    setInMemoryToken(null);
    setUser(null);
    setScopes([]);
    setTokenPreview(null);
    if (notice) {
      setSessionNotice(notice);
    }
  };

  const refreshProfileFromMe = async (): Promise<UserProfile> => {
    const profile = await fetchCurrentUserProfile();
    setUser(profile);
    return profile;
  };

  const simulate401Expiration = async (): Promise<void> => {
    setInMemoryToken("expired.or.tampered.jwt.token");
    try {
      await fetchCurrentUserProfile();
    } catch {
      // Interceptor automatically clears state and sets sessionNotice
    }
  };

  const role: UserRole = user ? user.role : "guest";

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        scopes,
        tokenPreview,
        sessionNotice,
        login,
        logout,
        refreshProfileFromMe,
        clearSessionNotice: () => setSessionNotice(null),
        simulate401Expiration,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook returning the active authentication and RBAC context.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
