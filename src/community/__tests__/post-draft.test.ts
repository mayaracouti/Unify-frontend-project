import { createCommunityPostFormData, draftFromPost, draftTextUpdate, emptyPostDraft, removeDraftImage, replaceDraftImage, validatePostDraft } from "../post-draft";
import type { CommunityPostResponse } from "../../types/community";
const post: CommunityPostResponse = { id: "p", author: { name: "Ana" }, body: "Texto", mediaData: "/image", imageDescription: "Uma árvore" };
const image = { uri: "file:/nova.jpg", width: 10, height: 10 };
it("keeps body and description separate while editing text or description", () => {
  const draft = draftFromPost(post);
  expect(draftTextUpdate({ ...draft, body: "Novo texto" })).toEqual({ body: "Novo texto", imageDescription: "Uma árvore" });
  expect(draftTextUpdate({ ...draft, imageDescription: "Nova descrição" })).toEqual({ body: "Texto", imageDescription: "Nova descrição" });
  expect(draft.existingMedia).toBe("/image");
});
it("clears previous descriptions on replacement and removal", () => {
  const replaced = replaceDraftImage(draftFromPost(post), image);
  expect(replaced.imageDescription).toBe("");
  const removed = removeDraftImage({ ...replaced, imageDescription: "Nova" });
  expect(removed.image).toBeNull();
  expect(removed.imageDescription).toBe("");
  expect(removed.removeImage).toBe(true);
  const added = replaceDraftImage(removed, image);
  expect(added.removeImage).toBe(false);
});
it("accepts legacy posts, including bodies longer than the current input limit", () => {
  expect(draftFromPost({ ...post, imageDescription: null }).imageDescription).toBe("");
  expect(validatePostDraft(draftFromPost({ ...post, body: "a".repeat(1000) }))).toBeNull();
});
it("validates optional description and prevents orphans", () => {
  expect(validatePostDraft(emptyPostDraft)).toBeTruthy();
  expect(validatePostDraft({ ...emptyPostDraft, body: "Texto" })).toBeNull();
  expect(validatePostDraft({ ...emptyPostDraft, body: "Texto", imageDescription: "Órfã" })).toBeTruthy();
  expect(validatePostDraft({ ...draftFromPost(post), imageDescription: "a".repeat(241) })).toBeTruthy();
});
it("serializes multipart fields independently and includes explicit image removal", () => {
  const append = jest.spyOn(FormData.prototype, "append");
  createCommunityPostFormData({ ...replaceDraftImage(draftFromPost(post), image), imageDescription: "Nova" });
  expect(append).toHaveBeenCalledWith("body", "Texto");
  expect(append).toHaveBeenCalledWith("imageDescription", "Nova");
  expect(append).toHaveBeenCalledWith("image", expect.objectContaining({ uri: image.uri }));
  append.mockClear();
  createCommunityPostFormData(removeDraftImage(draftFromPost(post)));
  expect(append).toHaveBeenCalledWith("removeImage", "true");
  expect(append).toHaveBeenCalledWith("imageDescription", "");
  expect(append.mock.calls.some(([key]) => key === "image")).toBe(false);
  append.mockRestore();
});
