import { useCommunityAccess } from "../../src/hooks/use-community-access";
import { communityRole } from "../../src/utils/communityPermissions";
import { useAppShell } from "../../src/context/AppShellContext";
import { ScreenError } from "../../src/components/ui/screen-error";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { buildActionSpeech, useTTS } from "../../src/accessibility/tts";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { communityService } from "../../src/services/communityService";
import type { CommunityRole, CommunityMemberResponse } from "../../src/types/community";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { showGlobalToast } from "../../src/utils/globalToast";

const ROLE_LABELS: Record<CommunityRole, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderador",
  MEMBER: "Membro",
};

const ROLE_DESCRIPTIONS: Record<CommunityRole, string> = {
  ADMIN: "Pode moderar conteúdo e também elevar outros membros para admin ou moderador.",
  MODERATOR: "Pode moderar conteúdo e ajustar cargos sem elevar alguém para admin.",
  MEMBER: "Participa normalmente da comunidade, sem poderes extras de moderação.",
};

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default function CommunityManageMemberScreen() {
  const router = useRouter();
  const { speak } = useTTS();
  const params = useLocalSearchParams<{
    communityId?: string | string[];
    communityName?: string | string[];
    userProfileId?: string | string[];
    userName?: string | string[];
    viewerRole?: string | string[];
    returnTab?: string | string[];
  }>();

  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();

  const communityId = useMemo(
    () => normalizeRouteParam(params.communityId).trim(),
    [params.communityId]
  );
  const communityName = useMemo(
    () => normalizeRouteParam(params.communityName).trim(),
    [params.communityName]
  );
  const userProfileId = useMemo(
    () => normalizeRouteParam(params.userProfileId).trim(),
    [params.userProfileId]
  );
  const userName = useMemo(
    () => normalizeRouteParam(params.userName).trim() || "Membro da comunidade",
    [params.userName]
  );
  const access = useCommunityAccess(communityId);
  const viewerRole = communityRole(access.community);
  const { currentUserId, currentUserProfileId } = useAppShell();
  const [target, setTarget] = useState<CommunityMemberResponse | null>(null);
  const [targetLoading, setTargetLoading] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const roleLock = useRef(false);
  useEffect(() => {
    let active = true;
    setTarget(null);
    setTargetError(null);
    setTargetLoading(true);
    const findTarget = async () => {
      try {
        if (!communityId || !userProfileId) throw new Error("Membro não identificado.");
        let page = 0;
        while (active) {
          const result = await communityService.getMembers(communityId, { page, size: 50 });
          const member = result.content.find((item) => item.userProfileId === userProfileId);
          if (member) { if (active) setTarget(member); return; }
          if (!result.hasNext || result.content.length === 0) throw new Error("Essa pessoa não participa mais da comunidade.");
          page += 1;
        }
      } catch (cause) {
        if (active) setTargetError(formatApiErrorMessage(cause, "Não foi possível verificar o cargo atual."));
      } finally { if (active) setTargetLoading(false); }
    };
    if (viewerRole === "ADMIN" || viewerRole === "MODERATOR") void findTarget();
    else setTargetLoading(false);
    return () => { active = false; };
  }, [communityId, userProfileId, viewerRole, retry]);
  const returnTab = useMemo(
    () => normalizeRouteParam(params.returnTab).trim().toLowerCase(),
    [params.returnTab]
  );
  const [pendingRole, setPendingRole] = useState<CommunityRole | null>(null);

  const availableRoles = useMemo(() => {
    if (viewerRole === "ADMIN") {
      return ["MEMBER", "MODERATOR", "ADMIN"] satisfies CommunityRole[];
    }

    if (viewerRole === "MODERATOR") {
      return ["MEMBER", "MODERATOR"] satisfies CommunityRole[];
    }

    return [] satisfies CommunityRole[];
  }, [viewerRole]);

  const canManage =
    !access.loading && !targetLoading && Boolean(target) && availableRoles.length > 0 &&
    !target?.isOwner && !target?.owner && userProfileId !== access.community?.owner?.userProfileId &&
    !(target?.id && target.id === access.community?.owner?.id) &&
    userProfileId !== currentUserProfileId && !(target?.id && target.id === currentUserId) &&
    !(viewerRole === "MODERATOR" && target?.role === "ADMIN");

  const handleBack = useCallback(() => {
    if (communityId) {
      router.replace({
        pathname: "/community/[communityId]",
        params: returnTab === "members" ? { communityId, tab: "members" } : { communityId },
      });
      return;
    }

    router.replace("/community");
  }, [communityId, returnTab, router]);

  const handleSelectRole = useCallback(
    async (role: CommunityRole) => {
      if (!canManage || roleLock.current || !availableRoles.includes(role) || target?.role === role) {
        return;
      }

      // Acao sobre pessoa dinamica: "Tornar Maria Moderador".
      speak(buildActionSpeech(`Tornar ${userName}`, ROLE_LABELS[role]));
      roleLock.current = true;
      setPendingRole(role);

      try {
        const response = await communityService.updateMemberRole(communityId, userProfileId, { role });

        showGlobalToast({
          title: "Cargo atualizado",
          variant: "success",
          message: `${response.user.name} agora é ${ROLE_LABELS[response.role]}.`,
        });
        announceForAccessibility(
          accessibilityAnnouncements.memberRoleUpdated(ROLE_LABELS[response.role])
        );
        handleBack();
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        roleLock.current = false;
        setPendingRole(null);
      }
    },
    [availableRoles, canManage, communityId, handleBack, speak, target?.role, userName, userProfileId]
  );

  return (
    <View className="flex-1 bg-[#09090A]">
      <SafeAreaView className="flex-1 bg-[#09090A]">
        <View className="h-16 flex-row items-center justify-between border-b border-[#2A2A2A] px-6">
          <View className="flex-row items-center">
            <Pressable
              className="mr-3 h-10 w-10 items-center justify-center rounded-full"
              onPress={() => {
                speak("Voltar para a comunidade");
                handleBack();
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar para a comunidade"
              accessibilityHint="Sai da gestão de cargos sem alterar o cargo do membro."
            >
              <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
            </Pressable>
            <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
          </View>

          <Text className="text-[14px] font-bold text-[#CAC3D8]">Cargo do membro</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-10 pt-8"
          showsVerticalScrollIndicator={false}
        >
          <View className="rounded-[28px] bg-[#111214] p-6">
            <Text className="text-[14px] font-bold uppercase tracking-[1.4px] text-[#7C4DFF]">
              Gestão de cargos
            </Text>
            <Text
              ref={headingRef}
              accessibilityRole="header"
              className="mt-4 text-[30px] font-extrabold leading-10 text-white"
            >
              {userName}
            </Text>
            {communityName ? (
              <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                Comunidade: {communityName}
              </Text>
            ) : null}
            <Text className="mt-4 text-[15px] font-semibold leading-7 text-[#E5E2E1]">
              Escolha o novo cargo dessa pessoa dentro da comunidade.
            </Text>
          </View>

          {access.loading || targetLoading ? <ActivityIndicator color="#7C4DFF" /> : access.error || targetError ? (
            <ScreenError message={access.error || targetError || "Não foi possível carregar o membro."} onRetry={() => { void access.reload(); setRetry((value) => value + 1); }} />
          ) : canManage ? (
            <View className="mt-6 gap-4">
              {availableRoles.map((role) => {
                const isPending = pendingRole === role;

                return (
                  <Pressable
                    key={role}
                    className={`rounded-[28px] border px-5 py-5 ${
                      role === "ADMIN"
                        ? "border-[#8A5AFF] bg-[#1F1930]"
                        : role === "MODERATOR"
                          ? "border-[#46708A] bg-[#16232C]"
                          : "border-[#494455] bg-[#151619]"
                    } ${pendingRole ? "opacity-70" : ""}`}
                    onPress={() => {
                      void handleSelectRole(role);
                    }}
                    disabled={Boolean(pendingRole) || target?.role === role}
                    accessibilityRole="button"
                    accessibilityLabel={`Tornar ${userName} ${ROLE_LABELS[role]}`}
                    accessibilityHint="Aplica o novo cargo na hora e volta para a comunidade."
                    accessibilityState={{ disabled: Boolean(pendingRole) || target?.role === role, busy: isPending }}
                  >
                    <View className="flex-row items-start gap-4">
                      <View
                        className={`h-12 w-12 items-center justify-center rounded-full ${
                          role === "ADMIN"
                            ? "bg-[#7C4DFF]"
                            : role === "MODERATOR"
                              ? "bg-[#2F596C]"
                              : "bg-[#2E2B33]"
                        }`}
                      >
                        {isPending ? (
                          <ActivityIndicator color="#FCF6FF" size="small" />
                        ) : (
                          <Ionicons
                            name={
                              role === "ADMIN"
                                ? "shield-checkmark"
                                : role === "MODERATOR"
                                  ? "shield-half"
                                  : "person"
                            }
                            size={22}
                            color="#FCF6FF"
                          />
                        )}
                      </View>

                      <View className="flex-1">
                        <Text className="text-[20px] font-black text-white">
                          {ROLE_LABELS[role]}{target?.role === role ? " (atual)" : ""}
                        </Text>
                        <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                          {ROLE_DESCRIPTIONS[role]}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View className="mt-6 rounded-[28px] border border-[#6A4456] bg-[#2A1C24] px-5 py-5">
              <Text className="text-[20px] font-black text-[#FFD3DD]">
                Gestão indisponível
              </Text>
              <Text className="mt-3 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                Abra esta tela a partir da aba de membros enquanto estiver com papel de moderador
                ou admin. Sem isso, a gestão de cargos permanece bloqueada.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
