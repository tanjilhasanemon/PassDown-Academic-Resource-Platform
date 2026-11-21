import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth } from "./AuthContext";
import type { UserRole } from "../types";

export function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="empty-state">Verifying permissions...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <section className="hero-banner" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
        <span className="badge badge-danger" style={{ marginBottom: "1rem" }}>
          <ShieldAlert size={15} /> 403 Forbidden • Not Authorized
        </span>
        <h1 className="hero-title">Not Authorized</h1>
        <p className="hero-subtitle" style={{ margin: "0 auto 1.5rem" }}>
          Your account (<strong>{user.email}</strong>, role: <code>{user.role}</code>) does not have
          the required administrator permissions to view this page.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/dashboard" className="btn btn-primary">
            Go to My Dashboard
          </Link>
          <Link to="/" className="btn btn-secondary">
            <ArrowLeft size={15} /> Back to Courses
          </Link>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
