import { customApiCall } from "../api/customApi";
import type {
  ProfileCompletionResponse,
  ProfileOptionsResponse,
  UserMatchPreferencesResponse,
  UserMatchPreferencesUpsertRequest,
  UserProfileResponse,
  UserProfileUpsertRequest,
} from "../types/profile";

export const profileService = {
  getCompletion() {
    return customApiCall.get<ProfileCompletionResponse>(
      "/users/me/profile/completion",
      undefined,
      { requiresAuth: true }
    );
  },

  getOptions() {
    return customApiCall.get<ProfileOptionsResponse>(
      "/users/me/profile/options",
      undefined,
      { requiresAuth: true }
    );
  },

  getProfile() {
    return customApiCall.get<UserProfileResponse>("/users/me/profile", undefined, {
      requiresAuth: true,
    });
  },

  saveProfile(payload: UserProfileUpsertRequest) {
    return customApiCall.put<UserProfileResponse, UserProfileUpsertRequest>(
      "/users/me/profile",
      payload,
      { requiresAuth: true }
    );
  },

  getMatchPreferences() {
    return customApiCall.get<UserMatchPreferencesResponse>(
      "/users/me/match-preferences",
      undefined,
      { requiresAuth: true }
    );
  },

  saveMatchPreferences(payload: UserMatchPreferencesUpsertRequest) {
    return customApiCall.put<
      UserMatchPreferencesResponse,
      UserMatchPreferencesUpsertRequest
    >("/users/me/match-preferences", payload, { requiresAuth: true });
  },
};
