import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BookMarked,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  FolderPlus,
  HelpCircle,
  Layers,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { adminApi } from "../api/admin";
import { contributionsApi } from "../api/contributions";
import { coursesApi } from "../api/courses";
import { requestsApi } from "../api/requests";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  ContributionStatusBadge,
  MaterialTypeBadge,
  RequestStatusBadge,
} from "../components/Badge";
import { AdminActivityTab } from "../components/AdminActivityTab";
import { AdminGroupsTab } from "../components/AdminGroupsTab";
import { AdminUsersTab } from "../components/AdminUsersTab";
import { AdminSecurityTab } from "../components/AdminSecurityTab";
import { useToast } from "../components/ToastContext";
import type {
  Contribution,
  ContributionStatus,
  Course,
  MaterialRequest,
  ModerationStatus,
  PlatformStats,
  User,
} from "../types";

type AdminTab = "moderation" | "requests" | "users" | "groups" | "activity" | "security";

export function AdminDashboardPage() {
  const { user: currentAdmin } = useAuth();
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [activeTab, setActiveTab] = useState<AdminTab>("moderation");
  const [stats, setStats] = useState<PlatformStats>({
    users: 0,
    courses: 0,
    core_materials: 0,
    contributions: { pending: 0, approved: 0, rejected: 0 },
    requests: { open: 0, fulfilled: 0 },
  });

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allRequests, setAllRequests] = useState<MaterialRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<ContributionStatus | "">("pending");
  const [courseFilter, setCourseFilter] = useState<number | undefined>(undefined);

  const [users, setUsers] = useState<User[]>([]);
  const [extStats, setExtStats] = useState({ banned_users: 0, groups: 0, new_users_7d: 0, new_records_7d: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, contribRes, coursesRes, usersRes, requestsRes] =
        await Promise.allSettled([
          adminApi.getStats(),
          contributionsApi.listAll({
            status: statusFilter,
            course_id: courseFilter,
            limit: 100,
          }),
          coursesApi.list({ limit: 100 }),
          adminApi.listUsers({ limit: 100 }),
          requestsApi.listAll({ limit: 100 }),
        ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (contribRes.status === "fulfilled") setContributions(contribRes.value.items);
      if (coursesRes.status === "fulfilled") setCourses(coursesRes.value.items);
      if (usersRes.status === "fulfilled") setUsers(usersRes.value.items);
      if (requestsRes.status === "fulfilled") setAllRequests(requestsRes.value.items);
    } catch (err) {
      showToastRef.current(extractErrorMessage(err), "error");
    } finally {
      const ext = await adminApi.getExtendedOverview().catch(() => ({ banned_users: 0, groups: 0, new_users_7d: 0, new_records_7d: 0 }));
      setExtStats(ext);
      setLoading(false);
    }
  }, [statusFilter, courseFilter]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const handleModerate = async (item: Contribution, nextStatus: ModerationStatus) => {
    try {
      await contributionsApi.updateStatus(item.id, nextStatus);
      showToast(
        `Contribution "${item.title}" marked as ${nextStatus}`,
        nextStatus === "approved" ? "success" : "info"
      );
      await loadAdminData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDeleteContribution = async (item: Contribution) => {
    try {
      await contributionsApi.remove(item.id);
      showToast(`Deleted "${item.title}"`, "info");
      await loadAdminData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleApproveNewCourseRequest = async (req: MaterialRequest) => {
    // Parse "[NEW COURSE: CODE] Title" if formatted from Student Dashboard
    const match = req.title.match(/^\[NEW COURSE:\s*([A-Z0-9_-]+)\]\s*(.+)$/i);
    const code = match ? match[1].toUpperCase() : "NEW101";
    const title = match ? match[2].trim() : req.title;
    const deptMatch = code.match(/^([A-Z]+)/);
    const dept = deptMatch ? deptMatch[1] : "CSE";

    try {
      await coursesApi.create({
        code,
        title,
        department: dept,
        semester_offered: "Autumn 2026",
      });
      await requestsApi.fulfill(req.id);
      showToast(`Created course ${code} and marked request fulfilled!`, "success");
      await loadAdminData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleFulfillRequest = async (req: MaterialRequest) => {
    try {
      await requestsApi.fulfill(req.id);
      showToast(`Marked "${req.title}" as fulfilled`, "success");
      await loadAdminData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDeleteRequest = async (req: MaterialRequest) => {
    try {
      await requestsApi.remove(req.id);
      showToast(`Deleted request "${req.title}"`, "info");
      await loadAdminData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleToggleUserActive = async (targetUser: User) => {
    const nextActive = !targetUser.is_active;
    try {
      await adminApi.setUserActive(targetUser.id, nextActive);
      showToast(
        `${targetUser.name} (${targetUser.email}) ${
          nextActive ? "reactivated" : "deactivated"
        }`,
        nextActive ? "success" : "info"
      );
      await loadAdminData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  return (
    <div>
      <section className="hero-banner">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="hero-eyebrow">
              <ShieldCheck size={14} /> Admin Control Center • RBAC Enforced
            </span>
            <h1 className="hero-title">Platform Overview &amp; Administration</h1>
            <p className="hero-subtitle">
              Monitor platform-wide metrics, review pending student contributions,
              approve new course requests, and manage registered user accounts.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            <Link to="/admin/courses" className="btn btn-primary">
              <FolderKanban size={16} /> Manage Courses
            </Link>
            <Link to="/admin/materials" className="btn btn-secondary">
              <BookMarked size={16} /> Manage Core Materials
            </Link>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Registered Users</div>
            <div className="stat-value">{stats.users || users.length}</div>
          </div>
          <span className="brand-icon" style={{ width: 42, height: 42 }}>
            <Users size={20} />
          </span>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Courses &amp; Core Materials</div>
            <div className="stat-value">
              {stats.courses || courses.length} / {stats.core_materials}
            </div>
          </div>
          <span className="brand-icon" style={{ width: 42, height: 42 }}>
            <Layers size={20} />
          </span>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Contributions (P / A / R)</div>
            <div className="stat-value" style={{ fontSize: "1.35rem" }}>
              <span style={{ color: "var(--warning)" }}>
                {stats.contributions.pending}P
              </span>{" "}
              /{" "}
              <span style={{ color: "var(--success)" }}>
                {stats.contributions.approved}A
              </span>{" "}
              /{" "}
              <span style={{ color: "var(--danger)" }}>
                {stats.contributions.rejected}R
              </span>
            </div>
          </div>
          <span className="brand-icon" style={{ width: 42, height: 42 }}>
            <UploadCloud size={20} />
          </span>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Requests (Open / Fulfilled)</div>
            <div className="stat-value" style={{ fontSize: "1.35rem" }}>
              {stats.requests.open} Open / {stats.requests.fulfilled} Done
            </div>
          </div>
          <span className="brand-icon" style={{ width: 42, height: 42 }}>
            <HelpCircle size={20} />
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        <span className="badge badge-danger">Banned Users: {extStats.banned_users}</span>
        <span className="badge badge-info">Study Groups: {extStats.groups}</span>
        <span className="badge badge-success">New Users (7d): +{extStats.new_users_7d}</span>
        <span className="badge badge-neutral">New Records (7d): +{extStats.new_records_7d}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={() => void adminApi.exportContributionsCsv({ status: statusFilter || undefined, course_id: courseFilter })}
        >
          Export Filtered Records CSV
        </button>
      </div>

      <div className="tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "moderation"}
          className={`tab-btn ${activeTab === "moderation" ? "active" : ""}`}
          onClick={() => setActiveTab("moderation")}
        >
          <ShieldCheck size={16} />
          Moderation Queue
          <span className="badge badge-warning">{stats.contributions.pending} pending</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "requests"}
          className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          <HelpCircle size={16} />
          Course &amp; Material Requests
          <span className="badge badge-info">{allRequests.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "users"}
          className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <Users size={16} />
          User Management
          <span className="badge badge-neutral">{users.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "activity"}
          className={`tab-btn ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          <Activity size={16} />
          Activity Log
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "groups"}
          className={`tab-btn ${activeTab === "groups" ? "active" : ""}`}
          onClick={() => setActiveTab("groups")}
        >
          <Layers size={16} />
          Study Groups
          <span className="badge badge-neutral">{extStats.groups}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "security"}
          className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <ShieldAlert size={16} />
          Security
        </button>
      </div>

      {/* TAB 1: Moderation Queue */}
      {activeTab === "moderation" && (
        <div>
          <div className="toolbar">
            <div className="filter-pills">
              <button
                type="button"
                className={`filter-pill ${statusFilter === "pending" ? "active" : ""}`}
                onClick={() => setStatusFilter("pending")}
              >
                Pending ({stats.contributions.pending})
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === "approved" ? "active" : ""}`}
                onClick={() => setStatusFilter("approved")}
              >
                Approved ({stats.contributions.approved})
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === "rejected" ? "active" : ""}`}
                onClick={() => setStatusFilter("rejected")}
              >
                Rejected ({stats.contributions.rejected})
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === "" ? "active" : ""}`}
                onClick={() => setStatusFilter("")}
              >
                All Contributions
              </button>
            </div>

            <div style={{ minWidth: "240px" }}>
              <select
                className="form-select"
                value={courseFilter ?? ""}
                onChange={(e) =>
                  setCourseFilter(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading moderation queue...</div>
          ) : contributions.length === 0 ? (
            <div className="empty-state">
              <p>No contributions match the selected status and course filter.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Title &amp; Contributor</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Resource Link</th>
                    <th style={{ textAlign: "right" }}>Moderation Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          to={`/courses/${item.course_id}`}
                          className="course-code-badge"
                        >
                          {item.course_code || `Course #${item.course_id}`}
                        </Link>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                            marginTop: "0.15rem",
                          }}
                        >
                          By <strong>{item.author_name}</strong>
                          {item.description ? ` • ${item.description}` : ""}
                        </div>
                      </td>
                      <td>
                        <MaterialTypeBadge type={item.type} />
                      </td>
                      <td>
                        <ContributionStatusBadge status={item.status} />
                      </td>
                      <td>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          Inspect <ExternalLink size={13} />
                        </a>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "0.4rem",
                            flexWrap: "nowrap",
                          }}
                        >
                          {item.status !== "approved" && (
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => void handleModerate(item, "approved")}
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          )}
                          {item.status !== "rejected" && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleModerate(item, "rejected")}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleDeleteContribution(item)}
                            title="Delete contribution"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Course & Material Requests (Admin Review & 1-Click Course Creation) */}
      {activeTab === "requests" && (
        <div>
          {allRequests.length === 0 ? (
            <div className="empty-state">
              <p>No course or material requests have been submitted yet.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Request Title &amp; Student</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allRequests.map((req) => {
                    const isNewCourseReq =
                      !req.course_id || req.title.startsWith("[NEW COURSE:");
                    return (
                      <tr key={req.id}>
                        <td>
                          {req.course_id ? (
                            <Link
                              to={`/courses/${req.course_id}`}
                              className="course-code-badge"
                            >
                              {req.course_code || `Course #${req.course_id}`}
                            </Link>
                          ) : (
                            <span className="badge badge-info">NEW COURSE</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{req.title}</div>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            Requested by <strong>{req.author_name}</strong>
                            {req.description ? ` • ${req.description}` : ""}
                          </div>
                        </td>
                        <td>
                          <RequestStatusBadge status={req.status} />
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: "0.45rem",
                              flexWrap: "wrap",
                            }}
                          >
                            {req.status === "open" && isNewCourseReq && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => void handleApproveNewCourseRequest(req)}
                              >
                                <FolderPlus size={14} /> Create Course &amp; Fulfill
                              </button>
                            )}
                            {req.status === "open" && (
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => void handleFulfillRequest(req)}
                              >
                                <CheckCircle2 size={14} /> Mark Fulfilled
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleDeleteRequest(req)}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: User Management */}
      {activeTab === "users" && <AdminUsersTab onChanged={loadAdminData} />}

      {activeTab === "groups" && <AdminGroupsTab onChanged={loadAdminData} />}

      {activeTab === "activity" && <AdminActivityTab />}

      {activeTab === "security" && <AdminSecurityTab onUserUpdated={loadAdminData} />}
    </div>
  );
}
