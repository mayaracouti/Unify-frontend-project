import { profileService } from "./profileService";
import type { ProfileCompletionResponse } from "../types/profile";

const COMPLETED_ONBOARDING_STATE: ProfileCompletionResponse = {
  profileCompleted: true,
  matchPreferencesCompleted: true,
  fullyCompleted: true,
  missingProfileFields: [],
  missingMatchPreferenceFields: [],
};

let completedOnboardingSessionKey: string | null = null;
let pendingCompletionRequest: Promise<ProfileCompletionResponse> | null = null;
let pendingCompletionRequestSessionKey: string | null = null;

export function createOnboardingCompletionSessionKey(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined
) {
  return refreshToken?.trim() || accessToken?.trim() || null;
}

export function hasCompletedOnboardingForSession(
  sessionKey: string | null | undefined
) {
  return Boolean(sessionKey && completedOnboardingSessionKey === sessionKey);
}

export async function getCompletionForSessionKey(sessionKey: string) {
  if (completedOnboardingSessionKey === sessionKey) {
    return COMPLETED_ONBOARDING_STATE;
  }

  if (
    pendingCompletionRequest &&
    pendingCompletionRequestSessionKey === sessionKey
  ) {
    return await pendingCompletionRequest;
  }

  const request = profileService
    .getCompletion()
    .then((completion) => {
      if (completion.profileCompleted && completion.matchPreferencesCompleted) {
        completedOnboardingSessionKey = sessionKey;
      }

      return completion;
    })
    .finally(() => {
      pendingCompletionRequest = null;
      pendingCompletionRequestSessionKey = null;
    });

  pendingCompletionRequest = request;
  pendingCompletionRequestSessionKey = sessionKey;

  return await request;
}

export async function getCompletionForActiveSession(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined
) {
  const sessionKey = createOnboardingCompletionSessionKey(accessToken, refreshToken);

  if (!sessionKey) {
    return null;
  }

  return await getCompletionForSessionKey(sessionKey);
}

export function clearOnboardingCompletionCache() {
  completedOnboardingSessionKey = null;
  pendingCompletionRequest = null;
  pendingCompletionRequestSessionKey = null;
}