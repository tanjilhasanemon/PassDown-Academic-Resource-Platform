import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  LogOut,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import { adminApi } from "../api/admin";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Modal } from "./Modal";
import { useToast } from "./ToastContext";
import type { User } from "../types";

type ExtendedUser = User & { ban_reason?: string | null };

export function AdminUsersTab({ onChanged }: { onChanged?: () => Promise<void> | void }) {
  const { user: currentAdmin } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailData, setDetailData] = useState<any | null>(null);

  const PAGE_SIZE = 12;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.searchUsers({
        q: query.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }, [query, roleFilter, statusFilter, page, showToast]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(t);
  }, [loadUsers]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBanToggle = async (u: ExtendedUser) => {
    const nextActive = !u.is_active;
    let reason: string | undefined;
    if (!nextActive) {
      const entered = window.prompt(`Enter ban reason for ${u.email}:`, "Policy violation");
      if (entered === null) return;
      reason = entered.trim() || "Policy violation";
    }
    try {
      await adminApi.banUser(u.id, nextActive, reason);
      showToast(`${u.email} ${nextActive ? "unbanned" : "banned"}`, nextActive ? "success" : "info");
      await loadUsers();
      if (onChanged) await onChanged();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleBulkBan = async (isActive: boolean) => {
    if (selectedIds.length === 0) return;
    let reason: string | undefined;
    if (!isActive) {
      const entered = window.prompt(`Ban reason for ${selectedIds.length} selected user(s):`, "Bulk moderation");
      if (entered === null) return;
      reason = entered.trim() || "Bulk moderation";
    }
    try {
      const res = await adminApi.bulkBanUsers(selectedIds, isActive, reason);
      showToast(`Updated ${res.updated_count} user(s)`, "info");
      setSelectedIds([]);
      await loadUsers();
      if (onChanged) await onChanged();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleRoleChange = async (u: ExtendedUser, nextRole: "student" | "admin") => {
    try {
      await adminApi.changeUserRole(u.id, nextRole);
      showToast(`Updated ${u.email} role to ${nextRole.toUpperCase()}`, "success");
      await loadUsers();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const handleRevokeSessions = async (u: ExtendedUser) => {
    try {
      const res = await adminApi.revokeUserSessions(u.id);
      showToast(`Revoked ${res.revoked_count} session(s) for ${u.email}`, "info");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const openDetail = async (userId: number) => {
    try {
      const d = await adminApi.getUserDetail(userId);
      setDetailData(d);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="card" style={{ padding: "0.95rem 1.1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr auto", gap: "0.65rem" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "2.1rem" }}
              placeholder="Search users by name or email..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <select className="form-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All Roles</option>
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
          <select className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void adminApi.exportUsersCsv({ q: query.trim() || undefined, role: roleFilter || undefined, status: statusFilter || undefined })}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {selectedIds.length > 0 && (
              <>
                <span className="badge badge-info">{selectedIds.length} selected</span>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => void handleBulkBan(false)}>
                  <UserX size={13} /> Bulk Ban
                </button>
                <button type="button" className="btn btn-success btn-sm" onClick={() => void handleBulkBan(true)}>
                  <UserCheck size={13} /> Bulk Unban
                </button>
              </>
            )}
          </div>
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Matching users: <strong>{total}</strong></span>
        </div>
      </div>

      {loading ? (
        <div className="skeleton-stack"><div className="skeleton-line" style={{ width: "100%" }} /><div className="skeleton-line" style={{ width: "85%" }} /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "36px" }}></th>
                <th>Name &amp; Email</th>
                <th>Role</th>
                <th>Status &amp; Ban Reason</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = currentAdmin?.id === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      {!isSelf && u.role !== "admin" && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.id)}
                          onChange={() => toggleSelect(u.id)}
                        />
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{u.email}</div>
                    </td>
                    <td>
                      {isSelf ? (
                        <span className="badge badge-info">ADMIN (You)</span>
                      ) : (
                        <select
                          className="form-select"
                          style={{ width: "auto", padding: "0.25rem 0.55rem", fontSize: "0.78rem" }}
                          value={u.role}
                          onChange={(e) => void handleRoleChange(u, e.target.value as "student" | "admin")}
                        >
                          <option value="student">STUDENT</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-success"><UserCheck size={12} /> Active</span>
                      ) : (
                        <div>
                          <span className="badge badge-danger"><UserX size={12} /> Banned</span>
                          {u.ban_reason && (
                            <div style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "0.2rem" }}>
                              {u.ban_reason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem", flexWrap: "nowrap" }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void openDetail(u.id)}>
                          <Eye size={13} /> Details
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleRevokeSessions(u)} title="Revoke active sessions">
                          <LogOut size={13} /> Revoke
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            className={`btn btn-sm ${u.is_active ? "btn-danger" : "btn-success"}`}
                            onClick={() => void handleBanToggle(u)}
                          >
                            {u.is_active ? "Ban" : "Unban"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.85rem" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Page {page} of {totalPages}</span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} /> Prev
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {detailData && (
        <Modal isOpen={Boolean(detailData)} title={`User Detail: ${detailData.user.name}`} onClose={() => setDetailData(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem" }}>
            <div>
              <strong>Email:</strong> {detailData.user.email} · <strong>Role:</strong> {detailData.user.role.toUpperCase()}
              {detailData.user.ban_reason && (
                <div style={{ color: "var(--danger)", marginTop: "0.25rem" }}>
                  <strong>Ban Reason:</strong> {detailData.user.ban_reason}
                </div>
              )}
            </div>
            <div>
              <strong>Study Groups ({detailData.groups.length}):</strong>{" "}
              {detailData.groups.length > 0 ? detailData.groups.map((g: any) => `${g.name} (${g.role})`).join(", ") : "None"}
            </div>
            <div>
              <strong>Contributions ({detailData.contributions.length}):</strong>{" "}
              {detailData.contributions.length > 0 ? detailData.contributions.map((c: any) => `${c.title} [${c.status}]`).join(" • ") : "None"}
            </div>
            <div>
              <strong>Sessions ({detailData.sessions.length}):</strong>
              <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem" }}>
                {detailData.sessions.map((s: any) => (
                  <li key={s.id}>
                    #{s.id} · {s.browser || "Unknown"} · {s.ip_address || "—"} · {s.revoked_at ? "Revoked" : "Active"}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Recent Activity ({detailData.activity.length}):</strong>
              <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem" }}>
                {detailData.activity.slice(0, 6).map((a: any) => (
                  <li key={a.id}>
                    <code>{a.action}</code> — {a.details || "—"} ({a.ip_address || "—"})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
