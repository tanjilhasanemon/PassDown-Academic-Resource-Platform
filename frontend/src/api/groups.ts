import { apiClient } from "./client";
import type { StudyGroupDetail, StudyGroupSummary } from "../types";

export const groupsApi = {
  async list(): Promise<StudyGroupSummary[]> {
    const res = await apiClient.get<StudyGroupSummary[]>("/groups", { params: { _t: Date.now() } });
    return res.data;
  },

  async getDetail(groupId: number): Promise<StudyGroupDetail> {
    const res = await apiClient.get<StudyGroupDetail>(`/groups/${groupId}`, { params: { _t: Date.now() } });
    return res.data;
  },

  async create(payload: { name: string; description?: string; course_code?: string }): Promise<StudyGroupDetail> {
    const res = await apiClient.post<StudyGroupDetail>("/groups", payload);
    return res.data;
  },

  async update(groupId: number, payload: { name?: string; description?: string; course_code?: string }): Promise<StudyGroupDetail> {
    const res = await apiClient.patch<StudyGroupDetail>(`/groups/${groupId}`, payload);
    return res.data;
  },

  async remove(groupId: number): Promise<void> {
    await apiClient.delete(`/groups/${groupId}`);
  },

  async addMember(
    groupId: number,
    payload: { email: string; can_create: boolean; can_edit: boolean; can_assign: boolean }
  ): Promise<StudyGroupDetail> {
    const res = await apiClient.post<StudyGroupDetail>(`/groups/${groupId}/members`, payload);
    return res.data;
  },

  async updateMember(
    groupId: number,
    memberUserId: number,
    payload: { can_create: boolean; can_edit: boolean; can_assign: boolean }
  ): Promise<StudyGroupDetail> {
    const res = await apiClient.patch<StudyGroupDetail>(`/groups/${groupId}/members/${memberUserId}`, payload);
    return res.data;
  },

  async removeMember(groupId: number, memberUserId: number): Promise<StudyGroupDetail> {
    const res = await apiClient.delete<StudyGroupDetail>(`/groups/${groupId}/members/${memberUserId}`);
    return res.data;
  },

  async addResource(
    groupId: number,
    payload: { title: string; url: string; resource_type: string; notes?: string; assigned_to_id?: number | null }
  ): Promise<StudyGroupDetail> {
    const res = await apiClient.post<StudyGroupDetail>(`/groups/${groupId}/resources`, payload);
    return res.data;
  },

  async updateResource(
    groupId: number,
    resourceId: number,
    payload: {
      title?: string;
      url?: string;
      status?: string;
      assigned_to_id?: number | null;
      update_assignment?: boolean;
    }
  ): Promise<StudyGroupDetail> {
    const res = await apiClient.patch<StudyGroupDetail>(`/groups/${groupId}/resources/${resourceId}`, payload);
    return res.data;
  },

  async removeResource(groupId: number, resourceId: number): Promise<StudyGroupDetail> {
    const res = await apiClient.delete<StudyGroupDetail>(`/groups/${groupId}/resources/${resourceId}`);
    return res.data;
  },
};
