import type { UserPrivacySettingsResponse } from "../../types/privacy";
import { buildUniformProfileFieldVisibility } from "../profileFieldVisibility";
import { personalFeedAudience, privacySummary, RESERVED_PRIVACY_SETTINGS } from "../privacySummary";

const settings: UserPrivacySettingsResponse = {
  discoverable: true, feedVisibility: "PUBLIC", showAge: true, showDistance: true,
  followApprovalRequired: false, profileFieldVisibility: buildUniformProfileFieldVisibility("PUBLIC"),
};

it("a conta privada prevalece sobre a preferência de feed público", () => {
  expect(personalFeedAudience({ ...settings, followApprovalRequired: true })).toContain("apenas para seguidores");
  expect(personalFeedAudience({ ...settings, feedVisibility: "FOLLOWERS_ONLY" })).toContain("apenas para seguidores");
  expect(personalFeedAudience(settings)).toContain("podem aparecer como sugestões");
});

it("explica que sair da descoberta preserva matches e conversas", () => {
  expect(privacySummary({ ...settings, discoverable: false, showAge: false, showDistance: false }).join(" "))
    .toContain("Matches e conversas existentes continuam.");
  expect(privacySummary({ ...settings, showAge: false, showDistance: false })[2]).toContain("idade está oculta");
});

it("o atalho reforçado restringe os dados sensíveis sem sobrescrever os demais campos", () => {
  expect(RESERVED_PRIVACY_SETTINGS.feedVisibility).toBe("FOLLOWERS_ONLY");
  expect(RESERVED_PRIVACY_SETTINGS.followApprovalRequired).toBe(true);
  expect(RESERVED_PRIVACY_SETTINGS.discoverable).toBe(false);
  expect(RESERVED_PRIVACY_SETTINGS.profileFieldVisibility).toEqual({
    DISABILITIES: "HIDDEN", ACCESSIBILITY_NEEDS: "HIDDEN", AUTONOMY_LEVEL: "HIDDEN",
  });
});
