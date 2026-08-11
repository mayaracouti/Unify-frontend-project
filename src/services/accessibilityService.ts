import { customApiCall } from "../api/customApi";
import type {
  UserAccessibilitySettingsResponse,
  UserAccessibilitySettingsUpsertRequest,
} from "../types/accessibility";

const ACCESSIBILITY_SETTINGS_ENDPOINT = "/users/me/accessibility-settings";

export const accessibilityService = {
  getSettings() {
    return customApiCall.get<UserAccessibilitySettingsResponse>(
      ACCESSIBILITY_SETTINGS_ENDPOINT,
      undefined,
      { requiresAuth: true }
    );
  },

  saveSettings(payload: UserAccessibilitySettingsUpsertRequest) {
    return customApiCall.put<
      UserAccessibilitySettingsResponse,
      UserAccessibilitySettingsUpsertRequest
    >(ACCESSIBILITY_SETTINGS_ENDPOINT, payload, { requiresAuth: true });
  },
};
