import { apiClient } from "./client";
import type { RegisterPayload, TokenResponse, User } from "../types";

export const authApi = {
  async register(payload: RegisterPayload): Promise<User> {
    const response = await apiClient.post<User>("/auth/register", payload);
    return response.data;
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const response = await apiClient.post<TokenResponse>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data;
  },

  async logout(refreshToken: string | null): Promise<void> {
    await apiClient.post("/auth/logout", { refresh_token: refreshToken });
  },
};
