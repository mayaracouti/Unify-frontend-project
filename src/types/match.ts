import type { UserProfileImageResponse } from "./profile";

export interface MatchDiscoveryRequest {
  alreadyUsedProfileIds?: string[];
}

export interface MatchCreateRequest {
  targetProfileId: string;
  accepted: boolean;
}

export interface MatchResponse {
  id: string;
  starterProfileId: string;
  pendingProfileId: string;
  createdAt: string;
  starterAccepted: boolean;
  pendingAccepted: boolean | null;
  mutualMatch: boolean;
}

export interface MutualMatchResponse {
  userProfileId: string;
  profileImage: UserProfileImageResponse | null;
}
