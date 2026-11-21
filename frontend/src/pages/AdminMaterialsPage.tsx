import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Edit3,
  ExternalLink,
  Eye,
  PlusCircle,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { coursesApi } from "../api/courses";
import { materialsApi } from "../api/materials";
import { extractErrorMessage } from "../api/client";
import { MaterialTypeBadge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import {
  MATERIAL_TYPES,
  type CoreMaterial,
  type CoreMaterialPayload,
  type Course,
  type MaterialType,
} from "../types";

export function AdminMaterialsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = Number(searchParams.get("courseId")) || 0;

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(initialCourseId);
  const [typeFilter, setTypeFilter] = useState<MaterialType | "">("");
  const [materials, setMaterials] = useState<CoreMaterial[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Create / Edit Modal
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<CoreMaterial | null>(null);
  const [formData, setFormData] = useState<CoreMaterialPayload>({
    title: "",
    type: "slides",
    url: "",
    description: "",
  });

  // Read Single Inspector Modal (calls GET /api/v1/core-materials/{id})
  const [inspectedMaterial, setInspectedMaterial] = useState<CoreMaterial | null>(
    null
  );

  const loadCourses = useCallback(async () => {
    try {
      const res = await coursesApi.list({ limit: 100 });
      setCourses(res.items);
      if (res.items.length > 0 && !selectedCourseId) {
        const firstId = res.items[0].id;
        setSelectedCourseId(firstId);
        setSearchParams({ courseId: String(firstId) }, { replace: true });
      }
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }, [selectedCourseId, setSearchParams, showToast]);

  const loadMaterials = useCallback(async () => {
    if (!selectedCourseId) {
      setMaterials([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await materialsApi.listByCourse(selectedCourseId, {
        type: typeFilter,
        limit: 100,
      });
      setMaterials(res.items);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId, typeFilter, showToast]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const openCreateModal = () => {
    setEditingMaterial(null);
    setFormData({
      title: "",
      type: "slides",
      url: "",
      description: "",
    });
    setIsFormOpen(true);
  };

  const openEditModal = (material: CoreMaterial) => {
    setEditingMaterial(material);
    setFormData({
      title: material.title,
      type: material.type,
      url: material.url,
      description: material.description ?? "",
    });
    setIsFormOpen(true);
  };

  const handleInspectSingle = async (materialId: number) => {
    try {
      const item = await materialsApi.getById(materialId);
      setInspectedMaterial(item);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleSaveMaterial = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCourseId) {
      showToast("Please select a course first", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (editingMaterial) {
        await materialsApi.update(editingMaterial.id, formData);
        showToast("Core material updated", "success");
      } else {
        await materialsApi.create(selectedCourseId, formData);
        showToast("Core material added", "success");
      }
      setIsFormOpen(false);
      await loadMaterials();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (material: CoreMaterial) => {
    try {
      await materialsApi.remove(material.id);
      showToast(`Deleted "${material.title}"`, "info");
      await loadMaterials();
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
            <span className="hero-eyebrow">Admin Workspace • Core Material CRUD</span>
            <h1 className="hero-title">Curate Core Course Materials</h1>
            <p className="hero-subtitle">
              Add official lecture slides, reference notes, past papers, and
              textbooks per course. Only validated http/https URLs are accepted.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedCourseId}
            onClick={openCreateModal}
          >
            <PlusCircle size={17} /> Add Core Material
          </button>
        </div>
      </section>

      <div className="toolbar">
        <div style={{ minWidth: "280px", flex: 1 }}>
          <label className="form-label">Select Course</label>
          <select
            className="form-select"
            value={selectedCourseId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedCourseId(id);
              setSearchParams({ courseId: String(id) });
            }}
          >
            {courses.length === 0 && <option value={0}>No courses available</option>}
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Filter by Resource Type</label>
          <div className="filter-pills">
            <button
              type="button"
              className={`filter-pill ${typeFilter === "" ? "active" : ""}`}
              onClick={() => setTypeFilter("")}
            >
              All Types
            </button>
            {MATERIAL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`filter-pill ${typeFilter === t.value ? "active" : ""}`}
                onClick={() => setTypeFilter(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading core materials...</div>
      ) : materials.length === 0 ? (
        <div className="empty-state">
          <p>No core materials found for this course and filter.</p>
          {selectedCourseId > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openCreateModal}
            >
              <PlusCircle size={15} /> Add First Core Material
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title & Description</th>
                <th>Type</th>
                <th>External Resource Link</th>
                <th style={{ textAlign: "right" }}>CRUD Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) => (
                <tr key={mat.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{mat.title}</div>
                    {mat.description && (
                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)",
                          marginTop: "0.2rem",
                        }}
                      >
                        {mat.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <MaterialTypeBadge type={mat.type} />
                  </td>
                  <td>
                    <a
                      href={mat.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      Open Link <ExternalLink size={13} />
                    </a>
                    <div className="external-link-notice" style={{ marginTop: "0.25rem" }}>
                      <ShieldAlert size={12} /> Opens external host in new tab
                    </div>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.45rem",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleInspectSingle(mat.id)}
                        title="Read Single CoreMaterial via GET /api/v1/core-materials/{id}"
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(mat)}
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDeleteMaterial(mat)}
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        title={editingMaterial ? "Edit Core Material" : "Add Core Material"}
        onClose={() => setIsFormOpen(false)}
      >
        <form onSubmit={handleSaveMaterial}>
          <div className="form-group">
            <label className="form-label">Resource Title *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={3}
              maxLength={200}
              placeholder="e.g. Week 1–6 Complete Lecture Slides"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Material Type *</label>
            <select
              className="form-select"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as MaterialType })
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
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-textarea"
              maxLength={1000}
              placeholder="Brief overview of what this link covers..."
              value={formData.description ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
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
                : editingMaterial
                ? "Update Material"
                : "Add Material"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Read Single Inspector Modal */}
      <Modal
        isOpen={Boolean(inspectedMaterial)}
        title={`Core Material #${inspectedMaterial?.id ?? ""}`}
        onClose={() => setInspectedMaterial(null)}
      >
        {inspectedMaterial && (
          <div>
            <MaterialTypeBadge type={inspectedMaterial.type} />
            <h4 style={{ margin: "0.65rem 0 0.35rem", fontSize: "1.1rem" }}>
              {inspectedMaterial.title}
            </h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {inspectedMaterial.description || "No description provided."}
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
              <div>GET /api/v1/core-materials/{inspectedMaterial.id}</div>
              <div>URL: {inspectedMaterial.url}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
