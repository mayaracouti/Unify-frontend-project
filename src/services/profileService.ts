import { customApiCall } from "../api/customApi";
import { runtimeConfig } from "../config/runtime";
import type {
  PublicProfileImageIdsResponse,
  ProfileCompletionResponse,
  ProfileOptionsResponse,
  UserProfileDirectoryItemResponse,
  UserProfileImageResponse,
  UserMatchPreferencesResponse,
  UserPublicProfileResponse,
  UserMatchPreferencesUpsertRequest,
  UserProfileResponse,
  UserProfileUpsertRequest,
} from "../types/profile";

const ALL_USER_PROFILES_ENDPOINT = "/users/profiles";
const PUBLIC_PROFILE_ENDPOINT = "/users/me/profile/public";
const PROFILE_IMAGES_ENDPOINT = "/users/me/profile/images";

function normalizeProfileOptions(
  options: Partial<ProfileOptionsResponse>
): ProfileOptionsResponse {
  return {
    genders: options.genders ?? [],
    pronouns: options.pronouns ?? [],
    disabilities: options.disabilities ?? [],
    accessibilityNeeds: options.accessibilityNeeds ?? [],
    autonomyLevels: options.autonomyLevels ?? [],
    communicationForms: options.communicationForms ?? [],
    lifestyleTypes: options.lifestyleTypes ?? [],
    energyLevels: options.energyLevels ?? [],
    interestTypes: options.interestTypes ?? [],
    loveLanguages: options.loveLanguages ?? [],
    connectionTypes: options.connectionTypes ?? [],
    similarityPreferences: options.similarityPreferences ?? [],
  };
}

export const profileService = {
  getCompletion() {
    return customApiCall.get<ProfileCompletionResponse>(
      "/users/me/profile/completion",
      undefined,
      { requiresAuth: true }
    );
  },

  async getOptions() {
    const options = await customApiCall.get<Partial<ProfileOptionsResponse>>(
      "/users/me/profile/options",
      undefined,
      { requiresAuth: true }
    );

    return normalizeProfileOptions(options);
  },

  getProfile() {
    return customApiCall.get<UserProfileResponse>("/users/me/profile", undefined, {
      requiresAuth: true,
    });
  },

  getAllProfiles() {
    return customApiCall.get<UserProfileDirectoryItemResponse[]>(
      ALL_USER_PROFILES_ENDPOINT,
      undefined,
      { requiresAuth: true }
    );
  },

  getProfileById(profileId: string) {
    return customApiCall.get<UserProfileDirectoryItemResponse>(
      `${ALL_USER_PROFILES_ENDPOINT}/${profileId}`,
      undefined,
      { requiresAuth: true }
    );
  },

  getPublicProfile(userProfileId: string) {
    return customApiCall.get<UserPublicProfileResponse>(
      PUBLIC_PROFILE_ENDPOINT,
      { userProfileId },
      { requiresAuth: true }
    );
  },

  getPublicProfileImageIds(userProfileId: string) {
    return customApiCall.get<PublicProfileImageIdsResponse>(
      `${PUBLIC_PROFILE_ENDPOINT}/images`,
      { userProfileId },
      { requiresAuth: true }
    );
  },

  saveProfile(payload: UserProfileUpsertRequest) {
    return customApiCall.put<UserProfileResponse, UserProfileUpsertRequest>(
      "/users/me/profile",
      payload,
      { requiresAuth: true }
    );
  },

  getActiveProfileImages() {
    return customApiCall.get<UserProfileImageResponse[]>(PROFILE_IMAGES_ENDPOINT, undefined, {
      requiresAuth: true,
    });
  },

  uploadProfilePicture(formData: FormData) {
    return customApiCall.post<UserProfileImageResponse, FormData>(
      `${PROFILE_IMAGES_ENDPOINT}/profile-picture`,
      formData,
      { requiresAuth: true }
    );
  },

  uploadGalleryImage(formData: FormData) {
    return customApiCall.post<UserProfileImageResponse, FormData>(
      `${PROFILE_IMAGES_ENDPOINT}/gallery`,
      formData,
      { requiresAuth: true }
    );
  },

  deleteProfileImage(imageId: string) {
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

  resolvePublicProfileImageUrl(userProfileId: string, imageId?: string | null) {
    const normalizedImageId = imageId?.trim();
    const normalizedUserProfileId = userProfileId?.trim();

    if (!normalizedImageId || !normalizedUserProfileId) {
      return null;
    }

    const normalizedBaseUrl = runtimeConfig.apiBaseUrl.endsWith("/")
      ? runtimeConfig.apiBaseUrl.slice(0, -1)
      : runtimeConfig.apiBaseUrl;

    const encodedUserProfileId = encodeURIComponent(normalizedUserProfileId);
    const encodedImageId = encodeURIComponent(normalizedImageId);

    return `${normalizedBaseUrl}${PUBLIC_PROFILE_ENDPOINT}/images/${encodedImageId}?userProfileId=${encodedUserProfileId}`;
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
