import Ionicons from "@expo/vector-icons/Ionicons";
import { FollowPendingIcon } from "../../src/components/social/follow-pending-icon";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { buildActionSpeech, useTTS } from "../../src/accessibility/tts";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { CancelFollowRequestSheet } from "../../src/components/social/cancel-follow-request-sheet";
import { ActionSheet } from "../../src/components/ui/action-sheet";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAuth } from "../../src/context/AuthContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { feedService } from "../../src/services/feedService";
import { followService } from "../../src/services/followService";
import { isApiError } from "../../src/types/auth";
import type { FollowRequestResponse } from "../../src/types/social";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import {
  FOLLOW_REQUESTS_TABS,
  followRequestRowLabel,
  followRequestsTabAccessibilityLabel,
  mergeFollowRequestPage,
  parseFollowRequestsTab,
  removeFollowRequest,
  restoreFollowRequest,
  type FollowRequestsTab,
} from "../../src/utils/followRequests";
import { showGlobalToast } from "../../src/utils/globalToast";
import { getNameInitial } from "../../src/utils/postFormatting";
import { buildUserProfileHref } from "../../src/utils/userProfileRoute";

const PAGE_SIZE = 20;

type TabState = {
  items: FollowRequestResponse[];
  page: number;
  hasNext: boolean;
  /** Total de pendentes informado pelo backend; `null` antes da primeira carga. */
  total: number | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  loadingMore: boolean;
  refreshing: boolean;
};

const INITIAL_TAB_STATE: TabState = {
  items: [],
  page: 0,
  hasNext: false,
  total: null,
  status: "idle",
  error: "",
  loadingMore: false,
  refreshing: false,
};

const COPY: Record<
  FollowRequestsTab,
  {
    emptyTitle: string;
    emptyDescription: string;
    errorFallback: string;
    listLabel: string;
  }
> = {
  received: {
    emptyTitle: "Nenhum pedido recebido",
    emptyDescription:
      "Quando alguém pedir para seguir você, o pedido aparece aqui para você aceitar ou recusar.",
    errorFallback: "Não foi possível carregar os pedidos recebidos.",
    listLabel: "Pedidos recebidos",
  },
  sent: {
    emptyTitle: "Nenhum pedido enviado",
    emptyDescription:
      "Quando você pedir para seguir alguém que aprova seguidores, o pedido fica aqui até a pessoa responder.",
    errorFallback: "Não foi possível carregar os pedidos enviados.",
    listLabel: "Pedidos enviados",
  },
};

type RowProps = {
  authToken: string | null;
  highContrast: boolean;
  onAccept: (request: FollowRequestResponse) => void;
  onCancel: (request: FollowRequestResponse) => void;
  onDecline: (request: FollowRequestResponse) => void;
  onOpenProfile: (request: FollowRequestResponse) => void;
  request: FollowRequestResponse;
  tab: FollowRequestsTab;
};

