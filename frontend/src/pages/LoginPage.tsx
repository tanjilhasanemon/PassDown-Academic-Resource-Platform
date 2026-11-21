import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, LogIn, ShieldCheck, UserCheck } from "lucide-react";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";

export function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/dashboard";

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const loggedInUser = await login(loginEmail, loginPassword);
      showToast(`Welcome back, ${loggedInUser.name}!`, "success");
      const target =
        loggedInUser.role === "admin"
          ? "/admin"
          : from && from !== "/login" && !from.startsWith("/admin")
            ? from
            : "/dashboard";
      navigate(target, { replace: true });
    } catch (err) {
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await performLogin(email, password);
  };

  return (
    <div style={{ maxWidth: "460px", margin: "1.5rem auto" }}>
      <div className="glass-card" style={{ padding: "2rem" }}>
        <div>
          <span className="hero-eyebrow">
            <KeyRound size={13} /> OAuth2 + JWT Authentication
          </span>
          <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.6rem", fontWeight: 800 }}>
            Sign in to PassDown
          </h1>
          <p style={{ margin: "0 0 1.4rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Log in with your email and password to contribute materials, post requests, or
            manage your dashboard.
          </p>

          {errorMsg && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: "var(--danger-bg)",
                color: "var(--danger)",
                fontSize: "0.86rem",
                fontWeight: 600,
                marginBottom: "1rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-input"
                required
                placeholder="e.g. name@domain.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  style={{ width: "100%", boxSizing: "border-box", paddingRight: "2.6rem" }}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "0.65rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.25rem",
                    zIndex: 2,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: "100%", marginTop: "0.4rem" }}
            >
              <LogIn size={16} />
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <div
            style={{
              marginTop: "1.35rem",
              paddingTop: "1.1rem",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                fontSize: "0.76rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                marginBottom: "0.65rem",
              }}
            >
              Quick Demo Accounts (1-Click Sign In)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={submitting}
                onClick={() => {
                  setEmail("admin@passdown.edu");
                  setPassword("Admin1234");
                  void performLogin("admin@passdown.edu", "Admin1234");
                }}
              >
                <ShieldCheck size={14} /> Demo Admin
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={submitting}
                onClick={() => {
                  setEmail("student@passdown.edu");
                  setPassword("Student1234");
                  void performLogin("student@passdown.edu", "Student1234");
                }}
              >
                <UserCheck size={14} /> Demo Student
              </button>
            </div>
          </div>

          <p
            style={{
              margin: "1.25rem 0 0",
              textAlign: "center",
              fontSize: "0.88rem",
              color: "var(--text-secondary)",
            }}
          >
            Don&apos;t have an account yet?{" "}
            <Link
              to="/register"
              style={{ color: "var(--accent-primary)", fontWeight: 700 }}
            >
              Create a student account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
