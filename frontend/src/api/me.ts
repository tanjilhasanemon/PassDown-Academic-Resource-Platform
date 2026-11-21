import { apiClient } from "./client";
import type {
  Contribution,
  ContributionStatus,
  MaterialRequest,
  PaginatedResponse,
  RequestStatus,
  User,
  UserPasswordUpdatePayload,
  UserProfileUpdatePayload,
  UserSession,
  UserSummary,
} from "../types";

export const meApi = {
  async getProfile(): Promise<User> {
    const response = await apiClient.get<User>("/me");
    return response.data;
  },

  async updateProfile(payload: UserProfileUpdatePayload): Promise<User> {
    const response = await apiClient.patch<User>("/me", payload);
    return response.data;
  },

  async changePassword(payload: UserPasswordUpdatePayload): Promise<void> {
    await apiClient.post("/me/password", payload);
  },

  async getSummary(): Promise<UserSummary> {
    const response = await apiClient.get<UserSummary>("/me/summary");
    return response.data;
  },

  async listContributions(params?: {
    status?: ContributionStatus | "";
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Contribution>> {
    const response = await apiClient.get<PaginatedResponse<Contribution>>(
      "/me/contributions",
      {
        params: {
          status: params?.status || undefined,
          limit: params?.limit ?? 100,
          offset: params?.offset ?? 0,
        },
      }
    );
    return response.data;
  },

  async listRequests(params?: {
    status?: RequestStatus | "";
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<MaterialRequest>> {
    const response = await apiClient.get<PaginatedResponse<MaterialRequest>>(
      "/me/requests",
      {
        params: {
          status: params?.status || undefined,
          limit: params?.limit ?? 100,
          offset: params?.offset ?? 0,
        },
      }
    );
    return response.data;
  },

  async listSessions(): Promise<UserSession[]> {
    const response = await apiClient.get<UserSession[]>("/me/sessions");
    return response.data;
  },

  async revokeSession(sessionId: number): Promise<void> {
    await apiClient.delete(`/me/sessions/${sessionId}`);
  },
};
