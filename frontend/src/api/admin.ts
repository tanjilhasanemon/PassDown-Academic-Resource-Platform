import { apiClient } from "./client";
import type {
  AuditActivityFilters,
  AuditLogItem,
  PaginatedResponse,
  PlatformStats,
  PurgeActivityResult,
  SecurityOverview,
  User,
} from "../types";

export const adminApi = {
  async getStats(): Promise<PlatformStats> {
    const response = await apiClient.get<PlatformStats>("/admin/stats", {
      params: { _t: Date.now() },
    });
    return response.data;
  },

  async listUsers(params?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<User>> {
    const response = await apiClient.get<PaginatedResponse<User>>(
      "/admin/users",
      {
        params: {
          limit: params?.limit ?? 100,
          offset: params?.offset ?? 0,
          _t: Date.now(),
        },
      }
    );
    return response.data;
  },

  async setUserActive(userId: number, isActive: boolean): Promise<User> {
    const response = await apiClient.patch<User>(
      `/admin/users/${userId}/active`,
      { is_active: isActive }
    );
    return response.data;
  },

  async unlockUser(userId: number): Promise<User> {
    const response = await apiClient.post<User>(`/admin/users/${userId}/unlock`);
    return response.data;
  },

  async getActivity(params?: {
    q?: string;
    user_email?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<AuditLogItem>> {
    const response = await apiClient.get<PaginatedResponse<AuditLogItem>>(
      "/admin/activity",
      {
        params: {
          q: params?.q || undefined,
          user_email: params?.user_email || undefined,
          action: params?.action || undefined,
          date_from: params?.date_from || undefined,
          date_to: params?.date_to || undefined,
          limit: params?.limit ?? 15,
          offset: params?.offset ?? 0,
          _t: Date.now(),
        },
      }
    );
    return response.data;
  },

  async getActivityFilters(): Promise<AuditActivityFilters> {
    const response = await apiClient.get<AuditActivityFilters>(
      "/admin/activity/filters",
      { params: { _t: Date.now() } }
    );
    return response.data;
  },

  async exportActivityCsv(params?: {
    q?: string;
    user_email?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<void> {
    const response = await apiClient.get<Blob>("/admin/activity/export", {
      params: {
        q: params?.q || undefined,
        user_email: params?.user_email || undefined,
        action: params?.action || undefined,
        date_from: params?.date_from || undefined,
        date_to: params?.date_to || undefined,
      },
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `passdown-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async purgeActivity(olderThanDays = 30): Promise<PurgeActivityResult> {
    const response = await apiClient.delete<PurgeActivityResult>(
      "/admin/activity/purge",
      { params: { older_than_days: olderThanDays } }
    );
    return response.data;
  },

  async getSecurityOverview(params?: {
    min_failures?: number;
    hours?: number;
  }): Promise<SecurityOverview> {
    const response = await apiClient.get<SecurityOverview>("/admin/security", {
      params: {
        min_failures: params?.min_failures ?? 3,
        hours: params?.hours ?? 24,
        _t: Date.now(),
      },
    });
    return response.data;
  },
  async getExtendedOverview(): Promise<{
    banned_users: number;
    groups: number;
    new_users_7d: number;
    new_records_7d: number;
  }> {
    const res = await apiClient.get("/admin/overview-extended", { params: { _t: Date.now() } });
    return res.data;
  },

  async searchUsers(params?: {
    q?: string;
    role?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: (User & { ban_reason?: string | null })[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const res = await apiClient.get("/admin/users/search", {
      params: {
        q: params?.q || undefined,
        role: params?.role || undefined,
        status: params?.status || undefined,
        limit: params?.limit ?? 12,
        offset: params?.offset ?? 0,
        _t: Date.now(),
      },
    });
    return res.data;
  },

  async getUserDetail(userId: number): Promise<any> {
    const res = await apiClient.get(`/admin/users/${userId}/detail`, { params: { _t: Date.now() } });
    return res.data;
  },

  async banUser(userId: number, isActive: boolean, reason?: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/ban`, { is_active: isActive, reason });
  },

  async changeUserRole(userId: number, role: "student" | "admin"): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/role`, { role });
  },

  async revokeUserSessions(userId: number): Promise<{ revoked_count: number }> {
    const res = await apiClient.post(`/admin/users/${userId}/revoke-sessions`);
    return res.data;
  },

  async bulkBanUsers(userIds: number[], isActive: boolean, reason?: string): Promise<{ updated_count: number }> {
    const res = await apiClient.post("/admin/users/bulk-ban", {
      user_ids: userIds,
      is_active: isActive,
      reason,
    });
    return res.data;
  },

  async exportUsersCsv(params?: { q?: string; role?: string; status?: string }): Promise<void> {
    const res = await apiClient.get<Blob>("/admin/users/export", {
      params: { q: params?.q || undefined, role: params?.role || undefined, status: params?.status || undefined },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `passdown-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async exportContributionsCsv(params?: { status?: string; course_id?: number }): Promise<void> {
    const res = await apiClient.get<Blob>("/admin/contributions/export", {
      params: { status: params?.status || undefined, course_id: params?.course_id || undefined },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `passdown-contributions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async bulkDeleteContributions(ids: number[]): Promise<{ deleted_count: number }> {
    const res = await apiClient.post("/admin/contributions/bulk-delete", { ids });
    return res.data;
  },

  async listGroupsAdmin(q?: string): Promise<any[]> {
    const res = await apiClient.get("/admin/groups", { params: { q: q || undefined, _t: Date.now() } });
    return res.data;
  },

  async bulkDeleteGroups(ids: number[]): Promise<{ deleted_count: number }> {
    const res = await apiClient.post("/admin/groups/bulk-delete", { ids });
    return res.data;
  },
};
