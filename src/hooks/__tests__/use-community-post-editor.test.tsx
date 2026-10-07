import { useCommunityPostEditor } from "../use-community-post-editor";
import { communityService } from "../../services/communityService";
import type { CommunityPostResponse } from "../../types/community";
jest.mock("../../services/communityService", () => ({ communityService: { getPost: jest.fn(), createPost: jest.fn(), updatePost: jest.fn(), updatePostMedia: jest.fn() } }));
jest.mock("../../utils/auth", () => ({ formatApiErrorMessage: (_error: unknown, fallback: string) => fallback }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");
let editor!: ReturnType<typeof useCommunityPostEditor>;
function Harness({ id }: { id: string | null }) { editor = useCommunityPostEditor(id); return null; }
const original: CommunityPostResponse = { id: "p", author: { name: "Ana" }, body: "Texto", mediaData: "/image", imageDescription: "Original" };
beforeEach(() => { jest.clearAllMocks(); (communityService.getPost as jest.Mock).mockResolvedValue(original); });
it("loads the source post by id and saves only description changes without touching media", async () => {
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness id="p" />); });
  expect(communityService.getPost).toHaveBeenCalledWith("p");
  await act(async () => { editor.setDescription("Nova"); });
  await act(async () => { await editor.save("c"); });
  expect(communityService.updatePost).toHaveBeenCalledWith("p", { body: "Texto", imageDescription: "Nova" });
  expect(communityService.updatePostMedia).not.toHaveBeenCalled();
  await act(async () => { renderer.unmount(); });
});
it("creates multipart data and prevents concurrent submission", async () => {
  let finish!: () => void;
  (communityService.createPost as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness id={null} />); });
  await act(async () => { editor.setBody("Texto"); editor.selectImage({ uri: "file:/image.jpg", width: 10, height: 10 }); });
  await act(async () => { editor.setDescription("Nova imagem"); });
  await act(async () => { void editor.save("c"); void editor.save("c"); });
  expect(communityService.createPost).toHaveBeenCalledTimes(1);
  expect(communityService.createPost).toHaveBeenCalledWith("c", expect.any(FormData));
  await act(async () => { finish(); });
  expect(editor.submitting).toBe(false);
  await act(async () => { renderer.unmount(); });
});
it("routes image replacement and removal through multipart, clearing old description", async () => {
  const append = jest.spyOn(FormData.prototype, "append");
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness id="p" />); });
  await act(async () => { editor.selectImage({ uri: "file:/new.jpg", width: 10, height: 10 }); });
  expect(editor.draft.imageDescription).toBe("");
  await act(async () => { await editor.save("c"); });
  expect(communityService.updatePostMedia).toHaveBeenCalledWith("p", expect.any(FormData));
  append.mockClear();
  await act(async () => { editor.removeImage(); });
  await act(async () => { await editor.save("c"); });
  expect(append).toHaveBeenCalledWith("removeImage", "true");
  expect(append).toHaveBeenCalledWith("imageDescription", "");
  await act(async () => { renderer.unmount(); });
  append.mockRestore();
});
it("disables saving when loading the current post fails", async () => {
  (communityService.getPost as jest.Mock).mockRejectedValueOnce(new Error("Rede"));
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness id="p" />); });
  expect(editor.loadError).toBeTruthy();
  await act(async () => { expect(await editor.save("c")).toBe(false); });
  expect(communityService.updatePost).not.toHaveBeenCalled();
  await act(async () => { renderer.unmount(); });
});
