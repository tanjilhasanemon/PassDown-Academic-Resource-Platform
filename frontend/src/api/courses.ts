import { apiClient } from "./client";
import type { Course, CoursePayload, PaginatedResponse } from "../types";

export const coursesApi = {
  async list(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Course>> {
    const response = await apiClient.get<PaginatedResponse<Course>>("/courses", {
      params: {
        q: params?.q || undefined,
        limit: params?.limit ?? 100,
        offset: params?.offset ?? 0,
      },
    });
    return response.data;
  },

  async getById(courseId: number): Promise<Course> {
    const response = await apiClient.get<Course>(`/courses/${courseId}`);
    return response.data;
  },

  async create(payload: CoursePayload): Promise<Course> {
    const response = await apiClient.post<Course>("/courses", payload);
    return response.data;
  },

  async update(courseId: number, payload: CoursePayload): Promise<Course> {
    const response = await apiClient.put<Course>(`/courses/${courseId}`, payload);
    return response.data;
  },

  async remove(courseId: number): Promise<void> {
    await apiClient.delete(`/courses/${courseId}`);
  },
};