function FollowRequestRow({
  authToken,
  highContrast,
  onAccept,
  onCancel,
  onDecline,
  onOpenProfile,
  request,
  tab,
}: RowProps) {
  const { speak } = useTTS();
  const avatarUri = feedService.resolveAssetUrl(request.avatarUrl);
  const name = request.name?.trim() || "Pessoa sem nome";

  const avatarFallback = (
    <LinearGradient
      colors={["#CDBDFF", "#7C4DFF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="h-full w-full items-center justify-center"
    >
      <Text className="text-[16px] font-black text-white">
        {getNameInitial(name)}
      </Text>
    </LinearGradient>
  );

  const secondaryButtonClassName = `min-h-[44px] flex-grow flex-row items-center justify-center rounded-full border px-4 py-2 ${
    highContrast
      ? "border-hc-border bg-transparent"
      : "border-[#494455] bg-[#1A1C1F]"
  }`;

  return (
    <View
      className={`mb-3 rounded-xl p-4 ${
        highContrast ? "border border-hc-border bg-hc-surface" : "bg-[#2A2A2A]"
      }`}
    >
      {/* Foto + nome: um unico botao que abre o perfil publico. */}
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={followRequestRowLabel(request, tab)}
        accessibilityHint="Abre o perfil desta pessoa"
        className="min-h-[48px] flex-row items-center"
        onPress={() => {
          speak(buildActionSpeech("Abrir perfil", name));
          onOpenProfile(request);
        }}
      >
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]">
          {avatarUri ? (
            <AuthenticatedRemoteImage
              authToken={authToken}
              className="h-full w-full"
              fallback={avatarFallback}
              resizeMode="cover"
              uri={avatarUri}
            />
          ) : (
            avatarFallback
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text
            className={`text-[16px] font-black ${highContrast ? "text-hc-text" : "text-white"}`}
          >
            {name}
          </Text>
          <Text
            className={`mt-1 text-[13px] font-semibold ${
              highContrast ? "text-hc-text" : "text-[#CAC3D8]"
            }`}
          >
            {tab === "received" ? "Quer seguir você" : "Aguardando resposta"}
          </Text>
        </View>
      </Pressable>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {tab === "received" ? (
          <>
            <Pressable
              className={`min-h-[44px] flex-grow flex-row items-center justify-center rounded-full px-4 py-2 ${
                highContrast ? "bg-hc-accent" : "bg-[#EAEA00]"
              }`}
              onPress={() => {
                speak(buildActionSpeech("Aceitar pedido de", name));
                onAccept(request);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Aceitar pedido de ${name}`}
              accessibilityHint="Esta pessoa passa a seguir você"
            >
              <Ionicons
                name="checkmark"
                size={18}
                color="#1D1D00"
                importantForAccessibility="no"
              />
              <Text className="ml-2 text-[14px] font-black text-[#1D1D00]">
                Aceitar
              </Text>
            </Pressable>
            <Pressable
              className={secondaryButtonClassName}
              onPress={() => {
                speak(buildActionSpeech("Recusar pedido de", name));
                onDecline(request);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Recusar pedido de ${name}`}
              accessibilityHint="Pede confirmação antes de recusar"
            >
              <Ionicons
                name="close"
                size={18}
                color="#FFFFFF"
                importantForAccessibility="no"
              />
              <Text className="ml-2 text-[14px] font-black text-white">
                Recusar
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View
              accessible
              accessibilityLabel="Aguardando aceite"
              className="min-h-[44px] flex-row items-center rounded-[16px] border border-[#5A5A1E] bg-[#23230F] px-3"
            >
              <FollowPendingIcon size={16} badgeBackground="#23230F" />
              <Text className="ml-2 text-[13px] font-bold text-[#F1EF00]">
                Aguardando aceite
              </Text>
            </View>
            <Pressable
              className={secondaryButtonClassName}
              onPress={() => {
                speak(buildActionSpeech("Cancelar pedido para seguir", name));
                onCancel(request);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Cancelar pedido para seguir ${name}`}
              accessibilityHint="Pede confirmação antes de cancelar"
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color="#FFFFFF"
                importantForAccessibility="no"
              />
              <Text className="ml-2 text-[14px] font-black text-white">
                Cancelar pedido
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Pedidos para seguir (`/profile/follow-requests`): "Recebidos" (aceitar ou
 * recusar) e "Enviados" (cancelar). Cada acao remove o item na hora e o
 * devolve a mesma posicao se a requisicao falhar.
 */
export default function FollowRequestsScreen() {
  const headingRef = useScreenHeadingFocus<Text>();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { speak } = useTTS();
  const { session } = useAuth();
  const authToken = session?.accessToken ?? null;
  const { settings } = useAccessibility();
  const highContrast = settings.highContrast;

  const [activeTab, setActiveTab] = useState<FollowRequestsTab>(() =>
    parseFollowRequestsTab(params.tab),
  );
  const [tabs, setTabs] = useState<Record<FollowRequestsTab, TabState>>({
    received: INITIAL_TAB_STATE,
    sent: INITIAL_TAB_STATE,
  });
  const [declineTarget, setDeclineTarget] =
    useState<FollowRequestResponse | null>(null);
  const [cancelTarget, setCancelTarget] =
    useState<FollowRequestResponse | null>(null);

  // Espelho do estado para ler pagina/flags sem recriar callbacks a cada pagina.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const patchTab = useCallback(
    (
      tab: FollowRequestsTab,
      patch: Partial<TabState> | ((current: TabState) => Partial<TabState>),
    ) => {
      setTabs((previous) => {
        const current = previous[tab];
        const next = typeof patch === "function" ? patch(current) : patch;
        return { ...previous, [tab]: { ...current, ...next } };
      });
    },
    [],
  );

  const loadPage = useCallback(
    async (tab: FollowRequestsTab, mode: "initial" | "refresh" | "more") => {
      const current = tabsRef.current[tab];
      const nextPage = mode === "more" ? current.page + 1 : 0;

      if (mode === "initial") {
        patchTab(tab, { status: "loading", error: "" });
      } else if (mode === "refresh") {
        patchTab(tab, { refreshing: true });
      } else {
        patchTab(tab, { loadingMore: true });
      }

      try {
        const request = { page: nextPage, size: PAGE_SIZE };
        const response =
          tab === "received"
            ? await followService.listFollowRequests(request)
            : await followService.listSentFollowRequests(request);

        if (mode === "more") {
          const knownIds = new Set(
            tabsRef.current[tab].items.map((item) => item.id),
          );
          const appendedCount = response.requests.filter(
            (item) => !knownIds.has(item.id),
          ).length;

          if (appendedCount > 0) {
            announceForAccessibility(
              accessibilityAnnouncements.moreItemsLoaded(
                appendedCount,
                "pedidos",
              ),
            );
          }
        }

        patchTab(tab, (state) => ({
          items:
            mode === "more"
              ? mergeFollowRequestPage(state.items, response.requests)
              : response.requests,
          page: response.page,
          hasNext: response.hasNext,
          total: response.totalElements,
          status: "ready",
          error: "",
        }));
      } catch (error) {
        if (mode === "initial") {
          patchTab(tab, {
            status: "error",
            error: formatApiErrorMessage(error, COPY[tab].errorFallback),
          });
        }
        // Global API error toast already explains the failure.
      } finally {
        patchTab(tab, { loadingMore: false, refreshing: false });
      }
    },
    [patchTab],
  );

  // Cada aba carrega na primeira vez que aparece.
  useEffect(() => {
    if (tabsRef.current[activeTab].status === "idle") {
      void loadPage(activeTab, "initial");
    }
  }, [activeTab, loadPage]);

  /** Remove na hora; devolve a funcao de rollback. */
  const removeOptimistically = useCallback(
    (tab: FollowRequestsTab, request: FollowRequestResponse) => {
      let removedIndex = -1;

      setTabs((previous) => {
        const current = previous[tab];
        const result = removeFollowRequest(current.items, request.id);
        removedIndex = result.index;

        if (!result.removed) {
          return previous;
        }

        return {
          ...previous,
          [tab]: {
            ...current,
            items: result.items,
            total:
              current.total === null ? null : Math.max(0, current.total - 1),
          },
        };
      });

      return () => {
        setTabs((previous) => {
          const current = previous[tab];

          if (current.items.some((item) => item.id === request.id)) {
            return previous;
          }

          return {
            ...previous,
            [tab]: {
              ...current,
              items: restoreFollowRequest(current.items, request, removedIndex),
              total: current.total === null ? null : current.total + 1,
            },
          };
        });
      };
    },
    [],
  );

  const handleAccept = useCallback(
    (request: FollowRequestResponse) => {
      const rollback = removeOptimistically("received", request);

      void (async () => {
        try {
          await followService.acceptFollowRequest(request.id);
          announceForAccessibility(
            accessibilityAnnouncements.followRequestAccepted(request.name),
          );
          showGlobalToast({
            title: "Pedido aceito",
            message: `${request.name} agora segue você.`,
            variant: "success",
          });
        } catch (error) {
          // 404: o pedido ja nao existe (cancelado por quem pediu) — a lista
          // so estava desatualizada, entao o item continua fora.
          if (!isApiError(error) || error.status !== 404) {
            rollback();
          }
          // Global API error toast already explains the failure.
        }
      })();
    },
    [removeOptimistically],
  );

  const deleteRequest = useCallback(
    (tab: FollowRequestsTab, request: FollowRequestResponse) => {
      const rollback = removeOptimistically(tab, request);

      void (async () => {
        try {
          await followService.deleteFollowRequest(request.id);
          announceForAccessibility(
            tab === "received"
              ? accessibilityAnnouncements.followRequestDeclined()
              : accessibilityAnnouncements.followRequestCanceled(),
          );
        } catch (error) {
          if (!isApiError(error) || error.status !== 404) {
            rollback();
          }
          // Global API error toast already explains the failure.
        }
      })();
    },
    [removeOptimistically],
  );

  const handleOpenProfile = useCallback(
    (request: FollowRequestResponse) => {
      router.push(buildUserProfileHref(request.userProfileId, request.name));
    },
    [router],
  );

  const current = tabs[activeTab];
  const copy = COPY[activeTab];

  const renderContent = () => {
    if (current.status === "idle" || current.status === "loading") {
      return (
        <ScreenLoading label={`Carregando ${copy.listLabel.toLowerCase()}`} />
      );
    }

    if (current.status === "error") {
      return (
        <ScreenError
          message={current.error || copy.errorFallback}
          title="Não foi possível carregar os pedidos"
          onRetry={() => {
            void loadPage(activeTab, "initial");
          }}
          retrying={false}
        />
      );
    }

    if (current.items.length === 0) {
      return (
        <ScreenEmpty
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      );
    }

    return (
      <FlatList
        accessibilityLabel={copy.listLabel}
        accessibilityHint="Role para ver mais pedidos"
        data={current.items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl
            refreshing={current.refreshing}
            onRefresh={() => {
              void loadPage(activeTab, "refresh");
            }}
            tintColor="#EAEA00"
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!current.hasNext || current.loadingMore || current.refreshing) {
            return;
          }

          void loadPage(activeTab, "more");
        }}
        ListFooterComponent={
          current.loadingMore ? (
            <View
              className="py-6"
              accessibilityLabel="Carregando mais pedidos"
              accessibilityHint="Aguarde, a próxima página de pedidos está chegando"
            >
              <ActivityIndicator color="#EAEA00" size="small" />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <FollowRequestRow
            authToken={authToken}
            highContrast={highContrast}
            onAccept={handleAccept}
            onCancel={setCancelTarget}
            onDecline={setDeclineTarget}
            onOpenProfile={handleOpenProfile}
            request={item}
            tab={activeTab}
          />
        )}
      />
    );
  };

  return (
    <View className={`flex-1 ${highContrast ? "bg-hc-bg" : "bg-[#1F2023]"}`}>
      <SafeAreaView className="flex-1">
        <GlobalTopNav
          backRoute="/profile"
          backLabel="Voltar para o seu perfil"
          showMenu={false}
        />

        <View className="mx-auto w-full max-w-[720px] flex-1 px-6 pt-6">
          <Text
            ref={headingRef}
            accessibilityRole="header"
            className={`text-[28px] font-extrabold ${highContrast ? "text-hc-text" : "text-white"}`}
          >
            Pedidos para seguir
          </Text>
          <Text
            className={`mt-2 text-[15px] font-semibold leading-6 ${
              highContrast ? "text-hc-text" : "text-[#CAC3D8]"
            }`}
          >
            Aceite ou recuse quem quer seguir você e acompanhe os pedidos que
            você enviou.
          </Text>

          <View
            accessibilityRole="tablist"
            accessibilityLabel="Tipo de pedido"
            accessibilityHint="Escolha entre pedidos recebidos e enviados"
            className={`mb-5 mt-5 flex-row gap-2 rounded-2xl p-1 ${
              highContrast
                ? "border border-hc-border bg-hc-surface"
                : "bg-[#17181C]"
            }`}
          >
            {FOLLOW_REQUESTS_TABS.map((tab) => {
              const selected = activeTab === tab.key;
              const total = tabs[tab.key].total;

              return (
                <Pressable
                  key={tab.key}
                  className={`min-h-[44px] flex-1 flex-row items-center justify-center rounded-xl px-3 py-2 ${
                    selected
                      ? highContrast
                        ? "bg-hc-accent"
                        : "bg-[#7C4DFF]"
                      : "bg-transparent"
                  }`}
                  accessibilityRole="tab"
                  accessibilityLabel={followRequestsTabAccessibilityLabel(
                    tab.label,
                    total,
                  )}
                  accessibilityHint={tab.hint}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    speak(tab.label);
                    setActiveTab(tab.key);
                  }}
                >
                  <Text
                    className={`text-center text-[15px] font-black ${
                      selected
                        ? highContrast
                          ? "text-[#1D1D00]"
                          : "text-[#FCF6FF]"
                        : highContrast
                          ? "text-hc-text"
                          : "text-[#CAC3D8]"
                    }`}
                  >
                    {total !== null && total > 0
                      ? `${tab.label} (${total})`
                      : tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-1">{renderContent()}</View>
        </View>
      </SafeAreaView>

      <ActionSheet
        message={
          declineTarget
            ? `${declineTarget.name} não passa a seguir você. A pessoa não é avisada da recusa.`
            : undefined
        }
        onClose={() => setDeclineTarget(null)}
        options={[
          {
            key: "confirm-decline-follow-request",
            label: "Recusar pedido",
            hint: "Remove o pedido agora",
            icon: "close-circle-outline",
            destructive: true,
            onPress: () => {
              const target = declineTarget;
              setDeclineTarget(null);

              if (target) {
                deleteRequest("received", target);
              }
            },
          },
        ]}
        title={
          declineTarget
            ? `Recusar pedido de ${declineTarget.name}?`
            : "Recusar pedido?"
        }
        visible={Boolean(declineTarget)}
      />

      <CancelFollowRequestSheet
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          const target = cancelTarget;
          setCancelTarget(null);

          if (target) {
            deleteRequest("sent", target);
          }
        }}
        targetName={cancelTarget?.name ?? null}
      />
    </View>
  );
}
