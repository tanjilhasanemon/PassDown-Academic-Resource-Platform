import { apiClient } from "./client";
import type {
  Contribution,
  ContributionCreatePayload,
  ContributionStatus,
  ContributionUpdatePayload,
  MaterialType,
  ModerationStatus,
  PaginatedResponse,
} from "../types";

export const contributionsApi = {
  async listApprovedByCourse(
    courseId: number,
    params?: { type?: MaterialType | ""; limit?: number; offset?: number }
  ): Promise<PaginatedResponse<Contribution>> {
    const response = await apiClient.get<PaginatedResponse<Contribution>>(
      `/courses/${courseId}/contributions`,
      {
        params: {
          type: params?.type || undefined,
          limit: params?.limit ?? 100,
          offset: params?.offset ?? 0,
        },
      }
    );
    return response.data;
  },

  async listAll(params?: {
    status?: ContributionStatus | "";
    course_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Contribution>> {
    const response = await apiClient.get<PaginatedResponse<Contribution>>(
      "/contributions",
      {
        params: {
          status: params?.status || undefined,
          course_id: params?.course_id,
          limit: params?.limit ?? 100,
          offset: params?.offset ?? 0,
        },
      }
    );
    return response.data;
  },

  async getById(contributionId: number): Promise<Contribution> {
    const response = await apiClient.get<Contribution>(
      `/contributions/${contributionId}`
    );
    return response.data;
  },

  async create(
    courseId: number,
    payload: ContributionCreatePayload
  ): Promise<Contribution> {
    const response = await apiClient.post<Contribution>(
      `/courses/${courseId}/contributions`,
      payload
    );
    return response.data;
  },

  async update(
    contributionId: number,
    payload: ContributionUpdatePayload
  ): Promise<Contribution> {
    const response = await apiClient.put<Contribution>(
      `/contributions/${contributionId}`,
      payload
    );
    return response.data;
  },

  async updateStatus(
    contributionId: number,
    status: ModerationStatus
  ): Promise<Contribution> {
    const response = await apiClient.patch<Contribution>(
      `/contributions/${contributionId}/status`,
      { status }
    );
    return response.data;
  },

  async remove(contributionId: number): Promise<void> {
    await apiClient.delete(`/contributions/${contributionId}`);
  },
};