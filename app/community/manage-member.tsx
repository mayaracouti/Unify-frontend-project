import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { communityService } from "../../src/services/communityService";
import type { CommunityRole } from "../../src/types/community";
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

function normalizeRole(value?: string | string[]): CommunityRole | null {
  const normalizedValue = normalizeRouteParam(value).trim().toUpperCase();

  if (normalizedValue === "ADMIN" || normalizedValue === "MODERATOR" || normalizedValue === "MEMBER") {
    return normalizedValue;
  }

  return null;
}

export default function CommunityManageMemberScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    communityId?: string | string[];
    communityName?: string | string[];
    userProfileId?: string | string[];
    userName?: string | string[];
    viewerRole?: string | string[];
    returnTab?: string | string[];
  }>();

  useRequireCompletedOnboarding();

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
  const viewerRole = useMemo(() => normalizeRole(params.viewerRole), [params.viewerRole]);
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
    communityId.length > 0 && userProfileId.length > 0 && availableRoles.length > 0;

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
      if (!canManage || pendingRole) {
        return;
      }

      setPendingRole(role);

      try {
        const response = await communityService.updateMemberRole(communityId, userProfileId, { role });

        showGlobalToast({
          title: "Cargo atualizado",
          variant: "success",
          message: `${response.user.name} agora é ${ROLE_LABELS[response.role]}.`,
        });
        handleBack();
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        setPendingRole(null);
      }
    },
    [canManage, communityId, handleBack, pendingRole, userProfileId]
  );

  return (
    <View className="flex-1 bg-[#09090A]">
      <SafeAreaView className="flex-1 bg-[#09090A]">
        <View className="h-16 flex-row items-center justify-between border-b border-[#2A2A2A] px-6">
          <View className="flex-row items-center">
            <Pressable
              className="mr-3 h-10 w-10 items-center justify-center rounded-full"
              onPress={handleBack}
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
            <Text className="mt-4 text-[30px] font-extrabold leading-10 text-white">
              {userName}
            </Text>
            {communityName ? (
              <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                Comunidade: {communityName}
              </Text>
            ) : null}
            <Text className="mt-4 text-[15px] font-semibold leading-7 text-[#E5E2E1]">
              Escolha o novo cargo dessa pessoa dentro da comunidade. O backend continua
              validando as regras de owner, autoalteração e limites de moderação.
            </Text>
          </View>

          {canManage ? (
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
                    disabled={Boolean(pendingRole)}
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
                          {ROLE_LABELS[role]}
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
