import { customApiCall } from "../api/customApi";
import { runtimeConfig } from "../config/runtime";
import {
  buildMockMatchPreferencesFromPayload,
  buildMockProfileFromPayload,
  createMockProfileImage,
  mockDirectoryProfiles,
  mockMatchPreferences,
  mockProfileCompletion,
  mockProfileOptions,
  mockUserProfile,
} from "./mockData";
import type {
  ProfileCompletionResponse,
  ProfileOptionsResponse,
  UserProfileDirectoryItemResponse,
  UserProfileImageResponse,
  UserMatchPreferencesResponse,
  UserMatchPreferencesUpsertRequest,
  UserProfileResponse,
  UserProfileUpsertRequest,
} from "../types/profile";

const ALL_USER_PROFILES_ENDPOINT = "/users/profiles";
const PROFILE_IMAGES_ENDPOINT = "/users/me/profile/images";

export const profileService = {
  getCompletion() {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(mockProfileCompletion);
    }

    return customApiCall.get<ProfileCompletionResponse>(
      "/users/me/profile/completion",
      undefined,
      { requiresAuth: true }
    );
  },

  getOptions() {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(mockProfileOptions);
    }

    return customApiCall.get<ProfileOptionsResponse>(
      "/users/me/profile/options",
      undefined,
      { requiresAuth: true }
    );
  },

  getProfile() {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(mockUserProfile);
    }

    return customApiCall.get<UserProfileResponse>("/users/me/profile", undefined, {
      requiresAuth: true,
    });
  },

  getAllProfiles() {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(mockDirectoryProfiles);
    }

    return customApiCall.get<UserProfileDirectoryItemResponse[]>(
      ALL_USER_PROFILES_ENDPOINT,
      undefined,
      { requiresAuth: true }
    );
  },

  saveProfile(payload: UserProfileUpsertRequest) {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(buildMockProfileFromPayload(payload));
    }

    return customApiCall.put<UserProfileResponse, UserProfileUpsertRequest>(
      "/users/me/profile",
      payload,
      { requiresAuth: true }
    );
  },

  getActiveProfileImages() {
    if (runtimeConfig.useMocks) {
      return Promise.resolve([]);
    }

    return customApiCall.get<UserProfileImageResponse[]>(PROFILE_IMAGES_ENDPOINT, undefined, {
      requiresAuth: true,
    });
  },

  uploadProfilePicture(formData: FormData) {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(createMockProfileImage(true));
    }

    return customApiCall.post<UserProfileImageResponse, FormData>(
      `${PROFILE_IMAGES_ENDPOINT}/profile-picture`,
      formData,
      { requiresAuth: true }
    );
  },

  uploadGalleryImage(formData: FormData) {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(createMockProfileImage(false));
    }

    return customApiCall.post<UserProfileImageResponse, FormData>(
      `${PROFILE_IMAGES_ENDPOINT}/gallery`,
      formData,
      { requiresAuth: true }
    );
  },

  deleteProfileImage(imageId: string) {
    if (runtimeConfig.useMocks) {
      return Promise.resolve();
    }

    return customApiCall.delete<void>(`${PROFILE_IMAGES_ENDPOINT}/${imageId}`, {
      requiresAuth: true,
    });
  },

  resolveProfileImageUrl(relativeUrl?: string | null) {
    if (!relativeUrl) {
      return null;
    }

    if (/^https?:\/\//i.test(relativeUrl)) {
      return relativeUrl;
    }

    const normalizedBaseUrl = runtimeConfig.apiBaseUrl.endsWith("/")
      ? runtimeConfig.apiBaseUrl.slice(0, -1)
      : runtimeConfig.apiBaseUrl;

    const normalizedPath = relativeUrl.startsWith("/")
      ? relativeUrl
      : `/${relativeUrl}`;

    return `${normalizedBaseUrl}${normalizedPath}`;
  },

  getMatchPreferences() {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(mockMatchPreferences);
    }

    return customApiCall.get<UserMatchPreferencesResponse>(
      "/users/me/match-preferences",
      undefined,
      { requiresAuth: true }
    );
  },

  saveMatchPreferences(payload: UserMatchPreferencesUpsertRequest) {
    if (runtimeConfig.useMocks) {
      return Promise.resolve(buildMockMatchPreferencesFromPayload(payload));
    }

    return customApiCall.put<
      UserMatchPreferencesResponse,
      UserMatchPreferencesUpsertRequest
    >("/users/me/match-preferences", payload, { requiresAuth: true });
  },
};
