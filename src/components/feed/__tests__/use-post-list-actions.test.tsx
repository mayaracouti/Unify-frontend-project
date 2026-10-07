import React, { useState } from "react";
import type { UserPostResponse } from "../../../types/social";
import { feedService } from "../../../services/feedService";
import { usePostListActions } from "../use-post-list-actions";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../../services/feedService", () => ({ feedService: { likePost: jest.fn(), unlikePost: jest.fn() } }));
jest.mock("../../../services/communityService", () => ({ communityService: {} }));
jest.mock("../../../services/followService", () => ({ followService: {} }));
jest.mock("../../../utils/accessibilityAnnouncements", () => ({
  accessibilityAnnouncements: { postLiked: () => "Curtida", postUnliked: () => "Descurtida" },
  announceForAccessibility: jest.fn(),
}));
jest.mock("../../../utils/globalToast", () => ({ showGlobalToast: jest.fn() }));
jest.mock("../../report/report-modal", () => ({ ReportModal: () => null }));
jest.mock("../../social/cancel-follow-request-sheet", () => ({ CancelFollowRequestSheet: () => null }));
jest.mock("../../ui/action-sheet", () => ({ ActionSheet: () => null }));

// Carregado após os mocks para usar o mesmo React do hook.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");

function post(id: string): UserPostResponse {
  return {
    id, origin: "PERSONAL", community: null,
    author: { userId: "author", userProfileId: "profile", name: "Ana", avatarUrl: null },
    body: "Olá", mediaUrl: null, createdAt: "2026-10-06", editedAt: null,
    likesCount: 0, commentsCount: 0, likedByCurrentUser: false, commentedByCurrentUser: false,
  };
}

it("permite curtidas paralelas, bloqueia toque duplicado e reverte somente o post que falhou", async () => {
  const first = post("1");
  const second = post("2");
  let resolveFirst!: (value: unknown) => void;
  let rejectSecond!: (reason: Error) => void;
  (feedService.likePost as jest.Mock)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockImplementationOnce(() => new Promise((_, reject) => { rejectSecond = reject; }));

  let actions!: ReturnType<typeof usePostListActions>;
  let posts!: UserPostResponse[];
  function Harness() {
    const [items, setItems] = useState([first, second]);
    posts = items;
    actions = usePostListActions(setItems);
    return null;
  }
  let renderer: { unmount: () => void };
  await act(async () => { renderer = create(<Harness />); });
  await act(async () => {
    actions.handlers.onToggleLike(first);
    actions.handlers.onToggleLike(first);
    actions.handlers.onToggleLike(second);
  });
  expect(feedService.likePost).toHaveBeenCalledTimes(2);
  expect([...actions.likeBusyPostIds]).toEqual(["1", "2"]);
  expect(posts.map((item) => item.likesCount)).toEqual([1, 1]);

  await act(async () => {
    resolveFirst({ likedByCurrentUser: true, likesCount: 3 });
    rejectSecond(new Error("Sem conexão"));
  });
  expect(posts.map((item) => [item.likesCount, item.likedByCurrentUser])).toEqual([[3, true], [0, false]]);
  expect(actions.likeBusyPostIds.size).toBe(0);
  await act(async () => { renderer.unmount(); });
});
