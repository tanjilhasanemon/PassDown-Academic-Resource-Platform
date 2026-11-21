import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { contributionsApi } from "../api/contributions";
import { coursesApi } from "../api/courses";
import { extractErrorMessage } from "../api/client";
import {
  ContributionStatusBadge,
  MaterialTypeBadge,
} from "../components/Badge";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import {
  MATERIAL_TYPES,
  type Contribution,
  type ContributionStatus,
  type ContributionUpdatePayload,
  type Course,
  type MaterialType,
  type ModerationStatus,
} from "../types";

export function AdminModerationPage() {
  const { showToast } = useToast();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [statusFilter, setStatusFilter] = useState<ContributionStatus | "">("pending");
  const [courseFilter, setCourseFilter] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Edit Pending Modal
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(
    null
  );
  const [editForm, setEditForm] = useState<ContributionUpdatePayload>({
    author_name: "",
    title: "",
    type: "notes",
    url: "",
    description: "",
  });

  // Read Single Inspector Modal
  const [inspectedContribution, setInspectedContribution] =
    useState<Contribution | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [contribRes, coursesRes] = await Promise.all([
        contributionsApi.listAll({
          status: statusFilter,
          course_id: courseFilter,
          limit: 100,
        }),
        coursesApi.list({ limit: 100 }),
      ]);
      setContributions(contribRes.items);
      setCourses(coursesRes.items);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, courseFilter, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleModerate = async (item: Contribution, nextStatus: ModerationStatus) => {
    try {
      await contributionsApi.updateStatus(item.id, nextStatus);
      showToast(
        `Contribution "${item.title}" marked as ${nextStatus}`,
        nextStatus === "approved" ? "success" : "info"
      );
      await loadData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const openEditModal = (item: Contribution) => {
    setEditingContribution(item);
    setEditForm({
      author_name: item.author_name,
      title: item.title,
      type: item.type,
      url: item.url,
      description: item.description ?? "",
    });
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingContribution) return;
    setSubmitting(true);
    try {
      await contributionsApi.update(editingContribution.id, editForm);
      showToast("Pending contribution updated", "success");
      setEditingContribution(null);
      await loadData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspectSingle = async (contributionId: number) => {
    try {
      const fresh = await contributionsApi.getById(contributionId);
      setInspectedContribution(fresh);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDelete = async (item: Contribution) => {
    try {
      await contributionsApi.remove(item.id);
      showToast(`Deleted "${item.title}"`, "info");
      await loadData();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  return (
    <div>
      <section className="hero-banner">
        <span className="hero-eyebrow">
          <ShieldCheck size={14} /> Admin Workspace • Contribution Review
        </span>
        <h1 className="hero-title">Contribution Moderation Queue</h1>
        <p className="hero-subtitle">
          Review student-submitted resource links across all courses. Approved
          contributions immediately appear on the course page.
        </p>
      </section>

      <div className="toolbar">
        <div className="filter-pills">
          <button
            type="button"
            className={`filter-pill ${statusFilter === "pending" ? "active" : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            Pending Review
          </button>
          <button
            type="button"
            className={`filter-pill ${statusFilter === "approved" ? "active" : ""}`}
            onClick={() => setStatusFilter("approved")}
          >
            Approved
          </button>
          <button
            type="button"
            className={`filter-pill ${statusFilter === "rejected" ? "active" : ""}`}
            onClick={() => setStatusFilter("rejected")}
          >
            Rejected
          </button>
          <button
            type="button"
            className={`filter-pill ${statusFilter === "" ? "active" : ""}`}
            onClick={() => setStatusFilter("")}
          >
            All Statuses
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
                <th>Title & Author</th>
                <th>Type</th>
                <th>Status</th>
                <th>Link</th>
                <th style={{ textAlign: "right" }}>Moderation & CRUD</th>
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
                      Inspect URL <ExternalLink size={13} />
                    </a>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.4rem",
                        flexWrap: "wrap",
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
                      {item.status === "pending" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit3 size={14} /> Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleInspectSingle(item.id)}
                        title="Read Single via GET /api/v1/contributions/{id}"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDelete(item)}
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

      {/* Edit Pending Modal */}
      <Modal
        isOpen={Boolean(editingContribution)}
        title="Edit Pending Contribution"
        onClose={() => setEditingContribution(null)}
      >
        <form onSubmit={handleSaveEdit}>
          <div className="form-group">
            <label className="form-label">Author Name *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={2}
              maxLength={100}
              value={editForm.author_name ?? ""}
              onChange={(e) =>
                setEditForm({ ...editForm, author_name: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Resource Title *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={3}
              maxLength={200}
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Material Type *</label>
            <select
              className="form-select"
              value={editForm.type}
              onChange={(e) =>
                setEditForm({ ...editForm, type: e.target.value as MaterialType })
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
            <label className="form-label">External URL *</label>
            <input
              type="url"
              className="form-input"
              required
              value={editForm.url}
              onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              maxLength={1000}
              value={editForm.description ?? ""}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
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
              onClick={() => setEditingContribution(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Update Contribution"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Read Single Inspector Modal */}
      <Modal
        isOpen={Boolean(inspectedContribution)}
        title={`Contribution #${inspectedContribution?.id ?? ""}`}
        onClose={() => setInspectedContribution(null)}
      >
        {inspectedContribution && (
          <div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.65rem" }}>
              <MaterialTypeBadge type={inspectedContribution.type} />
              <ContributionStatusBadge status={inspectedContribution.status} />
            </div>
            <h4 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>
              {inspectedContribution.title}
            </h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
              Course: {inspectedContribution.course_code || inspectedContribution.course_id} •
              Author: {inspectedContribution.author_name}
            </p>
            <div
              className="mono"
              style={{
                padding: "0.85rem",
                borderRadius: "12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.78rem",
                wordBreak: "break-all",
              }}
            >
              <div>GET /api/v1/contributions/{inspectedContribution.id}</div>
              <div>URL: {inspectedContribution.url}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
