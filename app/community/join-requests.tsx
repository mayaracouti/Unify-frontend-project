import { useIsFocused } from "expo-router/react-navigation";
import { useCommunityAccess } from "../../src/hooks/use-community-access";
import { useCommunityPage } from "../../src/hooks/use-community-page";
import { canModerate } from "../../src/utils/communityPermissions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { buildActionSpeech, useTTS } from "../../src/accessibility/tts";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAuth } from "../../src/context/AuthContext";
import { communityService } from "../../src/services/communityService";
import type {
  CommunityJoinRequestResponse,
} from "../../src/types/community";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { showGlobalToast } from "../../src/utils/globalToast";

const REQUESTS_PAGE_SIZE = 20;



function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getInitials(name?: string | null) {
  if (!name) {
    return "";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function JoinRequestCard({
  authToken,
  busyAction,
  onApprove,
  onDecline,
  request,
}: {
  authToken: string | null;
  busyAction: "approve" | "decline" | null;
  onApprove: () => void;
  onDecline: () => void;
  request: CommunityJoinRequestResponse;
}) {
  const avatarUrl = communityService.resolveAssetUrl(request.avatarData);
  const requesterName = request.name ?? "Usuário sem nome";
  const busy = busyAction !== null;

  return (
    <View className="rounded-[24px] border border-[#353534] bg-surface-alt p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]">
          {avatarUrl ? (
            <AuthenticatedRemoteImage
              uri={avatarUrl}
              authToken={authToken}
              className="h-full w-full"
              resizeMode="cover"
              fallback={
                <LinearGradient
                  colors={["#CDBDFF", "#7C4DFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="h-full w-full items-center justify-center"
                >
                  <Text className="text-[14px] font-black text-white">
                    {getInitials(requesterName) || "?"}
                  </Text>
                </LinearGradient>
              }
            />
          ) : (
            <LinearGradient
              colors={["#CDBDFF", "#7C4DFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-full w-full items-center justify-center"
            >
              <Text className="text-[14px] font-black text-white">
                {getInitials(requesterName) || "?"}
              </Text>
            </LinearGradient>
          )}
        </View>

        <View className="flex-1">
          <Text className="text-[16px] font-black text-white">{requesterName}</Text>
          <Text className="mt-0.5 text-[13px] font-semibold text-content-secondary">
            Solicitou entrada na comunidade
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <Pressable
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border-2 border-[#EAEA00] bg-[#EAEA00]"
          onPress={onApprove}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Aceitar entrada de ${requesterName}`}
          accessibilityHint="Aprova a entrada e adiciona a pessoa como membro"
          accessibilityState={{ disabled: busy, busy: busyAction === "approve" }}
        >
          {busyAction === "approve" ? (
            <ActivityIndicator color="#323200" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#323200" />
              <Text className="text-[15px] font-black text-[#1D1D00]">Aceitar</Text>
            </>
          )}
        </Pressable>

        <Pressable
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border-2 border-[#6A4456] bg-[#2A1C24]"
          onPress={onDecline}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Recusar entrada de ${requesterName}`}
          accessibilityHint="Recusa a solicitação de entrada na comunidade"
          accessibilityState={{ disabled: busy, busy: busyAction === "decline" }}
        >
          {busyAction === "decline" ? (
            <ActivityIndicator color="#FFD3DD" size="small" />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={20} color="#FFD3DD" />
              <Text className="text-[15px] font-black text-[#FFD3DD]">Recusar</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const requestKey = (request: CommunityJoinRequestResponse) => request.id;

export default function CommunityJoinRequestsScreen() {
  const router = useRouter();
  const { speak } = useTTS();
  const params = useLocalSearchParams<{
    communityId?: string | string[];
    communityName?: string | string[];
  }>();
  const { session } = useAuth();

  const communityId = useMemo(
    () => normalizeRouteParam(params.communityId).trim(),
    [params.communityId]
  );
  const communityName = useMemo(
    () => normalizeRouteParam(params.communityName).trim(),
    [params.communityName]
  );
  const authToken = session?.accessToken ?? null;

  const access = useCommunityAccess(communityId);
  const isFocused = useIsFocused();
  const allowed = canModerate(access.community);
  const fetchRequests = useCallback((page: number) => communityService.getJoinRequests(communityId, { page, size: REQUESTS_PAGE_SIZE }), [communityId]);
  const list = useCommunityPage(fetchRequests, requestKey);
  const { refresh, loadMore, setItems } = list;
  const reloadAccess = access.reload;
  const requests = { content: list.items, hasNext: list.hasNext };
  const loading = access.loading || list.loading && list.items.length === 0;
  const loadingMore = list.loadingMore;
  const refreshing = list.loading && list.items.length > 0;
  const loadError = access.error || list.error || (!access.loading && !allowed ? "Somente administradores e moderadores podem revisar solicitações." : null);
  const [busyRequest, setBusyRequest] = useState<{ id: string; action: "approve" | "decline" } | null>(null);
  const actionLock = useRef(false);
  const loadRequests = useCallback(async (options?: { refresh?: boolean; append?: boolean }) => {
    if (!allowed) { await reloadAccess(); return; }
    if (options?.append) await loadMore(); else await refresh();
  }, [allowed, reloadAccess, loadMore, refresh]);
  useEffect(() => { if (isFocused && allowed) void refresh(); }, [isFocused, allowed, refresh]);
  const removeRequestFromList = useCallback((requestId: string) => {
    setItems((current) => current.filter((request) => request.id !== requestId));
    // Removal changes page offsets: refresh before loading the next page.
    void refresh();
  }, [setItems, refresh]);

  const handleApprove = useCallback(
    async (request: CommunityJoinRequestResponse) => {
      if (!communityId || actionLock.current || !allowed) {
        return;
      }

      speak(buildActionSpeech("Aceitar entrada de", request.name ?? null));
      actionLock.current = true;
      setBusyRequest({ id: request.id, action: "approve" });

      try {
        await communityService.approveJoinRequest(communityId, request.id);
        removeRequestFromList(request.id);

        showGlobalToast({
          title: "Solicitação aprovada",
          variant: "success",
          message: `${request.name ?? "A pessoa"} agora faz parte da comunidade.`,
        });
        announceForAccessibility(
          accessibilityAnnouncements.joinRequestApproved(request.name ?? "A pessoa")
        );
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        actionLock.current = false;
        setBusyRequest(null);
      }
    },
    [allowed, communityId, removeRequestFromList, speak]
  );

  const handleDecline = useCallback(
    async (request: CommunityJoinRequestResponse) => {
      if (!communityId || actionLock.current || !allowed) {
        return;
      }

      speak(buildActionSpeech("Recusar entrada de", request.name ?? null));
      actionLock.current = true;
      setBusyRequest({ id: request.id, action: "decline" });

      try {
        await communityService.declineJoinRequest(communityId, request.id);
        removeRequestFromList(request.id);

        showGlobalToast({
          title: "Solicitação recusada",
          variant: "success",
          message: "A pessoa pode enviar uma nova solicitação quando quiser.",
        });
        announceForAccessibility(
          accessibilityAnnouncements.joinRequestDeclined(request.name ?? "A pessoa")
        );
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        actionLock.current = false;
        setBusyRequest(null);
      }
    },
    [allowed, communityId, removeRequestFromList, speak]
  );

  return (
    <View className="flex-1 bg-[#09090A]">
      <SafeAreaView className="flex-1 bg-[#09090A]">
        <View className="h-16 flex-row items-center justify-between border-b border-[#2A2A2A] px-6">
          <View className="flex-row items-center">
            <Pressable
              className="mr-3 h-10 w-10 items-center justify-center rounded-full"
              onPress={() => {
                speak("Voltar");
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              accessibilityHint="Volta para a tela anterior"
            >
              <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
            </Pressable>
            <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
          </View>

          <Text className="text-[14px] font-bold text-[#CAC3D8]">Solicitações</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ScreenLoading label="Carregando solicitações..." />
          </View>
        ) : loadError && requests.content.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <ScreenError
              title="Solicitações indisponíveis"
              message={loadError}
              onRetry={() => {
                void loadRequests();
              }}
            />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-16 pt-8"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor="#7C4DFF"
                onRefresh={() => {
                  void loadRequests({ refresh: true });
                }}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View className="rounded-[28px] bg-[#111214] p-6">
              <Text className="text-[28px] font-extrabold leading-9 text-white">
                Solicitações de entrada
              </Text>
              <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                {communityName
                  ? `Aprove ou recuse quem pediu para entrar na comunidade ${communityName}.`
                  : "Aprove ou recuse quem pediu para entrar nesta comunidade privada."}
              </Text>
            </View>

            {loadError && requests.content.length > 0 ? (
              <View className="mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                <Text className="text-[15px] font-bold text-[#FFD3DD]">
                  Atualização parcial
                </Text>
                <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                  {loadError}
                </Text>
              </View>
            ) : null}

            <View className="mt-6 gap-4">
              {requests.content.length === 0 ? (
                <ScreenEmpty
                  className="rounded-[28px] border border-[#353534] bg-surface-alt px-6 py-10"
                  icon={
                    <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-[#201F1F]">
                      <Ionicons name="checkmark-done-outline" size={32} color="#7C4DFF" />
                    </View>
                  }
                  title="Fila vazia"
                  description="Nenhuma solicitação de entrada pendente nesta comunidade."
                />
              ) : (
                requests.content.map((request) => (
                  <JoinRequestCard
                    key={request.id}
                    authToken={authToken}
                    busyAction={busyRequest?.id === request.id ? busyRequest.action : null}
                    request={request}
                    onApprove={() => {
                      void handleApprove(request);
                    }}
                    onDecline={() => {
                      void handleDecline(request);
                    }}
                  />
                ))
              )}
            </View>

            {requests.content.length > 0 && requests.hasNext ? (
              <Pressable
                className="mt-6 items-center justify-center rounded-[24px] border border-[#3A3246] bg-[#17181C] px-5 py-2"
                onPress={() => {
                  speak("Carregar mais solicitações");
                  void loadRequests({ append: true });
                }}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Carregar mais solicitações"
                accessibilityHint="Adiciona mais solicitações de entrada à lista"
                accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
              >
                {loadingMore ? (
                  <ActivityIndicator color="#EAEA00" size="small" />
                ) : (
                  <Text className="text-[14px] font-black text-white">Carregar mais</Text>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
