import { apiClient } from "./client";
import type {
  MaterialRequest,
  MaterialRequestCreatePayload,
  MaterialRequestUpdatePayload,
  PaginatedResponse,
  RequestStatus,
} from "../types";

export const requestsApi = {
  async listAll(params?: {
    status?: RequestStatus | "";
    course_id?: number;
    new_course_only?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<MaterialRequest>> {
    const response = await apiClient.get<PaginatedResponse<MaterialRequest>>(
      "/requests",
      {
        params: {
          status: params?.status || undefined,
          course_id: params?.course_id,
          new_course_only: params?.new_course_only || undefined,
          limit: params?.limit ?? 100,
          offset: params?.offset ?? 0,
        },
      }
    );
    return response.data;
  },

  async listByCourse(
    courseId: number,
    params?: { status?: RequestStatus | ""; limit?: number; offset?: number }
  ): Promise<PaginatedResponse<MaterialRequest>> {
    const response = await apiClient.get<PaginatedResponse<MaterialRequest>>(
      `/courses/${courseId}/requests`,
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

  async getById(requestId: number): Promise<MaterialRequest> {
    const response = await apiClient.get<MaterialRequest>(
      `/requests/${requestId}`
    );
    return response.data;
  },

  async createGeneral(
    payload: MaterialRequestCreatePayload
  ): Promise<MaterialRequest> {
    const response = await apiClient.post<MaterialRequest>(
      "/requests",
      payload
    );
    return response.data;
  },

  async create(
    courseId: number,
    payload: MaterialRequestCreatePayload
  ): Promise<MaterialRequest> {
    const response = await apiClient.post<MaterialRequest>(
      `/courses/${courseId}/requests`,
      payload
    );
    return response.data;
  },

  async update(
    requestId: number,
    payload: MaterialRequestUpdatePayload
  ): Promise<MaterialRequest> {
    const response = await apiClient.put<MaterialRequest>(
      `/requests/${requestId}`,
      payload
    );
    return response.data;
  },

  async fulfill(requestId: number): Promise<MaterialRequest> {
    const response = await apiClient.patch<MaterialRequest>(
      `/requests/${requestId}/fulfill`
    );
    return response.data;
  },

  async remove(requestId: number): Promise<void> {
    await apiClient.delete(`/requests/${requestId}`);
  },
};
