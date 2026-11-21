import { apiClient } from "./client";
import type {
  CoreMaterial,
  CoreMaterialPayload,
  MaterialType,
  PaginatedResponse,
} from "../types";

export const materialsApi = {
  async listByCourse(
    courseId: number,
    params?: { type?: MaterialType | ""; limit?: number; offset?: number }
  ): Promise<PaginatedResponse<CoreMaterial>> {
    const response = await apiClient.get<PaginatedResponse<CoreMaterial>>(
      `/courses/${courseId}/core-materials`,
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

  async getById(materialId: number): Promise<CoreMaterial> {
    const response = await apiClient.get<CoreMaterial>(
      `/core-materials/${materialId}`
    );
    return response.data;
  },

  async create(
    courseId: number,
    payload: CoreMaterialPayload
  ): Promise<CoreMaterial> {
    const response = await apiClient.post<CoreMaterial>(
      `/courses/${courseId}/core-materials`,
      payload
    );
    return response.data;
  },

  async update(
    materialId: number,
    payload: CoreMaterialPayload
  ): Promise<CoreMaterial> {
    const response = await apiClient.put<CoreMaterial>(
      `/core-materials/${materialId}`,
      payload
    );
    return response.data;
  },

  async remove(materialId: number): Promise<void> {
    await apiClient.delete(`/core-materials/${materialId}`);
  },
};