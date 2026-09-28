// `jest.mock` e icado pelo babel-jest para antes destes imports.
import { customApiCall } from "../../api/customApi";
import { profileService } from "../profileService";

jest.mock("../../config/runtime", () => ({
  runtimeConfig: { profile: "dev", apiBaseUrl: "https://api.unify.test/" },
}));

jest.mock("../../api/customApi", () => ({
  customApiCall: {
    get: jest.fn(async () => ({})),
    post: jest.fn(async () => ({})),
    put: jest.fn(async () => ({})),
    delete: jest.fn(async () => undefined),
  },
}));

const mockedApi = customApiCall as jest.Mocked<typeof customApiCall>;

describe("profileService — audio de apresentacao", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("monta a URL publica do audio com o perfil na query", () => {
    expect(profileService.resolvePublicPresentationAudioUrl("perfil-1", "audio-9")).toBe(
      "https://api.unify.test/users/me/profile/public/audio/audio-9?userProfileId=perfil-1"
    );
  });

  it("codifica ids e ignora espacos nas pontas", () => {
    expect(profileService.resolvePublicPresentationAudioUrl(" a b ", " x/y ")).toBe(
      "https://api.unify.test/users/me/profile/public/audio/x%2Fy?userProfileId=a%20b"
    );
  });

  it("devolve null sem perfil ou sem audio", () => {
    expect(profileService.resolvePublicPresentationAudioUrl("perfil-1", null)).toBeNull();
    expect(profileService.resolvePublicPresentationAudioUrl("", "audio-9")).toBeNull();
  });

  it("resolve a URL relativa do meu audio", () => {
    expect(profileService.resolveProfileAudioUrl("/users/me/profile/audio/audio-9")).toBe(
      "https://api.unify.test/users/me/profile/audio/audio-9"
    );
  });

  it("usa GET/PUT/DELETE em /users/me/profile/audio", async () => {
    const formData = new FormData();

    await profileService.getPresentationAudio();
    await profileService.uploadPresentationAudio(formData);
    await profileService.deletePresentationAudio();

    expect(mockedApi.get).toHaveBeenCalledWith("/users/me/profile/audio", undefined, {
      requiresAuth: true,
    });
    expect(mockedApi.put).toHaveBeenCalledWith(
      "/users/me/profile/audio",
      formData,
      expect.objectContaining({ requiresAuth: true })
    );
    expect(mockedApi.delete).toHaveBeenCalledWith("/users/me/profile/audio", {
      requiresAuth: true,
    });
  });
});
