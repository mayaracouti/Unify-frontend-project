export type SimilarityPreference = "ANY" | "SIMILAR" | "DIFFERENT";

export interface LookupOptionResponse {
  id: number;
  description: string;
}

export interface DisabilityOptionResponse extends LookupOptionResponse {
  ionicIcon?: string | null;
}

export interface SimilarityOptionResponse {
  value: SimilarityPreference;
  description: string;
}

export interface LocationResponse {
  latitude: number | null;
  longitude: number | null;
}

export interface ProfileOptionsResponse {
  genders: LookupOptionResponse[];
  disabilities: DisabilityOptionResponse[];
  accessibilityNeeds: LookupOptionResponse[];
  autonomyLevels: LookupOptionResponse[];
  communicationForms: LookupOptionResponse[];
  lifestyleTypes: LookupOptionResponse[];
  energyLevels: LookupOptionResponse[];
  interestTypes: LookupOptionResponse[];
  connectionTypes: LookupOptionResponse[];
  similarityPreferences: SimilarityOptionResponse[];
}

export interface ProfileCompletionResponse {
  profileCompleted: boolean;
  matchPreferencesCompleted: boolean;
  fullyCompleted: boolean;
  missingProfileFields: string[];
  missingMatchPreferenceFields: string[];
}

export interface UserProfileResponse {
  id: string | null;
  bio: string | null;
  gender: LookupOptionResponse | null;
  disabilities: DisabilityOptionResponse[];
  accessibilityNeeds: LookupOptionResponse[];
  autonomyLevel: LookupOptionResponse | null;
  communicationForms: LookupOptionResponse[];
  lifestyleTypes: LookupOptionResponse[];
  energyLevel: LookupOptionResponse | null;
  interestTypes: LookupOptionResponse[];
  activeLocation: LocationResponse | null;
}

export interface UserProfileUpsertRequest {
  bio?: string;
  genderId?: number;
  disabilityIds: number[];
  accessibilityNeedIds: number[];
  autonomyLevelId?: number;
  communicationFormIds: number[];
  lifestyleTypeIds: number[];
  energyLevelId?: number;
  interestTypeIds: number[];
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface UserMatchPreferencesResponse {
  id: string | null;
  connectionType: LookupOptionResponse | null;
  accessibilityNeedSimilarity: SimilarityPreference | null;
  autonomyCompatibility: SimilarityPreference | null;
  lifestyleSimilarity: SimilarityPreference | null;
  energyLevelSimilarity: SimilarityPreference | null;
  minAge: number | null;
  maxAge: number | null;
  maxMatchDistanceKm: number | null;
  desiredGenders: LookupOptionResponse[];
}

export interface UserMatchPreferencesUpsertRequest {
  connectionTypeId?: number;
  accessibilityNeedSimilarity: SimilarityPreference;
  autonomyCompatibility: SimilarityPreference;
  lifestyleSimilarity: SimilarityPreference;
  energyLevelSimilarity: SimilarityPreference;
  minAge?: number;
  maxAge?: number;
  maxMatchDistanceKm: number;
  desiredGenderIds: number[];
}
