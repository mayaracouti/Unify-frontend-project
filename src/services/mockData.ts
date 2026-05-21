import type { TokenResponse } from "../types/auth";
import type {
  ProfileCompletionResponse,
  ProfileOptionsResponse,
  UserMatchPreferencesResponse,
  UserMatchPreferencesUpsertRequest,
  UserProfileDirectoryItemResponse,
  UserProfileImageResponse,
  UserProfileResponse,
  UserProfileUpsertRequest,
} from "../types/profile";

const genders = [
  { id: 1, description: "Mulher" },
  { id: 2, description: "Homem" },
  { id: 3, description: "Não binário" },
  { id: 4, description: "Prefiro não informar" },
];

const disabilities = [
  { id: 1, description: "Física", ionicIcon: "walk-outline" },
  { id: 2, description: "Visual", ionicIcon: "eye-outline" },
  { id: 3, description: "Auditiva", ionicIcon: "ear-outline" },
  { id: 4, description: "Intelectual", ionicIcon: "accessibility-outline" },
];

const accessibilityNeeds = [
  { id: 1, description: "Cadeira de rodas" },
  { id: 2, description: "Libras" },
  { id: 3, description: "Leitor de tela" },
  { id: 4, description: "Comunicação assistiva" },
];

const autonomyLevels = [
  { id: 1, description: "Independente" },
  { id: 2, description: "Parcialmente independente" },
  { id: 3, description: "Precisa de apoio" },
];

const communicationForms = [
  { id: 1, description: "Texto" },
  { id: 2, description: "Áudio" },
  { id: 3, description: "Vídeo" },
  { id: 4, description: "Libras" },
  { id: 5, description: "Comunicação assistiva" },
];

const lifestyleTypes = [
  { id: 1, description: "Caseiro" },
  { id: 2, description: "Social" },
  { id: 3, description: "Gosta de viajar" },
  { id: 4, description: "Atividades acessíveis" },
];

const energyLevels = [
  { id: 1, description: "Baixa" },
  { id: 2, description: "Moderada" },
  { id: 3, description: "Alta" },
];

const interestTypes = [
  { id: 1, description: "Esportes adaptados" },
  { id: 2, description: "Cultura" },
  { id: 3, description: "Tecnologia" },
  { id: 4, description: "Jogos" },
  { id: 5, description: "Música" },
  { id: 6, description: "Filmes e séries" },
];

const connectionTypes = [
  { id: 1, description: "Amizade" },
  { id: 2, description: "Relacionamento" },
  { id: 3, description: "Networking" },
  { id: 4, description: "Comunidade" },
];

const pronouns = [
  { id: 1, description: "Ela/dela" },
  { id: 2, description: "Ele/dele" },
  { id: 3, description: "Elu/delu" },
];

const loveLanguages = [
  { id: 1, description: "Tempo de qualidade" },
  { id: 2, description: "Palavras de afirmação" },
  { id: 3, description: "Atos de serviço" },
  { id: 4, description: "Presentes" },
  { id: 5, description: "Toque físico" },
];

export function createMockTokenResponse(): TokenResponse {
  return {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    expiresIn: 60 * 60 * 24,
  };
}

export const mockProfileCompletion: ProfileCompletionResponse = {
  profileCompleted: true,
  matchPreferencesCompleted: true,
  fullyCompleted: true,
  missingProfileFields: [],
  missingMatchPreferenceFields: [],
};

export const mockProfileOptions: ProfileOptionsResponse = {
  genders,
  pronouns,
  disabilities,
  accessibilityNeeds,
  autonomyLevels,
  communicationForms,
  lifestyleTypes,
  energyLevels,
  interestTypes,
  loveLanguages,
  connectionTypes,
  similarityPreferences: [
    { value: "ANY", description: "Tanto faz" },
    { value: "SIMILAR", description: "Similar" },
    { value: "DIFFERENT", description: "Diferente" },
  ],
};

