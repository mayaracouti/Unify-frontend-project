import { useCommunityCommentEditor } from "../use-community-comment-editor";
import { communityService } from "../../services/communityService";
import type { CommunityCommentResponse } from "../../types/community";

jest.mock("../../services/communityService", () => ({ communityService: { createComment: jest.fn(), createCommentWithImage: jest.fn() } }));
jest.mock("../../utils/globalToast", () => ({ showGlobalToast: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");

let editor!: ReturnType<typeof useCommunityCommentEditor>;
function Harness({ member = true }: { member?: boolean }) {
  editor = useCommunityCommentEditor("post", member, "token");
  return null;
}
const comment: CommunityCommentResponse = { id: "comment", author: { name: "Ana" }, body: "", mediaData: "/image", imageDescription: "Uma árvore" };
beforeEach(() => jest.clearAllMocks());

it("uploads image-only comments with independent description and preserves the entire draft on failure", async () => {
  const append = jest.spyOn(FormData.prototype, "append");
  (communityService.createCommentWithImage as jest.Mock).mockRejectedValueOnce(new Error("Rede")).mockResolvedValueOnce(comment);
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness />); });
  await act(async () => { editor.selectImage({ uri: "file:/image.jpg", width: 12, height: 12 }); });
  await act(async () => { editor.setImageDescription(" Uma árvore "); });
  await act(async () => { expect(await editor.submit()).toBeNull(); });
  expect(editor.image?.uri).toBe("file:/image.jpg");
  expect(editor.imageDescription).toBe(" Uma árvore ");
  expect(append).toHaveBeenCalledWith("body", "");
  expect(append).toHaveBeenCalledWith("imageDescription", "Uma árvore");
  await act(async () => { expect(await editor.submit()).toEqual(comment); });
  expect(editor.image).toBeNull();
  expect(editor.imageDescription).toBe("");
  await act(async () => { renderer.unmount(); });
  append.mockRestore();
});

it("keeps existing text-only API calls and blocks duplicate submissions", async () => {
  let finish!: (value: CommunityCommentResponse) => void;
  (communityService.createComment as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness />); });
  await act(async () => { editor.setBody(" Olá "); });
  await act(async () => { void editor.submit(); void editor.submit(); });
  expect(communityService.createComment).toHaveBeenCalledTimes(1);
  expect(communityService.createComment).toHaveBeenCalledWith("post", { body: "Olá" });
  await act(async () => { finish({ ...comment, body: "Olá", mediaData: null }); });
  expect(editor.body).toBe("");
  await act(async () => { renderer.unmount(); });
});

it("clears stale descriptions when replacing or removing an attachment", async () => {
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness />); });
  await act(async () => { editor.selectImage({ uri: "file:/old.jpg", width: 12, height: 12 }); });
  await act(async () => { editor.setBody("Texto"); editor.setImageDescription("Anterior"); });
  await act(async () => { editor.selectImage({ uri: "file:/new.jpg", width: 12, height: 12 }); });
  expect(editor.imageDescription).toBe("");
  await act(async () => { editor.setImageDescription("Nova"); });
  await act(async () => { editor.selectImage(null); });
  expect(editor.imageDescription).toBe("");
  expect(editor.body).toBe("Texto");
  await act(async () => { renderer.unmount(); });
});

it("does not submit empty comments or comments from nonmembers", async () => {
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness member={false} />); });
  await act(async () => { editor.setBody("Texto"); expect(await editor.submit()).toBeNull(); });
  await act(async () => { renderer.unmount(); renderer = create(<Harness />); });
  await act(async () => { expect(await editor.submit()).toBeNull(); });
  expect(communityService.createComment).not.toHaveBeenCalled();
  expect(communityService.createCommentWithImage).not.toHaveBeenCalled();
  await act(async () => { renderer.unmount(); });
});
