import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  courses: "Course Detail",
  dashboard: "Student Workspace",
  groups: "Study Groups",
  admin: "Admin Hub",
  materials: "Core Materials",
  moderation: "Moderation Queue",
  about: "About & Help",
  login: "Sign In",
  register: "Register",
};

/**
 * Renders accessible breadcrumb navigation on sub-pages to orient users
 * and provide a one-click return path to the Course Catalog (Nielsen H1 & H3).
 */
export function Breadcrumbs() {
  const location = useLocation();
  if (location.pathname === "/") {
    return null;
  }

  const segments = location.pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; to: string }> = [];

  let accumulated = "";
  segments.forEach((seg, idx) => {
    accumulated += `/${seg}`;
    if (seg === "courses" && idx === 0 && segments.length > 1) {
      return;
    }
    const isNumericId = /^\d+$/.test(seg);
    const label = isNumericId
      ? `Course #${seg}`
      : SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({ label, to: accumulated });
  });

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/" className="breadcrumb-link">
        <Home size={13} />
        <span>Catalog</span>
      </Link>
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={crumb.to} className="breadcrumb-item">
            <ChevronRight size={13} className="breadcrumb-sep" aria-hidden="true" />
            {isLast ? (
              <span className="breadcrumb-current" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link to={crumb.to} className="breadcrumb-link">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
