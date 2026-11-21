import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  FolderPlus,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  PlusCircle,
  Trash2,
  UploadCloud,
  UserCog,
} from "lucide-react";
import { contributionsApi } from "../api/contributions";
import { coursesApi } from "../api/courses";
import { extractErrorMessage } from "../api/client";
import { meApi } from "../api/me";
import { requestsApi } from "../api/requests";
import { useAuth } from "../auth/AuthContext";
import {
  ContributionStatusBadge,
  MaterialTypeBadge,
  RequestStatusBadge,
} from "../components/Badge";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import {
  MATERIAL_TYPES,
  type Contribution,
  type ContributionCreatePayload,
  type ContributionStatus,
  type ContributionUpdatePayload,
  type Course,
  type MaterialRequest,
  type MaterialType,
  type RequestStatus,
  type UserSession,
  type UserSummary,
} from "../types";

type DashTab = "contributions" | "requests" | "settings";
type RequestMode = "new_course" | "course_material";

export function DashboardPage() {
  const { user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [activeTab, setActiveTab] = useState<DashTab>("contributions");
  const [summary, setSummary] = useState<UserSummary>({
    contributions: { pending: 0, approved: 0, rejected: 0 },
    requests: { open: 0, fulfilled: 0 },
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contribFilter, setContribFilter] = useState<ContributionStatus | "">("");

  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [requestFilter, setRequestFilter] = useState<RequestStatus | "">("");

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Create Contribution Modal from Dashboard
  const [isNewContribOpen, setIsNewContribOpen] = useState<boolean>(false);
  const [selectedContribCourseId, setSelectedContribCourseId] = useState<number>(0);
  const [newContribForm, setNewContribForm] = useState<ContributionCreatePayload>({
    title: "",
    type: "notes",
    url: "",
    description: "",
  });

  // Create Request Modal from Dashboard (supports New Course OR Existing Course Material)
  const [isNewRequestOpen, setIsNewRequestOpen] = useState<boolean>(false);
  const [requestMode, setRequestMode] = useState<RequestMode>("new_course");
  const [selectedReqCourseId, setSelectedReqCourseId] = useState<number>(0);
  const [requestedCourseCode, setRequestedCourseCode] = useState<string>("");
  const [requestedCourseTitle, setRequestedCourseTitle] = useState<string>("");
  const [requestTitle, setRequestTitle] = useState<string>("");
  const [requestDesc, setRequestDesc] = useState<string>("");

  // Edit Pending Contribution Modal
  const [editingContrib, setEditingContrib] = useState<Contribution | null>(null);
  const [contribEditForm, setContribEditForm] = useState<ContributionUpdatePayload>({
    title: "",
    type: "notes",
    url: "",
    description: "",
  });

  // Profile & Password Forms
  const [displayName, setDisplayName] = useState<string>(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPasswords, setShowPasswords] = useState<boolean>(false);

  useEffect(() => {
    if (user?.name) {
      setDisplayName(user.name);
    }
  }, [user?.name]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, contribRes, reqRes, coursesRes, sessRes] = await Promise.allSettled([
        meApi.getSummary(),
        meApi.listContributions({ status: contribFilter, limit: 100 }),
        meApi.listRequests({ status: requestFilter, limit: 100 }),
        coursesApi.list({ limit: 100 }),
        meApi.listSessions(),
      ]);

      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
      if (contribRes.status === "fulfilled") setContributions(contribRes.value.items);
      if (reqRes.status === "fulfilled") setRequests(reqRes.value.items);
      if (sessRes.status === "fulfilled") setSessions(sessRes.value);
      if (coursesRes.status === "fulfilled") {
        setCourses(coursesRes.value.items);
        if (coursesRes.value.items.length > 0) {
          setSelectedContribCourseId((prev) => prev || coursesRes.value.items[0].id);
          setSelectedReqCourseId((prev) => prev || coursesRes.value.items[0].id);
        }
      }
    } catch (err) {
      showToastRef.current(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }, [contribFilter, requestFilter]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const openNewCourseRequestModal = () => {
    setRequestMode("new_course");
    setRequestedCourseCode("");
    setRequestedCourseTitle("");
    setRequestDesc("");
    setIsNewRequestOpen(true);
  };

  const openMaterialRequestModal = () => {
    setRequestMode("course_material");
    setRequestTitle("");
    setRequestDesc("");
    setIsNewRequestOpen(true);
  };

  const handleCreateDashboardRequest = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (requestMode === "new_course") {
        const cleanCode = requestedCourseCode.trim().toUpperCase();
        const cleanName = requestedCourseTitle.trim();
        await requestsApi.createGeneral({
          course_id: null,
          title: `[NEW COURSE: ${cleanCode}] ${cleanName}`,
          description:
            requestDesc.trim() ||
            `Student request to add ${cleanCode} — ${cleanName} to the PassDown course catalog.`,
        });
        showToast(`New course request for ${cleanCode} submitted!`, "success");
      } else {
        if (!selectedReqCourseId) {
          showToast("Please select a course", "error");
          setSubmitting(false);
          return;
        }
        await requestsApi.create(selectedReqCourseId, {
          title: requestTitle,
          description: requestDesc,
        });
        showToast("Material request posted!", "success");
      }
      setIsNewRequestOpen(false);
      setActiveTab("requests");
      await loadDashboardData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDashboardContribution = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedContribCourseId) {
      showToast("Please select a course first", "error");
      return;
    }
    setSubmitting(true);
    try {
      await contributionsApi.create(selectedContribCourseId, newContribForm);
      showToast("Contribution submitted for admin review!", "success");
      setIsNewContribOpen(false);
      setNewContribForm({ title: "", type: "notes", url: "", description: "" });
      setActiveTab("contributions");
      await loadDashboardData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditContribution = (item: Contribution) => {
    setEditingContrib(item);
    setContribEditForm({
      title: item.title,
      type: item.type,
      url: item.url,
      description: item.description ?? "",
    });
  };

  const handleSaveContribution = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingContrib) return;
    setSubmitting(true);
    try {
      await contributionsApi.update(editingContrib.id, contribEditForm);
      showToast("Pending contribution updated", "success");
      setEditingContrib(null);
      await loadDashboardData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    try {
      await meApi.revokeSession(sessionId);
      showToast(`Revoked session #${sessionId}`, "info");
      await loadDashboardData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDeleteContribution = async (item: Contribution) => {
    try {
      await contributionsApi.remove(item.id);
      showToast(`Deleted "${item.title}"`, "info");
      await loadDashboardData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleFulfillRequest = async (req: MaterialRequest) => {
    try {
      await requestsApi.fulfill(req.id);
      showToast(`Marked "${req.title}" as fulfilled`, "success");
      await loadDashboardData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDeleteRequest = async (req: MaterialRequest) => {
    try {
      await requestsApi.remove(req.id);
      showToast(`Deleted request "${req.title}"`, "info");
      await loadDashboardData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleUpdateName = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await meApi.updateProfile({ name: displayName });
      await refreshProfile();
      showToast("Display name updated!", "success");
      await loadDashboardData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (newPassword !== confirmPassword) {
      showToast("New password and confirmation do not match", "error");
      return;
    }
    await meApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password changed!", "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hero Banner with Direct Action Buttons */}
      <section className="hero-banner">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="hero-eyebrow">
              <LayoutDashboard size={14} /> Personal Workspace •{" "}
              {user?.role?.toUpperCase()}
            </span>
            <h1 className="hero-title">Welcome, {user?.name}</h1>
            <p className="hero-subtitle">
              Signed in as <strong>{user?.email}</strong>. Submit study links,
              request missing courses or study materials, and manage your profile.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openNewCourseRequestModal}
            >
              <FolderPlus size={15} /> + Request New Course
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openMaterialRequestModal}
            >
              <PlusCircle size={15} /> + Request Material
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsNewContribOpen(true)}
            >
              <UploadCloud size={15} /> + Contribute Link
            </button>
          </div>
        </div>
      </section>

      {/* Summary Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Pending Contributions</div>
            <div className="stat-value" style={{ color: "var(--warning)" }}>
              {summary.contributions.pending}
            </div>
          </div>
          <span className="badge badge-warning">
            <Clock size={14} /> In Review
          </span>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Approved Contributions</div>
            <div className="stat-value" style={{ color: "var(--success)" }}>
              {summary.contributions.approved}
            </div>
          </div>
          <span className="badge badge-success">
            <CheckCircle2 size={14} /> Published
          </span>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Rejected Contributions</div>
            <div className="stat-value" style={{ color: "var(--danger)" }}>
              {summary.contributions.rejected}
            </div>
          </div>
          <span className="badge badge-danger">Needs Revision</span>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">My Course &amp; Material Requests</div>
            <div className="stat-value">
              {summary.requests.open} Open / {summary.requests.fulfilled} Done
            </div>
          </div>
          <span className="badge badge-info">
            <HelpCircle size={14} /> Requests
          </span>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "contributions"}
          className={`tab-btn ${activeTab === "contributions" ? "active" : ""}`}
          onClick={() => setActiveTab("contributions")}
        >
          <UploadCloud size={15} /> My Contributions ({contributions.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "requests"}
          className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          <HelpCircle size={15} /> My Course &amp; Material Requests ({requests.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "settings"}
          className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <UserCog size={15} /> Profile &amp; Password
        </button>
      </div>

      {/* TAB 1: My Contributions */}
      {activeTab === "contributions" && (
        <div>
          <div className="toolbar">
            <div className="filter-pills">
              <button
                type="button"
                className={`filter-pill ${contribFilter === "" ? "active" : ""}`}
                onClick={() => setContribFilter("")}
              >
                All ({summary.contributions.pending + summary.contributions.approved + summary.contributions.rejected})
              </button>
              <button
                type="button"
                className={`filter-pill ${contribFilter === "pending" ? "active" : ""}`}
                onClick={() => setContribFilter("pending")}
              >
                Pending ({summary.contributions.pending})
              </button>
              <button
                type="button"
                className={`filter-pill ${contribFilter === "approved" ? "active" : ""}`}
                onClick={() => setContribFilter("approved")}
              >
                Approved ({summary.contributions.approved})
              </button>
              <button
                type="button"
                className={`filter-pill ${contribFilter === "rejected" ? "active" : ""}`}
                onClick={() => setContribFilter("rejected")}
              >
                Rejected ({summary.contributions.rejected})
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsNewContribOpen(true)}
            >
              <UploadCloud size={14} /> + Submit Contribution
            </button>
          </div>

          {loading ? (
            <div className="empty-state">Loading your contributions...</div>
          ) : contributions.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: "0 0 1rem" }}>
                You have no contributions matching this filter yet.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsNewContribOpen(true)}
              >
                <UploadCloud size={14} /> Submit First Contribution
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Title &amp; Description</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Resource Link</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
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
                        {item.description && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {item.description}
                          </div>
                        )}
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
                          Open <ExternalLink size={13} />
                        </a>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "0.4rem",
                          }}
                        >
                          {item.status === "pending" && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditContribution(item)}
                            >
                              <Edit3 size={14} /> Edit
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleDeleteContribution(item)}
                          >
                            <Trash2 size={14} /> Delete
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

      {/* TAB 2: My Course & Material Requests */}
      {activeTab === "requests" && (
        <div>
          <div className="toolbar">
            <div className="filter-pills">
              <button
                type="button"
                className={`filter-pill ${requestFilter === "" ? "active" : ""}`}
                onClick={() => setRequestFilter("")}
              >
                All ({summary.requests.open + summary.requests.fulfilled})
              </button>
              <button
                type="button"
                className={`filter-pill ${requestFilter === "open" ? "active" : ""}`}
                onClick={() => setRequestFilter("open")}
              >
                Open ({summary.requests.open})
              </button>
              <button
                type="button"
                className={`filter-pill ${requestFilter === "fulfilled" ? "active" : ""}`}
                onClick={() => setRequestFilter("fulfilled")}
              >
                Fulfilled ({summary.requests.fulfilled})
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openNewCourseRequestModal}
              >
                <FolderPlus size={14} /> + Request Missing Course
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={openMaterialRequestModal}
              >
                <PlusCircle size={14} /> + Request Course Material
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading your requests...</div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: "0 0 1rem" }}>
                You haven&apos;t requested any missing courses or materials yet.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: "0.6rem" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openNewCourseRequestModal}
                >
                  <FolderPlus size={14} /> Request Missing Course
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={openMaterialRequestModal}
                >
                  <PlusCircle size={14} /> Request Course Material
                </button>
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Request Title &amp; Details</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
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
                        {req.description && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {req.description}
                          </div>
                        )}
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
                          }}
                        >
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Profile & Password Settings */}
      {activeTab === "settings" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <div className="glass-card">
            <form onSubmit={handleUpdateName}>
              <h3 style={{ margin: "0 0 0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <UserCog size={18} /> Update Display Name
              </h3>
              <p style={{ margin: "0 0 1.2rem", fontSize: "0.86rem", color: "var(--text-secondary)" }}>
                Your display name is shown automatically on all your contributions and requests.
              </p>

              <div className="form-group">
                <label className="form-label">Email Address (Read-only)</label>
                <input
                  type="email"
                  className="form-input"
                  value={user?.email ?? ""}
                  disabled
                />
              </div>

              <div className="form-group">
                <label className="form-label">Display Name (2–100 chars) *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  minLength={2}
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Display Name"}
              </button>
            </form>
          </div>

          <div className="glass-card">
            <form onSubmit={handleUpdatePassword}>
              <h3 style={{ margin: "0 0 0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <KeyRound size={18} /> Change Password
              </h3>
              <p style={{ margin: "0 0 1.2rem", fontSize: "0.86rem", color: "var(--text-secondary)" }}>
                Enter your current password to set a new password (min 8 chars, at least 1 letter and 1 digit).
              </p>

              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <input
                  type={showPasswords ? "text" : "password"}
                  className="form-input"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type={showPasswords ? "text" : "password"}
                  className="form-input"
                  required
                  minLength={8}
                  maxLength={128}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type={showPasswords ? "text" : "password"}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                />
              </div>
              <div style={{ marginBottom: "0.85rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowPasswords((v) => !v)}
                >
                  {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPasswords ? "Hide Passwords" : "Show Passwords"}
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request New Course OR Request Course Material */}
      <Modal
        isOpen={isNewRequestOpen}
        title={
          requestMode === "new_course"
            ? "Request a Missing Course to be Added"
            : "Request Study Material for a Course"
        }
        onClose={() => setIsNewRequestOpen(false)}
      >
        <div className="filter-pills" style={{ marginBottom: "1rem", width: "100%" }}>
          <button
            type="button"
            style={{ flex: 1 }}
            className={`filter-pill ${requestMode === "new_course" ? "active" : ""}`}
            onClick={() => setRequestMode("new_course")}
          >
            Request Missing Course
          </button>
          <button
            type="button"
            style={{ flex: 1 }}
            className={`filter-pill ${requestMode === "course_material" ? "active" : ""}`}
            onClick={() => setRequestMode("course_material")}
          >
            Request Material for Existing Course
          </button>
        </div>

        <form onSubmit={handleCreateDashboardRequest}>
          {requestMode === "new_course" ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Desired Course Code *</label>
                  <input
                    type="text"
                    className="form-input mono"
                    required
                    minLength={2}
                    maxLength={20}
                    placeholder="e.g. CSE499"
                    value={requestedCourseCode}
                    onChange={(e) =>
                      setRequestedCourseCode(e.target.value.toUpperCase())
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Course Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    minLength={3}
                    maxLength={140}
                    placeholder="e.g. Senior Design Project"
                    value={requestedCourseTitle}
                    onChange={(e) => setRequestedCourseTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Department / Semester / Notes (optional)</label>
                <textarea
                  className="form-textarea"
                  maxLength={1000}
                  placeholder="Which department offers this course and what materials are you hoping to find?"
                  value={requestDesc}
                  onChange={(e) => setRequestDesc(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Select Existing Course *</label>
                <select
                  className="form-select"
                  value={selectedReqCourseId}
                  onChange={(e) => setSelectedReqCourseId(Number(e.target.value))}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">What material are you looking for? (5–200 chars) *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  minLength={5}
                  maxLength={200}
                  placeholder="e.g. Need Autumn 2025 Final Question Paper"
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Additional Details (optional)</label>
                <textarea
                  className="form-textarea"
                  maxLength={1000}
                  placeholder="Specific topics, semester, or instructor..."
                  value={requestDesc}
                  onChange={(e) => setRequestDesc(e.target.value)}
                />
              </div>
            </>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.65rem",
              marginTop: "1.25rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsNewRequestOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? "Submitting..."
                : requestMode === "new_course"
                ? "Submit Course Request"
                : "Post Material Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Contribute Study Link from Dashboard */}
      <Modal
        isOpen={isNewContribOpen}
        title="Contribute a Study Resource Link"
        onClose={() => setIsNewContribOpen(false)}
      >
        <form onSubmit={handleCreateDashboardContribution}>
          <div className="form-group">
            <label className="form-label">Select Course *</label>
            <select
              className="form-select"
              value={selectedContribCourseId}
              onChange={(e) => setSelectedContribCourseId(Number(e.target.value))}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Resource Title *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={3}
              maxLength={200}
              placeholder="e.g. Complete Midterm & Final Notes"
              value={newContribForm.title}
              onChange={(e) =>
                setNewContribForm({ ...newContribForm, title: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Material Type *</label>
            <select
              className="form-select"
              value={newContribForm.type}
              onChange={(e) =>
                setNewContribForm({
                  ...newContribForm,
                  type: e.target.value as MaterialType,
                })
              }
            >
              {MATERIAL_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">External URL (http:// or https://) *</label>
            <input
              type="url"
              className="form-input"
              required
              placeholder="https://drive.google.com/..."
              value={newContribForm.url}
              onChange={(e) =>
                setNewContribForm({ ...newContribForm, url: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-textarea"
              maxLength={1000}
              value={newContribForm.description ?? ""}
              onChange={(e) =>
                setNewContribForm({
                  ...newContribForm,
                  description: e.target.value,
                })
              }
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.65rem",
              marginTop: "1.25rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsNewContribOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        </form>
      </Modal>

      {activeTab === "settings" && (
        <div className="card" style={{ padding: "1.25rem", marginTop: "1.25rem" }}>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>Active &amp; Recent Sessions</h3>
          <p style={{ margin: "0 0 0.9rem", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
            Review devices signed into your account and revoke any session immediately.
          </p>
          {sessions.length === 0 ? (
            <div className="empty-state">No recorded sessions yet.</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Browser / Device</th>
                    <th>IP Address</th>
                    <th>Last Used (UTC)</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="mono">#{s.id}</td>
                      <td>{s.browser || "Unknown browser"}</td>
                      <td className="mono" style={{ fontSize: "0.8rem" }}>{s.ip_address || "?"}</td>
                      <td className="mono" style={{ fontSize: "0.78rem" }}>
                        {new Date(s.last_used_at).toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td>
                        {s.revoked_at ? (
                          <span className="badge badge-danger">Revoked</span>
                        ) : (
                          <span className="badge badge-success">Active</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!s.revoked_at ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleRevokeSession(s.id)}
                          >
                            Revoke
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>?</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Pending Contribution Modal */}
      <Modal
        isOpen={Boolean(editingContrib)}
        title="Edit Pending Contribution"
        onClose={() => setEditingContrib(null)}
      >
        <form onSubmit={handleSaveContribution}>
          <div className="form-group">
            <label className="form-label">Resource Title *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={3}
              maxLength={200}
              value={contribEditForm.title}
              onChange={(e) =>
                setContribEditForm({ ...contribEditForm, title: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Material Type *</label>
            <select
              className="form-select"
              value={contribEditForm.type}
              onChange={(e) =>
                setContribEditForm({
                  ...contribEditForm,
                  type: e.target.value as MaterialType,
                })
              }
            >
              {MATERIAL_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Resource URL *</label>
            <input
              type="url"
              className="form-input"
              required
              value={contribEditForm.url}
              onChange={(e) =>
                setContribEditForm({ ...contribEditForm, url: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              maxLength={1000}
              value={contribEditForm.description ?? ""}
              onChange={(e) =>
                setContribEditForm({
                  ...contribEditForm,
                  description: e.target.value,
                })
              }
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.65rem",
              marginTop: "1.25rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingContrib(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
