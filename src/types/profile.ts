export type SimilarityPreference = "ANY" | "SIMILAR" | "DIFFERENT";

export interface LookupOptionResponse {
  id: number;
  description: string;
  ionicIcon?: string | null;
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

export interface UserProfileImageResponse {
  id: string;
  profilePicture: boolean;
  active: boolean;
  url: string;
}

export interface ProfileOptionsResponse {
  genders: LookupOptionResponse[];
  pronouns: LookupOptionResponse[];
  disabilities: DisabilityOptionResponse[];
  accessibilityNeeds: LookupOptionResponse[];
  autonomyLevels: LookupOptionResponse[];
  communicationForms: LookupOptionResponse[];
  lifestyleTypes: LookupOptionResponse[];
  energyLevels: LookupOptionResponse[];
  interestTypes: LookupOptionResponse[];
  loveLanguages: LookupOptionResponse[];
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
  name?: string | null;
  lastName?: string | null;
  age?: number | null;
  user?: {
    id?: string | null;
    name?: string | null;
    lastName?: string | null;
    email?: string | null;
    cellphone?: string | null;
    age?: number | null;
  } | null;
  gender: LookupOptionResponse | null;
  pronouns: LookupOptionResponse | null;
  disabilities: DisabilityOptionResponse[];
  accessibilityNeeds: LookupOptionResponse[];
  autonomyLevel: LookupOptionResponse | null;
  communicationForms: LookupOptionResponse[];
  lifestyleTypes: LookupOptionResponse[];
  energyLevel: LookupOptionResponse | null;
  interestTypes: LookupOptionResponse[];
  loveLanguages: LookupOptionResponse[];
  activeLocation: LocationResponse | null;
  profilePicture?: UserProfileImageResponse | null;
  galleryImages?: UserProfileImageResponse[];
}

export interface UserProfileDirectoryItemResponse extends UserProfileResponse {
  userId?: string | null;
  email?: string | null;
  cellphone?: string | null;
  matchPreferences?: UserMatchPreferencesResponse | null;
}

export interface UserProfileUpsertRequest {
  bio?: string;
  genderId?: number;
  pronounsId?: number | null;
  disabilityIds: number[];
  accessibilityNeedIds: number[];
  autonomyLevelId?: number;
  communicationFormIds: number[];
  lifestyleTypeIds: number[];
  energyLevelId?: number;
  interestTypeIds: number[];
  loveLanguageIds?: number[] | null;
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
  loveLanguageSimilarity: SimilarityPreference | null;
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
  loveLanguageSimilarity: SimilarityPreference | null;
  minAge: number;
  maxAge: number;
  maxMatchDistanceKm: number;
  desiredGenderIds: number[];
}
