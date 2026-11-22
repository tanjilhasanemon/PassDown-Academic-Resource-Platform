import { Link } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Compass,
  Database,
  ExternalLink,
  HelpCircle,
  Layers,
  Lock,
  UploadCloud,
  Users,
} from "lucide-react";

const TEAM_MEMBERS = [
  { name: "Tanjil Hasan Emon", id: "2331024", role: "Team Lead — Auth, RBAC/JWT, CI/CD & Docs" },
  { name: "Tanjil Sarkar", id: "2312026", role: "Course Catalog, Filtering & Core Materials" },
  { name: "Md Jawad Abdullah", id: "2230325", role: "Community Contributions, Moderation & Sphinx" },
  { name: "S M Mashraful Islam", id: "2230836", role: "Resource Requests, Study Groups & TypeDoc" },
];

const FAQ_ITEMS = [
  {
    q: "How do I find slides or past papers for a course?",
    a: "Open the Course Catalog, press '/' to search by course code (e.g., CSE451) or filter by department and course level, then click any course to view Core Materials and approved Contributions.",
  },
  {
    q: "Why is my submitted Contribution marked Pending?",
    a: "Every student contribution enters a moderated Pending queue so an Admin can verify the external link is safe and relevant before it appears publicly.",
  },
  {
    q: "Can I edit or remove a submission if I pasted the wrong link?",
    a: "Yes. Open your Workspace dashboard while the contribution is still Pending to edit its details or withdraw it immediately.",
  },
  {
    q: "How do Study Group permissions work?",
    a: "Group owners assign granular Create, Edit, and Assign flags per member so teams can organize exam notes safely without accidental edits.",
  },
];

/**
 * Renders the About, Quick Start Guide, FAQ, and CSE 451 Team page (Nielsen H10).
 */
export function AboutPage() {
  return (
    <div>
      <section className="hero-banner">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: "780px" }}>
            <span className="hero-eyebrow">
              <BookOpen size={14} /> Archival Mission • IUB Course Archive (CSE 451)
            </span>
            <h1 className="hero-title">About PassDown &amp; User Guide</h1>
            <p className="hero-subtitle">
              PassDown is a structured, peer-powered course material archive built for
              students at Independent University, Bangladesh (IUB). Browse curated
              resources without logging in, share verified study links, request missing
              materials, and collaborate in permission-controlled Study Groups.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            <Link to="/" className="btn btn-primary">
              <Compass size={16} /> Browse Directory
            </Link>
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              OpenAPI Docs <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </section>

      <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Step 1 • Curated</div>
            <div className="stat-value" style={{ fontSize: "1.15rem" }}>
              Core Materials
            </div>
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
              Verified syllabi, official slide decks, and reference textbooks maintained by
              course administrators.
            </p>
          </div>
          <span className="brand-icon" style={{ width: 42, height: 42 }}>
            <Layers size={20} />
          </span>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Step 2 • Moderated</div>
            <div className="stat-value" style={{ fontSize: "1.15rem" }}>
              Community Contributions
            </div>
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
              Student-submitted notes and past papers reviewed by moderators before
              appearing publicly.
            </p>
          </div>
          <span className="brand-icon" style={{ width: 42, height: 42 }}>
            <UploadCloud size={20} />
          </span>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Step 3 • Collaborative</div>
            <div className="stat-value" style={{ fontSize: "1.15rem" }}>
              Requests &amp; Study Groups
            </div>
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
              Request missing course resources or create Study Groups with fine-grained
              Create, Edit, and Assign member permissions.
            </p>
          </div>
          <span className="brand-icon" style={{ width: 42, height: 42 }}>
            <HelpCircle size={20} />
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: "1.35rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
          <CheckCircle2 size={18} />
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Quick Start &amp; Frequently Asked Questions</h2>
        </div>
        <div className="faq-grid">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="faq-item">
              <div className="faq-q">{item.q}</div>
              <p className="faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div className="card" style={{ padding: "1.35rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.65rem" }}>
            <Database size={18} />
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>ECB Layered Architecture</h2>
          </div>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Engineered with strict <strong>Entity–Control–Boundary</strong> separation
            using <strong>FastAPI</strong>, <strong>SQLAlchemy 2.0</strong>, and{" "}
            <strong>Supabase PostgreSQL</strong>, paired with a{" "}
            <strong>React 19 + TypeScript + Vite 8</strong> frontend deployed via Vercel Services.
          </p>
        </div>

        <div className="card" style={{ padding: "1.35rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.65rem" }}>
            <Lock size={18} />
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Defense-in-Depth Security</h2>
          </div>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Passwords use <strong>Argon2id</strong> with pepper; sessions pair 15-minute{" "}
            <strong>HS256 JWT</strong> access tokens with 7-day rotating{" "}
            <strong>HMAC-SHA256</strong> refresh tokens, 5-attempt lockout protection, and
            full admin audit logging.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: "1.35rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
          <Users size={18} />
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>CSE 451 Project Team (IUB)</h2>
        </div>
        <div className="faq-grid">
          {TEAM_MEMBERS.map((member) => (
            <div key={member.id} className="faq-item">
              <div className="faq-q">
                {member.name} <span className="badge badge-neutral">ID: {member.id}</span>
              </div>
              <p className="faq-a">{member.role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
