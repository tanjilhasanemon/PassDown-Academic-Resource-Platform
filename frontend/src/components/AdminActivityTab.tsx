import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { adminApi } from "../api/admin";
import { extractErrorMessage } from "../api/client";
import { useToast } from "./ToastContext";
import type { AuditActivityFilters, AuditLogItem } from "../types";

const PAGE_SIZE = 15;

function actionBadgeClass(action: string): string {
  const lower = action.toLowerCase();
  if (
    lower.includes("fail") ||
    lower.includes("reject") ||
    lower.includes("delete") ||
    lower.includes("lock") ||
    lower.includes("deactivat")
  ) {
    return "badge-danger";
  }
  if (
    lower.includes("approv") ||
    lower.includes("login") ||
    lower.includes("creat") ||
    lower.includes("unlock") ||
    lower.includes("reactivat")
  ) {
    return "badge-success";
  }
  if (lower.includes("updat") || lower.includes("purge") || lower.includes("logout")) {
    return "badge-info";
  }
  return "badge-neutral";
}

function formatUtcTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function AdminActivityTab() {
  const { showToast } = useToast();

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [filtersMeta, setFiltersMeta] = useState<AuditActivityFilters>({
    users: [],
    actions: [],
  });

  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const [live, setLive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [purging, setPurging] = useState<boolean>(false);

  const loadFilters = useCallback(async () => {
    try {
      const meta = await adminApi.getActivityFilters();
      setFiltersMeta(meta);
    } catch {
      // Non-fatal
    }
  }, []);

  const loadActivity = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await adminApi.getActivity({
          q: debouncedQuery || undefined,
          user_email: selectedUser || undefined,
          action: selectedAction || undefined,
          date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
          date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        });
        setItems(res.items);
        setTotal(res.total);
      } catch (err) {
        if (!silent) showToast(extractErrorMessage(err), "error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [debouncedQuery, selectedUser, selectedAction, dateFrom, dateTo, page, showToast]
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    void loadActivity(false);
  }, [loadActivity]);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      void loadActivity(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [live, loadActivity]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await adminApi.exportActivityCsv({
        q: query.trim() || undefined,
        user_email: selectedUser || undefined,
        action: selectedAction || undefined,
        date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
      });
      showToast("Exported activity log to CSV", "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setExporting(false);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm("Purge audit log entries older than 30 days?")) return;
    setPurging(true);
    try {
      const res = await adminApi.purgeActivity(30);
      showToast(
        `Purged ${res.deleted_count} log entries older than ${res.older_than_days} days`,
        "info"
      );
      setPage(1);
      await Promise.all([loadActivity(false), loadFilters()]);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setPurging(false);
    }
  };

  const resetFilters = () => {
    setQuery("");
    setSelectedUser("");
    setSelectedAction("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div
        className="card"
        style={{
          padding: "0.95rem 1.1rem",
          marginBottom: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.65rem",
          }}
        >
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: "2.1rem" }}
              placeholder="Search user, IP, or detail..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="form-select"
            value={selectedUser}
            onChange={(e) => {
              setSelectedUser(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any user</option>
            {filtersMeta.users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any action</option>
            {filtersMeta.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            className="form-input"
            title="From (UTC)"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />

          <input
            type="datetime-local"
            className="form-input"
            title="To (UTC)"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.65rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn btn-sm ${live ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setLive((prev) => !prev)}
            >
              <Activity size={14} />
              {live ? "Live (5s) ON" : "Live Polling"}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadActivity(false)}
            >
              <RefreshCw size={14} /> Refresh
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              <Download size={14} /> {exporting ? "Exporting..." : "Export CSV"}
            </button>

            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void handlePurge()}
              disabled={purging}
            >
              <Trash2 size={14} /> {purging ? "Purging..." : "Purge (>30d)"}
            </button>

            {(query || selectedUser || selectedAction || dateFrom || dateTo) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={resetFilters}
              >
                Clear Filters
              </button>
            )}
          </div>

          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Total entries: <strong>{total}</strong>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="skeleton-stack" aria-busy="true">
          <div className="skeleton-line" style={{ width: "35%" }} />
          <div className="skeleton-line" style={{ width: "100%" }} />
          <div className="skeleton-line" style={{ width: "92%" }} />
          <div className="skeleton-line" style={{ width: "86%" }} />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">No audit log entries match the current filters.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP</th>
                <th>Browser</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="mono" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                    {formatUtcTimestamp(row.created_at)}
                  </td>
                  <td style={{ fontSize: "0.84rem", fontWeight: 600 }}>
                    {row.user_email || <span style={{ color: "var(--text-muted)" }}>anonymous</span>}
                  </td>
                  <td>
                    <span className={`badge ${actionBadgeClass(row.action)}`}>
                      {row.action}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.83rem", color: "var(--text-secondary)" }}>
                    {row.details || "—"}
                  </td>
                  <td className="mono" style={{ fontSize: "0.78rem" }}>
                    {row.ip_address || "—"}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {row.browser || row.user_agent || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "0.9rem",
            flexWrap: "wrap",
            gap: "0.65rem",
          }}
        >
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
