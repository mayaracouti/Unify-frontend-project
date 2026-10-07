import { useCommunityPostActions } from "../use-community-post-actions";
import { communityService } from "../../services/communityService";
import type { CommunityLikeResponse, CommunityPostResponse } from "../../types/community";
jest.mock("../../services/communityService", () => ({ communityService: { likePost: jest.fn(), unlikePost: jest.fn() } }));
// Same renderer setup as the existing feed action tests.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");
const post = (id: string): CommunityPostResponse => ({ id, author: { name: "Ana" }, body: "Texto" });
it("allows independent requests and blocks duplicate submits synchronously", async () => {
  let finish!: (response: CommunityLikeResponse) => void;
  let fail!: (error: Error) => void;
  (communityService.likePost as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
    .mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  const onLike = jest.fn();
  let actions!: ReturnType<typeof useCommunityPostActions>;
  function Harness() { actions = useCommunityPostActions(onLike); return null; }
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness />); });
  await act(async () => {
    void actions.toggleLike(post("a")); void actions.toggleLike(post("a")); void actions.toggleLike(post("b"));
  });
  expect(communityService.likePost).toHaveBeenCalledTimes(2);
  expect([...actions.likeBusyPostIds]).toEqual(["a", "b"]);
  await act(async () => { finish({ postId: "a", likesCount: 1, likedByCurrentUser: true }); });
  expect([...actions.likeBusyPostIds]).toEqual(["b"]);
  await act(async () => { fail(new Error("Rede")); });
  expect(onLike).toHaveBeenCalledTimes(1);
  expect(actions.likeBusyPostIds.size).toBe(0);
  await act(async () => { renderer.unmount(); });
});
it("ignores responses from a previous community/session", async () => {
  let finish!: (response: CommunityLikeResponse) => void;
  (communityService.likePost as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const onLike = jest.fn();
  let actions!: ReturnType<typeof useCommunityPostActions>;
  function Harness({ scope }: { scope: string }) { actions = useCommunityPostActions(onLike, scope); return null; }
  let renderer!: { update: (element: React.ReactElement) => void; unmount: () => void };
  await act(async () => { renderer = create(<Harness scope="old" />); });
  await act(async () => { void actions.toggleLike(post("a")); });
  await act(async () => { renderer.update(<Harness scope="new" />); });
  await act(async () => { finish({ postId: "a" }); });
  expect(onLike).not.toHaveBeenCalled();
  expect(actions.likeBusyPostIds.size).toBe(0);
  await act(async () => { renderer.unmount(); });
});
beforeEach(() => jest.clearAllMocks());
