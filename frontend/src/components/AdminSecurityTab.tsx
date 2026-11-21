import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Lock,
  RefreshCw,
  ShieldAlert,
  Unlock,
} from "lucide-react";
import { adminApi } from "../api/admin";
import { extractErrorMessage } from "../api/client";
import { useToast } from "./ToastContext";
import type { SecurityOverview } from "../types";

interface AdminSecurityTabProps {
  onUserUpdated?: () => Promise<void> | void;
}

export function AdminSecurityTab({ onUserUpdated }: AdminSecurityTabProps) {
  const { showToast } = useToast();

  const [minFailures, setMinFailures] = useState<number>(3);
  const [hours, setHours] = useState<number>(24);
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [data, setData] = useState<SecurityOverview>({
    min_failures: 3,
    hours: 24,
    by_ip: [],
    by_account: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);

  const loadSecurity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSecurityOverview({
        min_failures: minFailures,
        hours,
      });
      setData(res);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }, [minFailures, hours, showToast]);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const handleUnlock = async (userId: number, email: string) => {
    setUnlockingId(userId);
    try {
      await adminApi.unlockUser(userId);
      showToast(`Unlocked account ${email}`, "success");
      await loadSecurity();
      if (onUserUpdated) await onUserUpdated();
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setUnlockingId(null);
    }
  };

  const sortedIps = [...data.by_ip].sort((a, b) =>
    sortAsc ? a.failures - b.failures : b.failures - a.failures
  );

  const lockedCount = data.by_account.filter((a) => a.status.toLowerCase() === "locked").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
      <div
        className="card"
        style={{
          padding: "0.95rem 1.15rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.85rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.55rem",
            flexWrap: "wrap",
            fontSize: "0.88rem",
          }}
        >
          <ShieldAlert size={16} style={{ color: "var(--warning)" }} />
          <span>Show addresses and accounts with at least</span>
          <input
            type="number"
            min={1}
            max={50}
            className="form-input"
            style={{ width: "74px", padding: "0.32rem 0.55rem" }}
            value={minFailures}
            onChange={(e) => setMinFailures(Math.max(1, Number(e.target.value) || 1))}
          />
          <span>failed logins or hostile requests in the last</span>
          <select
            className="form-select"
            style={{ width: "auto", padding: "0.32rem 0.7rem" }}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={24}>24 hours</option>
            <option value={168}>7 days</option>
            <option value={720}>30 days</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span className="badge badge-neutral">
            {data.by_ip.length} flagged IPs
          </span>
          <span className={`badge ${lockedCount > 0 ? "badge-danger" : "badge-success"}`}>
            {lockedCount} locked accounts
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadSecurity()}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.55rem",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "0.98rem" }}>By IP address</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSortAsc((prev) => !prev)}
          >
            <ArrowUpDown size={13} /> Failures ({sortAsc ? "Low -> High" : "High -> Low"})
          </button>
        </div>

        {loading ? (
          <div className="skeleton-stack" aria-busy="true">
            <div className="skeleton-line" style={{ width: "40%" }} />
            <div className="skeleton-line" style={{ width: "100%" }} />
            <div className="skeleton-line" style={{ width: "88%" }} />
          </div>
        ) : sortedIps.length === 0 ? (
          <div className="empty-state">
            No IP addresses crossed {minFailures} failures in the last {hours}h.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>IP address</th>
                  <th>Failures</th>
                  <th>What happened</th>
                  <th>Emails tried</th>
                  <th>Browser</th>
                  <th>Last seen (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {sortedIps.map((row) => (
                  <tr key={row.ip_address}>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {row.ip_address}
                    </td>
                    <td>
                      <span className="badge badge-danger">{row.failures}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                        {((row as any).events ?? String((row as any).what_happened || "login failed").split(", ")).map((ev: string) => (
                          <span key={ev} className="badge badge-warning">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {row.emails_tried.length > 0 ? row.emails_tried.join(", ") : "—"}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {row.browser || "—"}
                    </td>
                    <td className="mono" style={{ fontSize: "0.78rem" }}>
                      {new Date(row.last_seen).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 style={{ margin: "0 0 0.55rem", fontSize: "0.98rem" }}>By account</h3>

        {loading ? (
          <div className="skeleton-stack" aria-busy="true">
            <div className="skeleton-line" style={{ width: "40%" }} />
            <div className="skeleton-line" style={{ width: "100%" }} />
            <div className="skeleton-line" style={{ width: "88%" }} />
          </div>
        ) : data.by_account.length === 0 ? (
          <div className="empty-state">
            No accounts crossed {minFailures} failures in the last {hours}h.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Failures</th>
                  <th>From addresses</th>
                  <th>Browser</th>
                  <th>Last seen (UTC)</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.by_account.map((acc) => (
                  <tr key={acc.email}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{acc.email}</div>
                      {acc.name && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          {acc.name}
                        </div>
                      )}
                    </td>
                    <td>
                      {acc.status.toLowerCase() === "locked" ? (
                        <span className="badge badge-warning">
                          <Lock size={12} /> Locked
                        </span>
                      ) : acc.status.toLowerCase() === "deactivated" ? (
                        <span className="badge badge-danger">
                          <AlertTriangle size={12} /> Deactivated
                        </span>
                      ) : acc.status.toLowerCase() === "active" ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-neutral">Unregistered</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-danger">{acc.failures}</span>
                    </td>
                    <td className="mono" style={{ fontSize: "0.78rem" }}>
                      {acc.from_addresses.length > 0 ? acc.from_addresses.join(", ") : "—"}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {acc.browser || "—"}
                    </td>
                    <td className="mono" style={{ fontSize: "0.78rem" }}>
                      {new Date(acc.last_seen).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {acc.user_id && acc.status.toLowerCase() === "locked" ? (
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          disabled={unlockingId === acc.user_id}
                          onClick={() => void handleUnlock(acc.user_id!, acc.email)}
                        >
                          <Unlock size={13} />
                          {unlockingId === acc.user_id ? "Unlocking..." : "Unlock"}
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
