import { communityService } from "../communityService";
import { customApiCall } from "../../api/customApi";
jest.mock("../../api/customApi", () => ({ customApiCall: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));
jest.mock("../../config/runtime", () => ({ runtimeConfig: { apiBaseUrl: "https://api" } }));
it("loads complete post by id and keeps authenticated description updates independent", () => {
  communityService.getPost("post");
  expect(customApiCall.get).toHaveBeenCalledWith("/communities/posts/post", undefined, { requiresAuth: true });
  communityService.updatePost("post", { imageDescription: "Uma árvore" });
  expect(customApiCall.put).toHaveBeenCalledWith("/communities/posts/post", { imageDescription: "Uma árvore" }, { requiresAuth: true });
  const form = new FormData();
  communityService.updatePostMedia("post", form);
  expect(customApiCall.put).toHaveBeenCalledWith("/communities/posts/post/media", form, { requiresAuth: true });
});

it("uploads community comment attachments as authenticated multipart with a media timeout", () => {
  const form = new FormData();
  communityService.createCommentWithImage("post", form);
  expect(customApiCall.post).toHaveBeenCalledWith("/communities/posts/post/comments", form, { requiresAuth: true, timeoutMs: 60000 });
});
