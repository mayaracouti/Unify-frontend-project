// `jest.mock` e icado pelo babel-jest para antes destes imports.
import { customApiCall } from "../../api/customApi";
import { privacyService } from "../privacyService";

jest.mock("../../api/customApi", () => ({
  customApiCall: {
    get: jest.fn(async () => ({})),
    post: jest.fn(async () => ({})),
    put: jest.fn(async () => ({})),
    delete: jest.fn(async () => undefined),
  },
}));

const mockedApi = customApiCall as jest.Mocked<typeof customApiCall>;

describe("privacyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("le e salva (parcial) as configuracoes de privacidade", async () => {
    await privacyService.getSettings();
    await privacyService.saveSettings({ showAge: false });

    expect(mockedApi.get).toHaveBeenCalledWith("/users/me/privacy-settings", undefined, {
      requiresAuth: true,
    });
    expect(mockedApi.put).toHaveBeenCalledWith(
      "/users/me/privacy-settings",
      { showAge: false },
      { requiresAuth: true }
    );
  });

  it("liga/desliga a aprovacao de seguidores com PUT parcial", async () => {
    await privacyService.saveSettings({ followApprovalRequired: true });

    expect(mockedApi.put).toHaveBeenCalledWith(
      "/users/me/privacy-settings",
      { followApprovalRequired: true },
      { requiresAuth: true }
    );
  });

  it("envia so as partes do perfil alteradas (mapa parcial)", async () => {
    await privacyService.saveSettings({ profileFieldVisibility: { GENDER: "HIDDEN" } });
    await privacyService.saveSettings({
      showAge: true,
      profileFieldVisibility: { BIO: "FOLLOWERS_ONLY", GALLERY: "FOLLOWING_ONLY" },
    });

    expect(mockedApi.put).toHaveBeenNthCalledWith(
      1,
      "/users/me/privacy-settings",
      { profileFieldVisibility: { GENDER: "HIDDEN" } },
      { requiresAuth: true }
    );
    expect(mockedApi.put).toHaveBeenNthCalledWith(
      2,
      "/users/me/privacy-settings",
      {
        showAge: true,
        profileFieldVisibility: { BIO: "FOLLOWERS_ONLY", GALLERY: "FOLLOWING_ONLY" },
      },
      { requiresAuth: true }
    );
  });

  it("lista, bloqueia e desbloqueia pelo id do perfil", async () => {
    await privacyService.listBlockedUsers();
    await privacyService.blockUser("perfil-1");
    await privacyService.unblockUser("perfil-1");

    expect(mockedApi.get).toHaveBeenCalledWith("/users/me/blocks", undefined, {
      requiresAuth: true,
    });
    expect(mockedApi.post).toHaveBeenCalledWith("/users/perfil-1/block", undefined, {
      requiresAuth: true,
    });
    expect(mockedApi.delete).toHaveBeenCalledWith("/users/perfil-1/block", {
      requiresAuth: true,
    });
  });
});
