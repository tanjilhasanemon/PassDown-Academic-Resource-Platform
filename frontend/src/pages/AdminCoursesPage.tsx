import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Edit3,
  Eye,
  FolderPlus,
  Search,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { coursesApi } from "../api/courses";
import { extractErrorMessage } from "../api/client";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import type { Course, CoursePayload } from "../types";

export function AdminCoursesPage() {
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<CoursePayload>({
    code: "",
    title: "",
    department: "",
    semester_offered: "",
  });

  const [inspectedCourse, setInspectedCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  const loadCourses = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await coursesApi.list({ q, limit: 100 });
      setCourses(res.items);
    } catch (err) {
      showToastRef.current(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      void loadCourses("");
      return;
    }
    const timer = window.setTimeout(() => {
      void loadCourses(searchQuery);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [searchQuery, loadCourses]);

  const openCreateModal = () => {
    setEditingCourse(null);
    setFormData({
      code: "",
      title: "",
      department: "CSE",
      semester_offered: "Autumn 2026",
    });
    setIsFormOpen(true);
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      code: course.code,
      title: course.title,
      department: course.department ?? "",
      semester_offered: course.semester_offered ?? "",
    });
    setIsFormOpen(true);
  };

  const handleInspectSingle = async (courseId: number) => {
    try {
      const fresh = await coursesApi.getById(courseId);
      setInspectedCourse(fresh);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleSaveCourse = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editingCourse) {
        const updated = await coursesApi.update(editingCourse.id, formData);
        showToast(`Updated course ${updated.code}`, "success");
      } else {
        const created = await coursesApi.create(formData);
        showToast(`Created course ${created.code}`, "success");
      }
      setIsFormOpen(false);
      await loadCourses(searchQuery);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCourse) return;
    setSubmitting(true);
    try {
      await coursesApi.remove(deletingCourse.id);
      showToast(`Deleted course ${deletingCourse.code} and its related records`, "info");
      setDeletingCourse(null);
      await loadCourses(searchQuery);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
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
            <span className="hero-eyebrow">Admin Workspace • Course CRUD</span>
            <h1 className="hero-title">Manage Course Catalog</h1>
            <p className="hero-subtitle">
              Create, inspect, update, and delete courses. Deleting a course
              automatically cascades to its core materials, contributions, and
              requests.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreateModal}
          >
            <FolderPlus size={17} /> + Add Course
          </button>
        </div>
      </section>

      <div className="toolbar">
        <div className="search-box">
          <Search size={17} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Filter courses by code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="badge badge-neutral">
          Total Courses: {courses.length}
        </span>
      </div>

      {loading ? (
        <div className="empty-state">Loading courses...</div>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <p>No courses found. Click "+ Add Course" to create one.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Department</th>
                <th>Semester</th>
                <th style={{ textAlign: "right" }}>CRUD Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>
                    <span className="course-code-badge">{course.code}</span>
                  </td>
                  <td>
                    <Link
                      to={`/courses/${course.id}`}
                      style={{
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                      }}
                    >
                      {course.title} <ExternalLink size={13} />
                    </Link>
                  </td>
                  <td>{course.department || "—"}</td>
                  <td>{course.semester_offered || "—"}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.45rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleInspectSingle(course.id)}
                        title="Read Single Course via GET /api/v1/courses/{id}"
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(course)}
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeletingCourse(course)}
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

      <Modal
        isOpen={isFormOpen}
        title={editingCourse ? `Edit ${editingCourse.code}` : "Create Course"}
        onClose={() => setIsFormOpen(false)}
      >
        <form onSubmit={handleSaveCourse}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Course Code *</label>
              <input
                type="text"
                className="form-input mono"
                required
                minLength={2}
                maxLength={20}
                placeholder="CSE309"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                type="text"
                className="form-input"
                maxLength={100}
                placeholder="CSE"
                value={formData.department ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Course Title *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={3}
              maxLength={200}
              placeholder="Web Applications & Internet"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Semester Offered</label>
            <input
              type="text"
              className="form-input"
              maxLength={50}
              placeholder="Autumn 2026"
              value={formData.semester_offered ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, semester_offered: e.target.value })
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
              onClick={() => setIsFormOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : editingCourse
                ? "Update Course"
                : "Create Course"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(inspectedCourse)}
        title={`Course Record #${inspectedCourse?.id ?? ""}`}
        onClose={() => setInspectedCourse(null)}
      >
        {inspectedCourse && (
          <div>
            <div style={{ marginBottom: "1rem" }}>
              <span className="course-code-badge">{inspectedCourse.code}</span>
              <h4 style={{ margin: "0.6rem 0 0.25rem", fontSize: "1.15rem" }}>
                {inspectedCourse.title}
              </h4>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                Department: {inspectedCourse.department || "N/A"} • Semester:{" "}
                {inspectedCourse.semester_offered || "N/A"}
              </p>
            </div>
            <div
              className="mono"
              style={{
                padding: "0.9rem",
                borderRadius: "10px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.78rem",
                overflowX: "auto",
              }}
            >
              <div>GET /api/v1/courses/{inspectedCourse.id}</div>
              <div>Created: {new Date(inspectedCourse.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(inspectedCourse.updated_at).toLocaleString()}</div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.6rem",
                marginTop: "1.2rem",
              }}
            >
              <Link
                to={`/courses/${inspectedCourse.id}`}
                className="btn btn-primary btn-sm"
              >
                Open Course Page
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deletingCourse)}
        title="Delete Course"
        onClose={() => setDeletingCourse(null)}
      >
        {deletingCourse && (
          <div>
            <p style={{ marginTop: 0, lineHeight: 1.55 }}>
              Are you sure you want to delete{" "}
              <strong>
                {deletingCourse.code} — {deletingCourse.title}
              </strong>
              ? This will permanently cascade and remove all associated core
              materials, student contributions, and requests.
            </p>
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
                onClick={() => setDeletingCourse(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={submitting}
                onClick={() => void handleConfirmDelete()}
              >
                {submitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
