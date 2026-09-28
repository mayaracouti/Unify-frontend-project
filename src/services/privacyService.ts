import { customApiCall } from "../api/customApi";
import type {
  UserBlockResponse,
  UserPrivacySettingsResponse,
  UserPrivacySettingsUpdateRequest,
} from "../types/privacy";

const PRIVACY_SETTINGS_ENDPOINT = "/users/me/privacy-settings";
const BLOCKS_ENDPOINT = "/users/me/blocks";

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

/**
 * Privacidade (descoberta, idade, distancia, quem ve meus posts) e bloqueio.
 *
 * Bloquear vale nos dois sentidos no backend: perfil publico, galeria, audio,
 * posts e follow-stats passam a responder 404; follow e envio de mensagem, 409;
 * os follows entre as duas pessoas sao removidos. O historico do chat continua
 * visivel.
 */
export const privacyService = {
  getSettings() {
    return customApiCall.get<UserPrivacySettingsResponse>(
      PRIVACY_SETTINGS_ENDPOINT,
      undefined,
      { requiresAuth: true }
    );
  },

  /**
   * Corpo parcial: so os campos enviados mudam — inclusive dentro de
   * `profileFieldVisibility` (ex.: `{ profileFieldVisibility: { GENDER: "HIDDEN" } }`).
   * Devolve o objeto completo; 400 para parte/modo invalido.
   */
  saveSettings(payload: UserPrivacySettingsUpdateRequest) {
    return customApiCall.put<UserPrivacySettingsResponse, UserPrivacySettingsUpdateRequest>(
      PRIVACY_SETTINGS_ENDPOINT,
      payload,
      { requiresAuth: true }
    );
  },

  /** So quem EU bloqueei (nunca quem me bloqueou). */
  listBlockedUsers() {
    return customApiCall.get<UserBlockResponse[]>(BLOCKS_ENDPOINT, undefined, {
      requiresAuth: true,
    });
  },

  /** 201 com o bloqueio; 409 se ja estava bloqueado; 400 para o proprio perfil. */
  blockUser(userProfileId: string) {
    return customApiCall.post<UserBlockResponse>(
      `/users/${encodePathSegment(userProfileId)}/block`,
      undefined,
      { requiresAuth: true }
    );
  },

  /** 204; 404 se nao estava bloqueado. */
  unblockUser(userProfileId: string) {
    return customApiCall.delete<void>(`/users/${encodePathSegment(userProfileId)}/block`, {
      requiresAuth: true,
    });
  },
};
