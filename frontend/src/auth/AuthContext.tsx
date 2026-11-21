import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import {
  AUTH_EXPIRED_EVENT,
  getStoredToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
  setStoredToken,
} from "../api/client";
import { meApi } from "../api/me";
import { useToast } from "../components/ToastContext";
import type { RegisterPayload, User } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await meApi.getProfile();
      setUser(profile);
      setToken(currentToken);
    } catch {
      setStoredToken(null);
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setToken(null);
      showToast("Session expired or unauthorized. Please log in again.", "info");
      navigate("/login", { replace: true });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [navigate, showToast]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const tokenRes = await authApi.login(email, password);
    setStoredToken(tokenRes.access_token);
    if (tokenRes.refresh_token) setStoredRefreshToken(tokenRes.refresh_token);
    setToken(tokenRes.access_token);
    const profile = await meApi.getProfile();
    setUser(profile);
    return profile;
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<User> => {
    return authApi.register(payload);
  }, []);

  const logout = useCallback(() => {
    const rt = getStoredRefreshToken();
    void authApi.logout(rt).catch(() => {});
    setStoredToken(null);
    setStoredRefreshToken(null);
    setUser(null);
    setToken(null);
    showToast("Signed out", "info");
    navigate("/");
  }, [navigate, showToast]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(user && token),
        isAdmin: user?.role === "admin",
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {loading ? (
        <div className="session-loader-screen">
          <div className="session-loader-ring" />
          <span className="session-loader-label">Loading PassDown…</span>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
