import type { ProfileField } from "./privacy";

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

/**
 * Audio de apresentacao do proprio perfil (`GET /users/me/profile/audio`,
 * `PUT` multipart e campo `presentationAudio` de `GET /users/me/profile`).
 */
export interface UserProfileAudioResponse {
  id: string;
  durationSeconds: number;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  /** Relativa (`/users/me/profile/audio/{id}`): resolver com `profileService.resolveProfileAudioUrl`. */
  url: string;
}

export interface UserProfileAudioStatusResponse {
  audio: UserProfileAudioResponse | null;
}

/**
 * Audio de apresentacao visto por OUTRA pessoa (perfil publico/Encontros).
 * Os bytes saem de `profileService.resolvePublicPresentationAudioUrl`.
 */
export interface UserProfileAudioPublicResponse {
  id: string;
  durationSeconds: number;
}

export interface PublicProfileImageIdsResponse {
  userProfileId: string;
  galleryImageIds: string[];
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
  /** Nulo quando a pessoa ainda nao gravou (ou removeu) o audio. */
  presentationAudio?: UserProfileAudioResponse | null;
}

export interface UserProfileDirectoryItemResponse extends UserProfileResponse {
  userId?: string | null;
  email?: string | null;
  cellphone?: string | null;
  matchPreferences?: UserMatchPreferencesResponse | null;
}

export interface UserPublicProfileResponse {
  userProfileId: string;
  name: string;
  /** Nulo quando o dono ocultou a idade (`showAge = false`). Nunca exibir "0". */
  age: number | null;
  /**
   * Distancia calculada pelo backend. Nula quando o dono ocultou
   * (`showDistance = false`) ou quando um dos lados nao tem localizacao.
   */
  distanceKm: number | null;
  bio: string | null;
  gender: LookupOptionResponse | null;
  pronouns: LookupOptionResponse | null;
  disabilities: DisabilityOptionResponse[];
  accessibilityNeeds: LookupOptionResponse[];
  autonomyLevel: LookupOptionResponse | null;
  communicationForms: LookupOptionResponse[];
  lifestyleTypes: LookupOptionResponse[];
  loveLanguages: LookupOptionResponse[];
  energyLevel: LookupOptionResponse | null;
  interestTypes: LookupOptionResponse[];
  galleryImageIds: string[];
  /** Sem autoplay: a tela anuncia que existe e a pessoa escolhe ouvir. */
  presentationAudio: UserProfileAudioPublicResponse | null;
  /**
   * Partes que o visitante NAO pode ver (privacidade do dono). Nelas o backend
   * devolve `null`/`[]`; a tela nao renderiza nada (nem "Não informado") e a
   * fala as ignora. Galeria/audio escondidos respondem 404 nos bytes: nao pedir.
   * O codigo usa `getHiddenFields` para tolerar backend antigo (ausente = `[]`).
   */
  hiddenFields: ProfileField[];
  /**
   * Conta privada que eu nao sigo (sempre `true` nesse caso, mesmo com match
   * mutuo). Bio, galeria, audio e `GET /users/{id}/posts` ficam bloqueados.
   * Visitante comum: tudo em `hiddenFields`, idade/distancia nulas. Com match
   * mutuo: os dados de match que o dono nao escondeu (e idade/distancia, se
   * os toggles permitirem) continuam vindo. Ausente (backend antigo) = `false`.
   */
  locked?: boolean;
  /** Id do `User` dono do perfil (alvo da denuncia). Opcional: backend antigo. */
  userId?: string | null;
  /**
   * Foto de perfil (relativa, `/communities/users/{userId}/avatar`); vem mesmo
   * com `locked`. Nula sem foto. Resolver como os avatares sociais.
   */
  avatarUrl?: string | null;
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
