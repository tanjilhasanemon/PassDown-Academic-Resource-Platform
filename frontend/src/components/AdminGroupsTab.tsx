import { useCallback, useEffect, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { adminApi } from "../api/admin";
import { extractErrorMessage } from "../api/client";
import { useToast } from "./ToastContext";

export function AdminGroupsTab({ onChanged }: { onChanged?: () => Promise<void> | void }) {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.listGroupsAdmin(q.trim() || undefined);
      setGroups(data);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }, [q, showToast]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const handleDelete = async (ids: number[]) => {
    if (ids.length === 0 || !window.confirm(`Delete ${ids.length} study group(s)?`)) return;
    try {
      const res = await adminApi.bulkDeleteGroups(ids);
      showToast(`Deleted ${res.deleted_count} study group(s)`, "info");
      setSelectedIds([]);
      await load();
      if (onChanged) await onChanged();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  };

  return (
    <div>
      <div className="card" style={{ padding: "0.9rem 1.1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input className="form-input" style={{ paddingLeft: "2.1rem" }} placeholder="Filter study groups by name or course..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {selectedIds.length > 0 && (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void handleDelete(selectedIds)}>
            <Trash2 size={14} /> Delete Selected ({selectedIds.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className="skeleton-stack"><div className="skeleton-line" style={{ width: "100%" }} /></div>
      ) : groups.length === 0 ? (
        <div className="empty-state">No study groups found.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "36px" }}></th>
                <th>Study Group</th>
                <th>Owner</th>
                <th>Members</th>
                <th>Shared Resources</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(g.id)}
                      onChange={() => setSelectedIds((prev) => prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id])}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{g.name}</div>
                    {g.course_code && <span className="course-code-badge">{g.course_code}</span>}
                  </td>
                  <td>
                    <div>{g.owner_name}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{g.owner_email}</div>
                  </td>
                  <td>{g.member_count}</td>
                  <td>{g.resource_count}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => void handleDelete([g.id])}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
