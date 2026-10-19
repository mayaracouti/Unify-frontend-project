import { useTTS } from "../accessibility/tts";
import { postSpeechParts } from "../community/post-content";
import type { CommunityPostResponse } from "../types/community";
export function useCommunityPostReader(post: CommunityPostResponse) {
  const { enabled, speakSequence, stop } = useTTS();
  return {
    read: () => speakSequence([`Publicação de ${post.author.name}`,
      ...postSpeechParts({ ...post, hasImage: Boolean(post.mediaData), origin: "COMMUNITY" }),
      `${post.likesCount ?? 0} curtidas e ${post.commentsCount ?? 0} comentários`]),
    stop: enabled ? stop : undefined,
  };
}
