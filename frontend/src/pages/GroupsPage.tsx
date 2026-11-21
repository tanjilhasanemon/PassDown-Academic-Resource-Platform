import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CheckCircle2,
  Edit3,
  ExternalLink,
  PlusCircle,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { extractErrorMessage } from "../api/client";
import { groupsApi } from "../api/groups";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import type { GroupMember, StudyGroupDetail, StudyGroupSummary } from "../types";

export function GroupsPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<StudyGroupSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<StudyGroupDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);

  // Create Group Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Rename Group Modal
  const [showRename, setShowRename] = useState(false);
  const [renameText, setRenameText] = useState("");

  // Add Member Form
  const [memberEmail, setMemberEmail] = useState("");
  const [mCreate, setMCreate] = useState(true);
  const [mEdit, setMEdit] = useState(false);
  const [mAssign, setMAssign] = useState(false);

  // Add Resource Form
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resType, setResType] = useState("notes");
  const [resNotes, setResNotes] = useState("");

  const loadGroups = useCallback(
    async (preferredId?: number | null) => {
      setLoading(true);
      try {
        const list = await groupsApi.list();
        setGroups(list);
        if (list.length > 0) {
          const nextId =
            preferredId && list.some((g) => g.id === preferredId)
              ? preferredId
              : list[0].id;
          setSelectedId(nextId);
          const det = await groupsApi.getDetail(nextId);
          setDetail(det);
        } else {
          setSelectedId(null);
          setDetail(null);
        }
      } catch (err) {
        showToast(extractErrorMessage(err), "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const selectGroup = async (id: number) => {
    if (id === selectedId && detail?.id === id) return;
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const det = await groupsApi.getDetail(id);
      setDetail(det);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const created = await groupsApi.create({
        name: newName,
        course_code: newCourse || undefined,
        description: newDesc || undefined,
      });
      setShowCreate(false);
      setNewName("");
      setNewCourse("");
      setNewDesc("");
      setSelectedId(created.id);
      setDetail(created);
      showToast(`Created study group "${created.name}"`, "success");
      const list = await groupsApi.list();
      setGroups(list);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRenameGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    try {
      const updated = await groupsApi.update(detail.id, { name: renameText });
      setDetail(updated);
      setShowRename(false);
      showToast("Study group renamed", "success");
      const list = await groupsApi.list();
      setGroups(list);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDeleteGroup = async () => {
    if (!detail || !window.confirm(`Delete study group "${detail.name}"?`)) return;
    try {
      await groupsApi.remove(detail.id);
      showToast(`Deleted "${detail.name}"`, "info");
      setSelectedId(null);
      await loadGroups();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    try {
      const updated = await groupsApi.addMember(detail.id, {
        email: memberEmail,
        can_create: mCreate,
        can_edit: mEdit,
        can_assign: mAssign,
      });
      setDetail(updated);
      setMemberEmail("");
      showToast("Member permissions saved", "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleTogglePerm = async (m: GroupMember, field: "can_create" | "can_edit" | "can_assign") => {
    if (!detail) return;
    try {
      const updated = await groupsApi.updateMember(detail.id, m.user_id, {
        can_create: field === "can_create" ? !m.can_create : m.can_create,
        can_edit: field === "can_edit" ? !m.can_edit : m.can_edit,
        can_assign: field === "can_assign" ? !m.can_assign : m.can_assign,
      });
      setDetail(updated);
      showToast(`Updated permissions for ${m.name}`, "info");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleRemoveMember = async (m: GroupMember) => {
    if (!detail) return;
    try {
      const updated = await groupsApi.removeMember(detail.id, m.user_id);
      setDetail(updated);
      showToast(`Removed ${m.name}`, "info");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleAddResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    try {
      const updated = await groupsApi.addResource(detail.id, {
        title: resTitle,
        url: resUrl,
        resource_type: resType,
        notes: resNotes || undefined,
      });
      setDetail(updated);
      setResTitle("");
      setResUrl("");
      setResNotes("");
      showToast("Shared resource added to group", "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleToggleStatus = async (resId: number, currentStatus: string) => {
    if (!detail) return;
    try {
      const updated = await groupsApi.updateResource(detail.id, resId, {
        status: currentStatus === "done" ? "open" : "done",
      });
      setDetail(updated);
      showToast("Resource status updated", "info");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleAssignResource = async (resId: number, assigneeId: string) => {
    if (!detail) return;
    try {
      const updated = await groupsApi.updateResource(detail.id, resId, {
        assigned_to_id: assigneeId ? Number(assigneeId) : null,
        update_assignment: true,
      });
      setDetail(updated);
      showToast("Assignee updated", "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleDeleteResource = async (resId: number) => {
    if (!detail) return;
    try {
      const updated = await groupsApi.removeResource(detail.id, resId);
      setDetail(updated);
      showToast("Resource removed", "info");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  return (
    <div>
      <section className="hero-banner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <span className="hero-eyebrow">
              <Shield size={14} /> Shared Study Groups • Fine-Grained RBAC
            </span>
            <h1 className="hero-title">Collaborative Study Groups</h1>
            <p className="hero-subtitle">
              Share course materials with teammates using fine-grained permissions (Create, Edit, Assign).
              Only the group owner can rename, delete, or manage members.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <PlusCircle size={16} /> New Study Group
          </button>
        </div>
      </section>

      {loading ? (
        <div className="skeleton-stack" aria-busy="true">
          <div className="skeleton-line" style={{ width: "35%" }} />
          <div className="skeleton-line" style={{ width: "100%" }} />
          <div className="skeleton-line" style={{ width: "85%" }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <p>You are not in any study groups yet. Create one to start sharing resources with fine-grained permissions.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <PlusCircle size={14} /> Create First Study Group
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.25rem", alignItems: "start" }}>
          {/* Sidebar list of groups */}
          <aside className="card" style={{ padding: "0.9rem" }}>
            <h2 className="sidebar-section-title" style={{ marginBottom: "0.65rem" }}>Your Study Groups</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`sidebar-nav-btn ${selectedId === g.id ? "active" : ""}`}
                  onClick={() => void selectGroup(g.id)}
                >
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>{g.name}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      {g.is_owner ? "Owner" : "Member"} · {g.member_count + 1} people · {g.resource_count} items
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Active Group Detail */}
          {detailLoading ? (
            <div className="skeleton-stack" aria-busy="true">
              <div className="skeleton-line" style={{ width: "40%" }} />
              <div className="skeleton-line" style={{ width: "100%" }} />
              <div className="skeleton-line" style={{ width: "85%" }} />
            </div>
          ) : detail && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
              <div className="card" style={{ padding: "1.2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{detail.name}</h2>
                      {detail.course_code && <span className="course-code-badge">{detail.course_code}</span>}
                      <span className={`badge ${detail.is_owner ? "badge-success" : "badge-info"}`}>
                        {detail.is_owner ? "Owner" : "Member"}
                      </span>
                    </div>
                    {detail.description && (
                      <p style={{ margin: "0.4rem 0 0", fontSize: "0.86rem", color: "var(--text-secondary)" }}>
                        {detail.description}
                      </p>
                    )}
                    <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span className={`badge ${detail.my_permissions.can_create ? "badge-success" : "badge-neutral"}`}>
                        Create: {detail.my_permissions.can_create ? "Yes" : "No"}
                      </span>
                      <span className={`badge ${detail.my_permissions.can_edit ? "badge-success" : "badge-neutral"}`}>
                        Edit: {detail.my_permissions.can_edit ? "Yes" : "No"}
                      </span>
                      <span className={`badge ${detail.my_permissions.can_assign ? "badge-success" : "badge-neutral"}`}>
                        Assign: {detail.my_permissions.can_assign ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  {detail.is_owner && (
                    <div style={{ display: "flex", gap: "0.45rem" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setRenameText(detail.name);
                          setShowRename(true);
                        }}
                      >
                        <Edit3 size={14} /> Rename
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void handleDeleteGroup()}>
                        <Trash2 size={14} /> Delete Group
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Shared Resources Section */}
              <div className="card" style={{ padding: "1.2rem" }}>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.02rem" }}>Shared Study Resources ({detail.resources.length})</h3>

                {detail.my_permissions.can_create && (
                  <form
                    onSubmit={(e) => void handleAddResource(e)}
                    style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 0.7fr auto", gap: "0.55rem", marginBottom: "1rem" }}
                  >
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Resource title..."
                      value={resTitle}
                      onChange={(e) => setResTitle(e.target.value)}
                      required
                    />
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://..."
                      value={resUrl}
                      onChange={(e) => setResUrl(e.target.value)}
                      required
                    />
                    <select className="form-select" value={resType} onChange={(e) => setResType(e.target.value)}>
                      <option value="notes">Notes</option>
                      <option value="slides">Slides</option>
                      <option value="past_paper">Past Paper</option>
                      <option value="book">Book</option>
                    </select>
                    <button type="submit" className="btn btn-primary btn-sm">
                      <PlusCircle size={14} /> Add
                    </button>
                  </form>
                )}

                {detail.resources.length === 0 ? (
                  <div className="empty-state">No shared resources in this group yet.</div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>Status</th>
                          <th>Assigned To</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.resources.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{r.title}</div>
                              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                Added by {r.created_by_name} · {r.resource_type}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${r.status === "done" ? "badge-success" : "badge-warning"}`}>
                                {r.status === "done" ? "Reviewed" : "Open"}
                              </span>
                            </td>
                            <td>
                              {detail.my_permissions.can_assign ? (
                                <select
                                  className="form-select"
                                  style={{ padding: "0.28rem 0.5rem", fontSize: "0.8rem" }}
                                  value={r.assigned_to_id ?? ""}
                                  onChange={(e) => void handleAssignResource(r.id, e.target.value)}
                                >
                                  <option value="">Unassigned</option>
                                  <option value={detail.owner_id}>{detail.owner_name} (Owner)</option>
                                  {detail.members.map((m) => (
                                    <option key={m.user_id} value={m.user_id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                                  {r.assigned_to_name || "Unassigned"}
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
                                <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                  Open <ExternalLink size={12} />
                                </a>
                                {detail.my_permissions.can_edit && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-success btn-sm"
                                      onClick={() => void handleToggleStatus(r.id, r.status)}
                                    >
                                      <CheckCircle2 size={13} /> {r.status === "done" ? "Reopen" : "Mark Done"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      onClick={() => void handleDeleteResource(r.id)}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Members & Fine-Grained Permissions */}
              <div className="card" style={{ padding: "1.2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <Users size={17} />
                  <h3 style={{ margin: 0, fontSize: "1.02rem" }}>Members &amp; Permissions</h3>
                </div>

                {detail.is_owner && (
                  <form
                    onSubmit={(e) => void handleAddMember(e)}
                    style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}
                  >
                    <input
                      type="email"
                      className="form-input"
                      style={{ maxWidth: "280px" }}
                      placeholder="Student email to invite..."
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      required
                    />
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem" }}>
                      <input type="checkbox" checked={mCreate} onChange={(e) => setMCreate(e.target.checked)} /> Create
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem" }}>
                      <input type="checkbox" checked={mEdit} onChange={(e) => setMEdit(e.target.checked)} /> Edit
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem" }}>
                      <input type="checkbox" checked={mAssign} onChange={(e) => setMAssign(e.target.checked)} /> Assign
                    </label>
                    <button type="submit" className="btn btn-primary btn-sm">
                      <UserPlus size={14} /> Add Member
                    </button>
                  </form>
                )}

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Create</th>
                        <th>Edit</th>
                        <th>Assign</th>
                        {detail.is_owner && <th style={{ textAlign: "right" }}>Manage</th>}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>{detail.owner_name}</strong>{" "}
                          <span className="badge badge-success">Owner</span>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{detail.owner_email}</div>
                        </td>
                        <td><span className="badge badge-success">Full</span></td>
                        <td><span className="badge badge-success">Full</span></td>
                        <td><span className="badge badge-success">Full</span></td>
                        {detail.is_owner && <td style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "0.8rem" }}>Owner</td>}
                      </tr>
                      {detail.members.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <strong>{m.name}</strong>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{m.email}</div>
                          </td>
                          <td>
                            {detail.is_owner ? (
                              <input type="checkbox" checked={m.can_create} onChange={() => void handleTogglePerm(m, "can_create")} />
                            ) : (
                              <span className={`badge ${m.can_create ? "badge-success" : "badge-neutral"}`}>{m.can_create ? "Yes" : "No"}</span>
                            )}
                          </td>
                          <td>
                            {detail.is_owner ? (
                              <input type="checkbox" checked={m.can_edit} onChange={() => void handleTogglePerm(m, "can_edit")} />
                            ) : (
                              <span className={`badge ${m.can_edit ? "badge-success" : "badge-neutral"}`}>{m.can_edit ? "Yes" : "No"}</span>
                            )}
                          </td>
                          <td>
                            {detail.is_owner ? (
                              <input type="checkbox" checked={m.can_assign} onChange={() => void handleTogglePerm(m, "can_assign")} />
                            ) : (
                              <span className={`badge ${m.can_assign ? "badge-success" : "badge-neutral"}`}>{m.can_assign ? "Yes" : "No"}</span>
                            )}
                          </td>
                          {detail.is_owner && (
                            <td style={{ textAlign: "right" }}>
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => void handleRemoveMember(m)}>
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <Modal isOpen={showCreate} title="Create Study Group" onClose={() => setShowCreate(false)}>
          <form onSubmit={(e) => void handleCreateGroup(e)}>
            <div className="form-group">
              <label className="form-label">Group Name *</label>
              <input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="e.g., CSE309 Final Prep Team" />
            </div>
            <div className="form-group">
              <label className="form-label">Course Code (Optional)</label>
              <input className="form-input" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} placeholder="e.g., CSE309" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What will this group share?" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? "Creating..." : "Create Group"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Rename Group Modal */}
      {showRename && (
        <Modal isOpen={showRename} title="Rename Study Group" onClose={() => setShowRename(false)}>
          <form onSubmit={(e) => void handleRenameGroup(e)}>
            <div className="form-group">
              <label className="form-label">New Group Name *</label>
              <input className="form-input" value={renameText} onChange={(e) => setRenameText(e.target.value)} required />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowRename(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Name</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
