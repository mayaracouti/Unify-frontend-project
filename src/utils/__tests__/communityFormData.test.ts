import { Platform } from "react-native";
import { appendCommunityImage, buildCommunityFormData, buildCommunityPostFormData } from "../communityFormData";

const originalOS = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
  jest.restoreAllMocks();
});

it("envia a imagem nativa como arquivo multipart e preserva texto sem espaços externos", async () => {
  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
  const append = jest.spyOn(FormData.prototype, "append");
  await buildCommunityPostFormData("  Meu post  ", { uri: "file:///image.png", fileName: "image.png", mimeType: "image/png", width: 10, height: 10 });
  expect(append).toHaveBeenCalledWith("body", "Meu post");
  expect(append).toHaveBeenCalledWith("image", { uri: "file:///image.png", name: "image.png", type: "image/png" });
});

it("usa Blob no navegador mesmo quando o picker não retorna File", async () => {
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  const blob = new Blob(["image"], { type: "image/png" });
  jest.spyOn(global, "fetch").mockResolvedValue({ blob: async () => blob } as Response);
  const append = jest.spyOn(FormData.prototype, "append");
  await appendCommunityImage(new FormData(), "icon", { uri: "blob:local", fileName: "image.png", width: 10, height: 10 });
  expect(append).toHaveBeenCalledWith("icon", blob, "image.png");
});

it("permite limpar descrição, categoria e ícone na edição", async () => {
  const append = jest.spyOn(FormData.prototype, "append");
  await buildCommunityFormData({ name: "Nome", description: " ", privacy: "PRIVATE", categoryId: null, asset: null, update: true, removeIcon: true });
  expect(append).toHaveBeenCalledWith("description", "");
  expect(append).toHaveBeenCalledWith("removeCategory", "true");
  expect(append).toHaveBeenCalledWith("removeIcon", "true");
  expect(append).toHaveBeenCalledWith("privacy", "PRIVATE");
});

it("não pede remoção de ícone quando um novo arquivo foi selecionado", async () => {
  const append = jest.spyOn(FormData.prototype, "append");
  await buildCommunityFormData({ name: "Nome", description: "", privacy: "PUBLIC", categoryId: 1, asset: { uri: "file:///icon.jpg", width: 10, height: 10 }, update: true, removeIcon: true });
  expect(append).not.toHaveBeenCalledWith("removeIcon", "true");
  expect(append).toHaveBeenCalledWith("categoryId", "1");
});
