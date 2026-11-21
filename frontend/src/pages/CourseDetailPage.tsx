import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  HelpCircle,
  LogIn,
  PlusCircle,
  ShieldAlert,
  Trash2,
  UploadCloud,
  User,
} from "lucide-react";
import { coursesApi } from "../api/courses";
import { materialsApi } from "../api/materials";
import { contributionsApi } from "../api/contributions";
import { meApi } from "../api/me";
import { requestsApi } from "../api/requests";
import { extractErrorMessage } from "../api/client";
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
  type ContributionUpdatePayload,
  type CoreMaterial,
  type Course,
  type MaterialRequest,
  type MaterialRequestCreatePayload,
  type MaterialRequestUpdatePayload,
  type MaterialType,
  type RequestStatus,
} from "../types";

type ActiveTab = "materials" | "contributions" | "requests";

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id) || 0;
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [loadingCourse, setLoadingCourse] = useState<boolean>(true);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("materials");

  const [materials, setMaterials] = useState<CoreMaterial[]>([]);
  const [materialTypeFilter, setMaterialTypeFilter] = useState<MaterialType | "">("");

  const [approvedContributions, setApprovedContributions] = useState<Contribution[]>([]);
  const [myPendingInCourse, setMyPendingInCourse] = useState<Contribution[]>([]);
  const [contribTypeFilter, setContribTypeFilter] = useState<MaterialType | "">("");

  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatus | "">("");

  const [isContribCreateOpen, setIsContribCreateOpen] = useState<boolean>(false);
  const [contribCreateForm, setContribCreateForm] = useState<ContributionCreatePayload>({
    title: "",
    type: "notes",
    url: "",
    description: "",
  });

  const [editingContribution, setEditingContribution] = useState<Contribution | null>(
    null
  );
  const [contribEditForm, setContribEditForm] = useState<ContributionUpdatePayload>({
    title: "",
    type: "notes",
    url: "",
    description: "",
  });

  const [inspectedContribution, setInspectedContribution] =
    useState<Contribution | null>(null);

  const [isRequestCreateOpen, setIsRequestCreateOpen] = useState<boolean>(false);
  const [requestCreateForm, setRequestCreateForm] =
    useState<MaterialRequestCreatePayload>({
      title: "",
      description: "",
    });

  const [editingRequest, setEditingRequest] = useState<MaterialRequest | null>(null);
  const [requestEditForm, setRequestEditForm] =
    useState<MaterialRequestUpdatePayload>({
      title: "",
      description: "",
    });

  const [inspectedRequest, setInspectedRequest] = useState<MaterialRequest | null>(
    null
  );

  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadCourseData = useCallback(async () => {
    if (!courseId) return;
    setLoadingCourse(true);
    setCourseError(null);
    try {
      const courseData = await coursesApi.getById(courseId);
      setCourse(courseData);
    } catch (err) {
      setCourseError(extractErrorMessage(err));
    } finally {
      setLoadingCourse(false);
    }
  }, [courseId]);

  const loadMaterials = useCallback(async () => {
    if (!courseId) return;
    try {
      const res = await materialsApi.listByCourse(courseId, {
        type: materialTypeFilter,
        limit: 100,
      });
      setMaterials(res.items);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }, [courseId, materialTypeFilter, showToast]);

  const loadContributions = useCallback(async () => {
    if (!courseId) return;
    try {
      const approvedRes = await contributionsApi.listApprovedByCourse(courseId, {
        type: contribTypeFilter,
        limit: 100,
      });
      setApprovedContributions(approvedRes.items);

      if (isAuthenticated) {
        const myPending = await meApi.listContributions({
          status: "pending",
          limit: 100,
        });
        setMyPendingInCourse(
          myPending.items.filter((item) => item.course_id === courseId)
        );
      } else {
        setMyPendingInCourse([]);
      }
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }, [courseId, contribTypeFilter, isAuthenticated, showToast]);

  const loadRequests = useCallback(async () => {
    if (!courseId) return;
    try {
      const res = await requestsApi.listByCourse(courseId, {
        status: requestStatusFilter,
        limit: 100,
      });
      setRequests(res.items);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }, [courseId, requestStatusFilter, showToast]);

  useEffect(() => {
    void loadCourseData();
  }, [loadCourseData]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    void loadContributions();
  }, [loadContributions]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const canModifyContribution = (item: Contribution): boolean => {
    if (!user) return false;
    return isAdmin || item.author_id === user.id;
  };

  const canModifyRequest = (req: MaterialRequest): boolean => {
    if (!user) return false;
    return isAdmin || req.author_id === user.id;
  };

  const handleCreateContribution = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await contributionsApi.create(courseId, contribCreateForm);
      showToast("Contribution submitted as pending review!", "success");
      setIsContribCreateOpen(false);
      setContribCreateForm({
        title: "",
        type: "notes",
        url: "",
        description: "",
      });
      setActiveTab("contributions");
      await loadContributions();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditContribution = (item: Contribution) => {
    setEditingContribution(item);
    setContribEditForm({
      title: item.title,
      type: item.type,
      url: item.url,
      description: item.description ?? "",
    });
  };

  const handleUpdateContribution = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingContribution) return;
    setSubmitting(true);
    try {
      await contributionsApi.update(editingContribution.id, contribEditForm);
      showToast("Pending contribution updated", "success");
      setEditingContribution(null);
      await loadContributions();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspectContribution = async (contributionId: number) => {
    try {
      const fresh = await contributionsApi.getById(contributionId);
      setInspectedContribution(fresh);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDeleteContribution = async (item: Contribution) => {
    try {
      await contributionsApi.remove(item.id);
      showToast(`Deleted contribution "${item.title}"`, "info");
      await loadContributions();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleCreateRequest = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestsApi.create(courseId, requestCreateForm);
      showToast("Material request posted!", "success");
      setIsRequestCreateOpen(false);
      setRequestCreateForm({ title: "", description: "" });
      setActiveTab("requests");
      await loadRequests();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditRequest = (req: MaterialRequest) => {
    setEditingRequest(req);
    setRequestEditForm({
      title: req.title,
      description: req.description ?? "",
    });
  };

  const handleUpdateRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingRequest) return;
    setSubmitting(true);
    try {
      await requestsApi.update(editingRequest.id, requestEditForm);
      showToast("Request updated", "success");
      setEditingRequest(null);
      await loadRequests();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspectRequest = async (requestId: number) => {
    try {
      const fresh = await requestsApi.getById(requestId);
      setInspectedRequest(fresh);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleFulfillRequest = async (req: MaterialRequest) => {
    try {
      await requestsApi.fulfill(req.id);
      showToast(`Marked "${req.title}" as fulfilled`, "success");
      await loadRequests();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDeleteRequest = async (req: MaterialRequest) => {
    try {
      await requestsApi.remove(req.id);
      showToast(`Deleted request "${req.title}"`, "info");
      await loadRequests();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  if (loadingCourse) {
    return <div className="empty-state">Loading course workspace...</div>;
  }

  if (courseError || !course) {
    return (
      <div className="empty-state">
        <h3 style={{ color: "var(--danger)", marginTop: 0 }}>
          {courseError || "Course not found"}
        </h3>
        <Link to="/" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} /> Back to Course Catalog
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} /> Back to Courses
        </Link>
      </div>

      <section className="hero-banner">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                marginBottom: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <span className="course-code-badge">{course.code}</span>
              {course.department && (
                <span className="badge badge-info">{course.department}</span>
              )}
              {course.semester_offered && (
                <span className="badge badge-neutral">{course.semester_offered}</span>
              )}
            </div>
            <h1 className="hero-title">{course.title}</h1>
            <p className="hero-subtitle">
              Access official core resources, approved student contributions, or
              request missing study materials for {course.code}.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsContribCreateOpen(true)}
                >
                  <UploadCloud size={16} /> Contribute Link
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRequestCreateOpen(true)}
                >
                  <PlusCircle size={16} /> Request Material
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary">
                <LogIn size={16} /> Sign In to Contribute or Request
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "materials"}
          className={`tab-btn ${activeTab === "materials" ? "active" : ""}`}
          onClick={() => setActiveTab("materials")}
        >
          <BookOpen size={16} />
          Core Materials
          <span className="badge badge-neutral">{materials.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "contributions"}
          className={`tab-btn ${activeTab === "contributions" ? "active" : ""}`}
          onClick={() => setActiveTab("contributions")}
        >
          <UploadCloud size={16} />
          Student Contributions
          <span className="badge badge-success">{approvedContributions.length}</span>
          {myPendingInCourse.length > 0 && (
            <span className="badge badge-warning">
              {myPendingInCourse.length} my pending
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "requests"}
          className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          <HelpCircle size={16} />
          Material Requests
          <span className="badge badge-neutral">{requests.length}</span>
        </button>
      </div>

      {/* TAB 1: Core Materials */}
      {activeTab === "materials" && (
        <div>
          <div className="toolbar">
            <div className="filter-pills">
              <button
                type="button"
                className={`filter-pill ${materialTypeFilter === "" ? "active" : ""}`}
                onClick={() => setMaterialTypeFilter("")}
              >
                All Types
              </button>
              {MATERIAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`filter-pill ${
                    materialTypeFilter === t.value ? "active" : ""
                  }`}
                  onClick={() => setMaterialTypeFilter(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {isAdmin && (
              <Link
                to={`/admin/materials?courseId=${course.id}`}
                className="btn btn-secondary btn-sm"
              >
                Manage Core Materials
              </Link>
            )}
          </div>

          {materials.length === 0 ? (
            <div className="empty-state">
              <p>No core materials found for this filter.</p>
              {isAdmin && (
                <Link
                  to={`/admin/materials?courseId=${course.id}`}
                  className="btn btn-primary btn-sm"
                >
                  + Add Core Material
                </Link>
              )}
            </div>
          ) : (
            <div className="cards-grid">
              {materials.map((mat) => (
                <article key={mat.id} className="glass-card">
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <MaterialTypeBadge type={mat.type} />
                      <span className="badge badge-neutral">Official Core</span>
                    </div>
                    <h3 style={{ margin: "0 0 0.45rem", fontSize: "1.08rem" }}>
                      {mat.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--text-secondary)",
                        fontSize: "0.88rem",
                        lineHeight: 1.5,
                      }}
                    >
                      {mat.description || "Curated baseline resource for this course."}
                    </p>
                  </div>

                  <div
                    style={{
                      paddingTop: "0.85rem",
                      borderTop: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="external-link-notice">
                      <ShieldAlert size={13} /> External resource link
                    </span>
                    <a
                      href={mat.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      Open Resource <ExternalLink size={14} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Student Contributions */}
      {activeTab === "contributions" && (
        <div>
          <div className="toolbar">
            <div className="filter-pills">
              <button
                type="button"
                className={`filter-pill ${contribTypeFilter === "" ? "active" : ""}`}
                onClick={() => setContribTypeFilter("")}
              >
                All Approved
              </button>
              {MATERIAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`filter-pill ${
                    contribTypeFilter === t.value ? "active" : ""
                  }`}
                  onClick={() => setContribTypeFilter(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsContribCreateOpen(true)}
              >
                <UploadCloud size={15} /> Submit Contribution
              </button>
            ) : (
              <Link to="/login" className="btn btn-secondary btn-sm">
                <LogIn size={14} /> Login to Contribute
              </Link>
            )}
          </div>

          {approvedContributions.length === 0 ? (
            <div className="empty-state">
              <p>No approved student contributions match this filter yet.</p>
            </div>
          ) : (
            <div className="cards-grid">
              {approvedContributions.map((item) => (
                <article key={item.id} className="glass-card">
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <MaterialTypeBadge type={item.type} />
                      <ContributionStatusBadge status={item.status} />
                    </div>
                    <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.08rem" }}>
                      {item.title}
                    </h3>
                    <p
                      style={{
                        margin: "0 0 0.65rem",
                        color: "var(--text-secondary)",
                        fontSize: "0.88rem",
                      }}
                    >
                      {item.description || "Shared by a fellow student."}
                    </p>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      <User size={13} /> Contributed by{" "}
                      <strong style={{ color: "var(--text-primary)" }}>
                        {item.author_name}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      paddingTop: "0.85rem",
                      borderTop: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.45rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleInspectContribution(item.id)}
                      >
                        <Eye size={13} /> View
                      </button>
                      {canModifyContribution(item) && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void handleDeleteContribution(item)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      Open Link <ExternalLink size={13} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {myPendingInCourse.length > 0 && (
            <div style={{ marginTop: "2.25rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                    Your Pending Submissions for {course.code}
                  </h3>
                  <p
                    style={{
                      margin: "0.2rem 0 0",
                      fontSize: "0.84rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    You can edit or delete your pending submissions before an admin reviews them.
                  </p>
                </div>
                <Link to="/dashboard" className="btn btn-secondary btn-sm">
                  View All on My Dashboard
                </Link>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPendingInCourse.map((item) => (
                      <tr key={item.id}>
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
                              onClick={() => openEditContribution(item)}
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleDeleteContribution(item)}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Material Requests */}
      {activeTab === "requests" && (
        <div>
          <div className="toolbar">
            <div className="filter-pills">
              <button
                type="button"
                className={`filter-pill ${requestStatusFilter === "" ? "active" : ""}`}
                onClick={() => setRequestStatusFilter("")}
              >
                All Requests
              </button>
              <button
                type="button"
                className={`filter-pill ${
                  requestStatusFilter === "open" ? "active" : ""
                }`}
                onClick={() => setRequestStatusFilter("open")}
              >
                Open
              </button>
              <button
                type="button"
                className={`filter-pill ${
                  requestStatusFilter === "fulfilled" ? "active" : ""
                }`}
                onClick={() => setRequestStatusFilter("fulfilled")}
              >
                Fulfilled
              </button>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsRequestCreateOpen(true)}
              >
                <PlusCircle size={15} /> Post Request
              </button>
            ) : (
              <Link to="/login" className="btn btn-secondary btn-sm">
                <LogIn size={14} /> Login to Request
              </Link>
            )}
          </div>

          {requests.length === 0 ? (
            <div className="empty-state">
              <p>No material requests found for this course and filter.</p>
            </div>
          ) : (
            <div className="cards-grid">
              {requests.map((req) => (
                <article key={req.id} className="glass-card">
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <RequestStatusBadge status={req.status} />
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        Requested by <strong>{req.author_name}</strong>
                      </span>
                    </div>
                    <h3 style={{ margin: "0 0 0.45rem", fontSize: "1.06rem" }}>
                      {req.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--text-secondary)",
                        fontSize: "0.88rem",
                      }}
                    >
                      {req.description || "No additional details provided."}
                    </p>
                  </div>

                  <div
                    style={{
                      paddingTop: "0.85rem",
                      borderTop: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.45rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleInspectRequest(req.id)}
                      >
                        <Eye size={13} /> View
                      </button>
                      {canModifyRequest(req) && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditRequest(req)}
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void handleDeleteRequest(req)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>

                    {req.status === "open" && canModifyRequest(req) && (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => void handleFulfillRequest(req)}
                      >
                        <CheckCircle2 size={14} /> Mark Fulfilled
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Contribution Modal */}
      <Modal
        isOpen={isContribCreateOpen}
        title={`Contribute Material for ${course.code}`}
        onClose={() => setIsContribCreateOpen(false)}
      >
        <form onSubmit={handleCreateContribution}>
          <div className="form-group">
            <label className="form-label">Resource Title *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={3}
              maxLength={200}
              placeholder="e.g. Complete Midterm & Final Handwritten Notes"
              value={contribCreateForm.title}
              onChange={(e) =>
                setContribCreateForm({ ...contribCreateForm, title: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Material Type *</label>
            <select
              className="form-select"
              value={contribCreateForm.type}
              onChange={(e) =>
                setContribCreateForm({
                  ...contribCreateForm,
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
            <label className="form-label">Resource Link (http:// or https://) *</label>
            <input
              type="url"
              className="form-input"
              required
              placeholder="https://drive.google.com/..."
              value={contribCreateForm.url}
              onChange={(e) =>
                setContribCreateForm({ ...contribCreateForm, url: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-textarea"
              maxLength={1000}
              placeholder="Topics covered, semester, instructor..."
              value={contribCreateForm.description ?? ""}
              onChange={(e) =>
                setContribCreateForm({
                  ...contribCreateForm,
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
              onClick={() => setIsContribCreateOpen(false)}
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

      {/* Edit Pending Contribution Modal */}
      <Modal
        isOpen={Boolean(editingContribution)}
        title="Edit Pending Contribution"
        onClose={() => setEditingContribution(null)}
      >
        <form onSubmit={handleUpdateContribution}>
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
              onClick={() => setEditingContribution(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Read Single Contribution Inspector Modal */}
      <Modal
        isOpen={Boolean(inspectedContribution)}
        title={`Contribution Record #${inspectedContribution?.id ?? ""}`}
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
              By {inspectedContribution.author_name} •{" "}
              {inspectedContribution.description || "No description"}
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

      {/* Post Request Modal */}
      <Modal
        isOpen={isRequestCreateOpen}
        title={`Request Missing Material for ${course.code}`}
        onClose={() => setIsRequestCreateOpen(false)}
      >
        <form onSubmit={handleCreateRequest}>
          <div className="form-group">
            <label className="form-label">What material are you looking for? (5–200 chars) *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={5}
              maxLength={200}
              placeholder="e.g. Need Autumn 2025 Final Exam Question Paper"
              value={requestCreateForm.title}
              onChange={(e) =>
                setRequestCreateForm({
                  ...requestCreateForm,
                  title: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Additional Details (optional)</label>
            <textarea
              className="form-textarea"
              maxLength={1000}
              placeholder="Any specific section, instructor, or topic..."
              value={requestCreateForm.description ?? ""}
              onChange={(e) =>
                setRequestCreateForm({
                  ...requestCreateForm,
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
              onClick={() => setIsRequestCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Posting..." : "Post Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Request Modal */}
      <Modal
        isOpen={Boolean(editingRequest)}
        title="Edit Material Request"
        onClose={() => setEditingRequest(null)}
      >
        <form onSubmit={handleUpdateRequest}>
          <div className="form-group">
            <label className="form-label">Request Title (5–200 chars) *</label>
            <input
              type="text"
              className="form-input"
              required
              minLength={5}
              maxLength={200}
              value={requestEditForm.title}
              onChange={(e) =>
                setRequestEditForm({ ...requestEditForm, title: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              maxLength={1000}
              value={requestEditForm.description ?? ""}
              onChange={(e) =>
                setRequestEditForm({
                  ...requestEditForm,
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
              onClick={() => setEditingRequest(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Update Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Read Single Request Inspector Modal */}
      <Modal
        isOpen={Boolean(inspectedRequest)}
        title={`Request Record #${inspectedRequest?.id ?? ""}`}
        onClose={() => setInspectedRequest(null)}
      >
        {inspectedRequest && (
          <div>
            <RequestStatusBadge status={inspectedRequest.status} />
            <h4 style={{ margin: "0.65rem 0 0.35rem", fontSize: "1.1rem" }}>
              {inspectedRequest.title}
            </h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
              Requested by {inspectedRequest.author_name} •{" "}
              {inspectedRequest.description || "No description"}
            </p>
            <div
              className="mono"
              style={{
                padding: "0.85rem",
                borderRadius: "12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.78rem",
              }}
            >
              <div>GET /api/v1/requests/{inspectedRequest.id}</div>
              <div>Status: {inspectedRequest.status}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