export const mockUserProfile: UserProfileResponse = {
  id: "mock-profile-1",
  bio: "Pessoa curiosa, acolhedora e pronta para conhecer conexões acessíveis.",
  name: "Pedro",
  lastName: "Ambiel",
  age: 29,
  user: {
    id: "mock-user-1",
    name: "Pedro",
    lastName: "Ambiel",
    email: "teste@gmail.com",
    cellphone: null,
    age: 29,
  },
  gender: genders[1],
  pronouns: pronouns[1],
  disabilities: [disabilities[0]],
  accessibilityNeeds: [accessibilityNeeds[0], accessibilityNeeds[2]],
  autonomyLevel: autonomyLevels[0],
  communicationForms: [communicationForms[0], communicationForms[1]],
  lifestyleTypes: [lifestyleTypes[1], lifestyleTypes[3]],
  energyLevel: energyLevels[1],
  interestTypes: [interestTypes[1], interestTypes[2], interestTypes[4]],
  loveLanguages: [loveLanguages[0], loveLanguages[1]],
  activeLocation: {
    latitude: -1.4558,
    longitude: -48.4902,
  },
  profilePicture: null,
  galleryImages: [],
};

export const mockDirectoryProfiles: UserProfileDirectoryItemResponse[] = [
  mockUserProfile,
  {
    ...mockUserProfile,
    id: "mock-profile-2",
    userId: "mock-user-2",
    user: {
      id: "mock-user-2",
      name: "Marina",
      lastName: "Costa",
      email: "marina.mock@example.com",
      cellphone: null,
      age: 27,
    },
    name: "Marina",
    lastName: "Costa",
    age: 27,
    gender: genders[0],
    bio: "Gosto de tecnologia, música e passeios tranquilos com boa conversa.",
    disabilities: [disabilities[2]],
    accessibilityNeeds: [accessibilityNeeds[1]],
    communicationForms: [communicationForms[0], communicationForms[3]],
    interestTypes: [interestTypes[2], interestTypes[4], interestTypes[5]],
  },
];

export const mockMatchPreferences: UserMatchPreferencesResponse = {
  id: "mock-match-preferences-1",
  connectionType: connectionTypes[0],
  accessibilityNeedSimilarity: "ANY",
  autonomyCompatibility: "SIMILAR",
  lifestyleSimilarity: "ANY",
  energyLevelSimilarity: "SIMILAR",
  loveLanguageSimilarity: "ANY",
  minAge: 20,
  maxAge: 40,
  maxMatchDistanceKm: 50,
  desiredGenders: [genders[0], genders[1], genders[2]],
};

function findById<T extends { id: number }>(items: T[], id?: number | null): T | null {
  return items.find((item) => item.id === id) ?? null;
}

function filterByIds<T extends { id: number }>(items: T[], ids?: number[] | null): T[] {
  return items.filter((item) => ids?.includes(item.id));
}

export function buildMockProfileFromPayload(
  payload: UserProfileUpsertRequest
): UserProfileResponse {
  return {
    ...mockUserProfile,
    bio: payload.bio ?? mockUserProfile.bio,
    gender: findById(genders, payload.genderId),
    pronouns: findById(pronouns, payload.pronounsId),
    disabilities: filterByIds(disabilities, payload.disabilityIds),
    accessibilityNeeds: filterByIds(accessibilityNeeds, payload.accessibilityNeedIds),
    autonomyLevel: findById(autonomyLevels, payload.autonomyLevelId),
    communicationForms: filterByIds(communicationForms, payload.communicationFormIds),
    lifestyleTypes: filterByIds(lifestyleTypes, payload.lifestyleTypeIds),
    energyLevel: findById(energyLevels, payload.energyLevelId),
    interestTypes: filterByIds(interestTypes, payload.interestTypeIds),
    loveLanguages: filterByIds(loveLanguages, payload.loveLanguageIds),
    activeLocation: payload.location ?? mockUserProfile.activeLocation,
  };
}

export function buildMockMatchPreferencesFromPayload(
  payload: UserMatchPreferencesUpsertRequest
): UserMatchPreferencesResponse {
  return {
    ...mockMatchPreferences,
    connectionType: findById(connectionTypes, payload.connectionTypeId),
    accessibilityNeedSimilarity: payload.accessibilityNeedSimilarity,
    autonomyCompatibility: payload.autonomyCompatibility,
    lifestyleSimilarity: payload.lifestyleSimilarity,
    energyLevelSimilarity: payload.energyLevelSimilarity,
    loveLanguageSimilarity: payload.loveLanguageSimilarity,
    minAge: payload.minAge,
    maxAge: payload.maxAge,
    maxMatchDistanceKm: payload.maxMatchDistanceKm,
    desiredGenders: filterByIds(genders, payload.desiredGenderIds),
  };
}

export function createMockProfileImage(profilePicture: boolean): UserProfileImageResponse {
  return {
    id: `mock-image-${Date.now()}`,
    profilePicture,
    active: true,
    url: "",
  };
}
