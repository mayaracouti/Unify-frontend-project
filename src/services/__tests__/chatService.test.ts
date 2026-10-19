import { chatService } from "../chatService";
import { customApiCall } from "../../api/customApi";

jest.mock("../../api/customApi", () => ({ customApiCall: { post: jest.fn() } }));
jest.mock("../../config/runtime", () => ({ runtimeConfig: { apiBaseUrl: "https://api" } }));

afterEach(() => jest.restoreAllMocks());

it("uploads native image bytes and description using the API caption field", () => {
  const append = jest.spyOn(FormData.prototype, "append");
  chatService.sendMediaMessage("conversation", { type: "IMAGE", uri: "file:/photo.jpg", name: "photo.jpg", mimeType: "image/jpeg", caption: "Descrição da imagem: Uma árvore" });
  expect(append).toHaveBeenCalledWith("file", { uri: "file:/photo.jpg", name: "photo.jpg", type: "image/jpeg" });
  expect(append).toHaveBeenCalledWith("caption", "Descrição da imagem: Uma árvore");
  expect(customApiCall.post).toHaveBeenCalledWith("/chats/conversation/messages/media", expect.any(FormData), { requiresAuth: true, timeoutMs: 60000 });
});

it("uses the web picker file instead of a React Native file descriptor", () => {
  const append = jest.spyOn(FormData.prototype, "append");
  const file = new Blob(["image"], { type: "image/png" }) as File;
  chatService.sendMediaMessage("conversation", { type: "IMAGE", uri: "blob:photo", name: "photo.png", mimeType: "image/png", file });
  expect(append).toHaveBeenCalledWith("file", file, "photo.png");
  expect(append.mock.calls.some(([key]) => key === "caption")).toBe(false);
});
