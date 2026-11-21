import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Sparkles, UserPlus, XCircle } from "lucide-react";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";

export function RegisterPage() {
  const { register, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasMinLen = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const passwordValid = hasMinLen && hasLetter && hasDigit;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordValid) {
      const msg = "Password must be at least 8 characters with at least 1 letter and 1 digit.";
      setErrorMsg(msg);
      showToast(msg, "error");
      return;
    }
    if (password !== confirmPassword) {
      const msg = "Passwords do not match.";
      setErrorMsg(msg);
      showToast(msg, "error");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await register({ name, email, password });
      await login(email, password);
      showToast("Account created! Welcome to PassDown.", "success");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "1.5rem auto" }}>
      <div className="glass-card" style={{ padding: "2rem" }}>
        <div>
          <span className="hero-eyebrow">
            <Sparkles size={13} /> Student Registration
          </span>
          <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.6rem", fontWeight: 800 }}>
            Create Your Account
          </h1>
          <p style={{ margin: "0 0 1.4rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Register a student account to contribute study links, request missing
            course materials, and collaborate in study groups.
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

          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="form-group">
              <label className="form-label">Full Name (2–100 chars) *</label>
              <input
                type="text"
                name="register_full_name"
                autoComplete="name"
                className="form-input"
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. Sayef Reyadh"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                name="register_email"
                autoComplete="off"
                className="form-input"
                required
                maxLength={254}
                placeholder="e.g. name@domain.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Password (min 8 chars, at least 1 letter &amp; 1 digit) *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="register_new_password"
                  autoComplete="new-password"
                  className="form-input"
                  style={{ paddingRight: "2.6rem" }}
                  required
                  minLength={8}
                  maxLength={128}
                  placeholder="At least 8 characters with 1 letter & 1 digit"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "0.55rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.25rem",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {password.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.28rem", marginTop: "0.5rem", fontSize: "0.78rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: hasMinLen ? "var(--success)" : "var(--danger)" }}>
                    {hasMinLen ? <CheckCircle2 size={13} /> : <XCircle size={13} />} At least 8 characters
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: hasLetter ? "var(--success)" : "var(--danger)" }}>
                    {hasLetter ? <CheckCircle2 size={13} /> : <XCircle size={13} />} Contains at least 1 letter (A–Z)
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: hasDigit ? "var(--success)" : "var(--danger)" }}>
                    {hasDigit ? <CheckCircle2 size={13} /> : <XCircle size={13} />} Contains at least 1 digit (0–9)
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="register_confirm_password"
                  autoComplete="new-password"
                  className="form-input"
                  style={{ width: "100%", boxSizing: "border-box", paddingRight: "2.6rem" }}
                  required
                  minLength={8}
                  maxLength={128}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
              {confirmPassword.length > 0 && (
                <div style={{ marginTop: "0.4rem", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "0.35rem", color: passwordsMatch ? "var(--success)" : "var(--danger)" }}>
                  {passwordsMatch ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (password.length > 0 && !passwordValid) || (confirmPassword.length > 0 && !passwordsMatch)}
              style={{ width: "100%", marginTop: "0.35rem" }}
            >
              <UserPlus size={16} />
              {submitting ? "Creating account..." : "Register Account"}
            </button>
          </form>

          <p
            style={{
              margin: "1.25rem 0 0",
              textAlign: "center",
              fontSize: "0.88rem",
              color: "var(--text-secondary)",
            }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              style={{ color: "var(--accent-primary)", fontWeight: 700 }}
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
