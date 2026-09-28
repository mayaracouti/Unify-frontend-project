import { customApiCall } from "../api/customApi";
import { runtimeConfig } from "../config/runtime";
import type {
  PublicProfileImageIdsResponse,
  ProfileCompletionResponse,
  ProfileOptionsResponse,
  UserProfileDirectoryItemResponse,
  UserProfileAudioResponse,
  UserProfileAudioStatusResponse,
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
const PROFILE_AUDIO_ENDPOINT = "/users/me/profile/audio";

/** Upload de audio em rede movel precisa de folga sobre os 20s padrao do cliente. */
const AUDIO_UPLOAD_TIMEOUT_MS = 60000;

function normalizedApiBaseUrl() {
  return runtimeConfig.apiBaseUrl.endsWith("/")
    ? runtimeConfig.apiBaseUrl.slice(0, -1)
    : runtimeConfig.apiBaseUrl;
}

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

  // TODO(semana-0X): depende de GET /users/profiles
  getAllProfiles() {
    return customApiCall.get<UserProfileDirectoryItemResponse[]>(
      ALL_USER_PROFILES_ENDPOINT,
      undefined,
      { requiresAuth: true }
    );
  },

  // TODO(semana-0X): depende de GET /users/profiles
  getProfileById(profileId: string) {
    return customApiCall.get<UserProfileDirectoryItemResponse>(
      `${ALL_USER_PROFILES_ENDPOINT}/${profileId}`,
      undefined,
      { requiresAuth: true }
    );
  },

  /**
   * 404 tambem quando ha bloqueio em qualquer direcao. `silent` evita o toast
   * global de erro para telas que ja mostram o estado ("Perfil indisponível").
   */
  getPublicProfile(userProfileId: string, options?: { silent?: boolean }) {
    return customApiCall.get<UserPublicProfileResponse>(
      PUBLIC_PROFILE_ENDPOINT,
      { userProfileId },
      { requiresAuth: true, suppressErrorToast: options?.silent ?? false }
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

  /** `{ audio: null }` quando ainda nao ha audio de apresentacao. */
  getPresentationAudio() {
    return customApiCall.get<UserProfileAudioStatusResponse>(
      PROFILE_AUDIO_ENDPOINT,
      undefined,
      { requiresAuth: true }
    );
  },

  /**
   * Grava/substitui o audio de apresentacao (id novo a cada envio).
   * `formData`: campo `audio` (`{ uri, name, type }`) + `durationSeconds`
   * (inteiro 1..60 como string) — mesmo formato de
   * `chatService.sendMediaMessage`. O interceptor nao injeta `Content-Type`
   * para FormData: o fetch monta o boundary do multipart sozinho.
   */
  uploadPresentationAudio(formData: FormData) {
    return customApiCall.put<UserProfileAudioResponse, FormData>(
      PROFILE_AUDIO_ENDPOINT,
      formData,
      { requiresAuth: true, timeoutMs: AUDIO_UPLOAD_TIMEOUT_MS }
    );
  },

  deletePresentationAudio() {
    return customApiCall.delete<void>(PROFILE_AUDIO_ENDPOINT, { requiresAuth: true });
  },

  /** URL absoluta do MEU audio (`presentationAudio.url` e relativa). */
  resolveProfileAudioUrl(relativeUrl?: string | null) {
    return profileService.resolveProfileImageUrl(relativeUrl);
  },

  /** Bytes do audio de OUTRO perfil; exige `Authorization: Bearer` no download. */
  resolvePublicPresentationAudioUrl(userProfileId: string, audioId?: string | null) {
    const normalizedAudioId = audioId?.trim();
    const normalizedUserProfileId = userProfileId?.trim();

    if (!normalizedAudioId || !normalizedUserProfileId) {
      return null;
    }

    const encodedUserProfileId = encodeURIComponent(normalizedUserProfileId);
    const encodedAudioId = encodeURIComponent(normalizedAudioId);

    return `${normalizedApiBaseUrl()}${PUBLIC_PROFILE_ENDPOINT}/audio/${encodedAudioId}?userProfileId=${encodedUserProfileId}`;
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
