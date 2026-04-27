import { customApiCall } from "../api/customApi";
import type { CurrentUserResponse } from "../types/auth";

export const userService = {
  getCurrentUser() {
    return customApiCall.get<CurrentUserResponse>("/users/me", undefined, {
      requiresAuth: true,
    });
  },
};