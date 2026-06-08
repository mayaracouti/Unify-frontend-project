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

export interface MutualMatchSummaryResponse {
  userId: string;
  userProfileId: string;
  fullName: string | null;
  age: number | null;
  profilePicture: UserProfileImageResponse | null;
}

export interface MutualMatchPageResponse {
  matches: MutualMatchSummaryResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}
