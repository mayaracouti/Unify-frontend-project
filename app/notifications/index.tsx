import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildNotificationListEntrySpeech,
  joinSpeechParts,
  useTTS,
} from "../../src/accessibility/tts";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAuth } from "../../src/context/AuthContext";
import { useNotifications } from "../../src/context/NotificationContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { feedService } from "../../src/services/feedService";
import { notificationService } from "../../src/services/notificationService";
import type { NotificationResponse } from "../../src/types/notification";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";
import {
  buildNotificationAccessibilityLabel,
  formatUnreadNotifications,
  notificationActionHint,
  notificationIcon,
} from "../../src/utils/notificationFormatting";
import { openNotificationTarget } from "../../src/utils/notificationNavigation";
import { formatRelativePostDate, getNameInitial } from "../../src/utils/postFormatting";

const PAGE_SIZE = 20;

type ListState = {
  items: NotificationResponse[];
  page: number;
  hasNext: boolean;
  status: "loading" | "ready" | "error";
  error: string;
  refreshing: boolean;
  loadingMore: boolean;
};

const INITIAL_STATE: ListState = {
  items: [],
  page: 0,
  hasNext: false,
  status: "loading",
  error: "",
  refreshing: false,
  loadingMore: false,
};

function mergePage(current: NotificationResponse[], incoming: NotificationResponse[]) {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}

const NotificationRow = memo(function NotificationRow({
  authToken,
  highContrast,
  notification,
  onPress,
  opening,
}: {
  authToken: string | null;
  highContrast: boolean;
  notification: NotificationResponse;
  onPress: (notification: NotificationResponse) => void;
  opening: boolean;
}) {
  const avatarUri = feedService.resolveAssetUrl(notification.actor?.avatarUrl);
  const unread = !notification.read;
  const icon = notificationIcon(notification.type);

  const iconBadge = (
    <View className="h-12 w-12 items-center justify-center rounded-full bg-[#2A2340]">
      <Ionicons name={icon} size={22} color={highContrast ? "#FFFFFF" : "#CDBDFF"} />
    </View>
  );

  return (
    <Pressable
      className={`mb-3 min-h-[72px] flex-row items-start gap-3 rounded-[22px] border px-4 py-3 ${
        highContrast
          ? unread
            ? "border-hc-accent bg-hc-surface"
            : "border-hc-border bg-hc-surface"
          : unread
            ? "border-[#7C4DFF] bg-[#1B1530]"
            : "border-[#2B2D39] bg-[#131521]"
      }`}
      onPress={() => onPress(notification)}
      disabled={opening}
      accessibilityRole="button"
      accessibilityLabel={buildNotificationAccessibilityLabel(notification)}
      accessibilityHint={notificationActionHint(notification.type)}
      accessibilityState={{ busy: opening, disabled: opening }}
    >
      {/* Foto/icone decorativos: quem e o que aconteceu ja estao no rotulo. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {notification.actor ? (
          <View className="relative">
            <View className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#2D2A33]">
              {avatarUri ? (
                <AuthenticatedRemoteImage
                  authToken={authToken}
                  className="h-full w-full"
                  resizeMode="cover"
                  uri={avatarUri}
                  fallback={
                    <View className="flex-1 items-center justify-center">
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} className="text-[18px] font-black text-white">
                        {getNameInitial(notification.actor.name)}
                      </Text>
                    </View>
                  }
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} className="text-[18px] font-black text-white">
                    {getNameInitial(notification.actor.name)}
                  </Text>
                </View>
              )}
            </View>
            <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-[#131521] bg-[#7C4DFF]">
              <Ionicons name={icon} size={12} color="#FFFFFF" />
            </View>
          </View>
        ) : (
          iconBadge
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-start gap-2">
          <Text
            className={`flex-1 text-[16px] font-black ${highContrast ? "text-hc-text" : "text-white"}`}
          >
            {notification.title}
          </Text>
          {unread ? (
            <View
              className={`mt-1.5 h-3 w-3 rounded-full ${highContrast ? "bg-hc-accent" : "bg-[#F1EF00]"}`}
              importantForAccessibility="no"
            />
          ) : null}
        </View>
        <Text
          className={`mt-1 text-[14px] font-semibold leading-5 ${
            highContrast ? "text-hc-text" : "text-[#E5E2E1]"
          }`}
        >
          {notification.body}
        </Text>
        <Text className={`mt-1.5 text-[12px] font-bold ${highContrast ? "text-hc-text" : "text-[#CAC3D8]"}`}>
          {formatRelativePostDate(notification.createdAt)}
        </Text>
      </View>

      {opening ? <ActivityIndicator color="#EAEA00" size="small" /> : null}
    </Pressable>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { settings } = useAccessibility();
  const { speak, speakSequence } = useTTS();
  const { unreadCount, refreshUnreadCount, adjustUnreadCount, pushPermission, enablePush } =
    useNotifications();
  const headingRef = useScreenHeadingFocus<Text>();
  const [state, setState] = useState<ListState>(INITIAL_STATE);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const requestRef = useRef(0);
  const entryAnnouncedRef = useRef(false);
  const highContrast = settings.highContrast;
  const authToken = session?.accessToken ?? null;

  const loadPage = useCallback(
    async (mode: "initial" | "refresh" | "more", page = 0) => {
      const requestId = ++requestRef.current;

      setState((current) => ({
        ...current,
        status: mode === "initial" && current.items.length === 0 ? "loading" : current.status,
        refreshing: mode === "refresh",
        loadingMore: mode === "more",
      }));

      try {
        const response = await notificationService.getPage({ page, size: PAGE_SIZE });

        if (requestId !== requestRef.current) {
          return;
        }

        setState((current) => ({
          items: mode === "more" ? mergePage(current.items, response.content) : response.content,
          page: response.page,
          hasNext: response.hasNext,
          status: "ready",
          error: "",
          refreshing: false,
          loadingMore: false,
        }));

        if (mode !== "more") {
          void refreshUnreadCount();
        }

        // Entrada da tela (rota "self-announcing"): nome, total e as mais novas.
        if (!entryAnnouncedRef.current && mode === "initial") {
          entryAnnouncedRef.current = true;
          const unread = response.content.filter((item) => !item.read).length;
          speakSequence(buildNotificationListEntrySpeech(response.content, unread));
          announceForAccessibility(accessibilityAnnouncements.notificationsEntry(unread));
        }
      } catch (error) {
        if (requestId !== requestRef.current) {
          return;
        }

        setState((current) => ({
          ...current,
          status: current.items.length > 0 ? "ready" : "error",
          error: formatApiErrorMessage(error, "Não foi possível carregar as notificações."),
          refreshing: false,
          loadingMore: false,
        }));
      }
    },
    [refreshUnreadCount, speakSequence]
  );

  // Recarrega ao focar: voltar de um destino mostra o item ja como lido.
  useFocusEffect(
    useCallback(() => {
      void loadPage("initial");
    }, [loadPage])
  );

  const markLocallyAsRead = useCallback((notificationId: string) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    }));
  }, []);

  const handleOpen = useCallback(
    async (notification: NotificationResponse) => {
      speak(joinSpeechParts([notification.title, notification.body]));
      setOpeningId(notification.id);

      try {
        if (!notification.read) {
          markLocallyAsRead(notification.id);
          adjustUnreadCount(-1);
          await notificationService.markAsRead(notification.id).catch(() => undefined);
        }

        const result = await openNotificationTarget(router, {
          type: notification.type,
          referenceId: notification.referenceId,
          contextId: notification.contextId,
          notificationId: notification.id,
          actorName: notification.actor?.name ?? null,
        });

        if (result === "none" && !notification.read) {
          announceForAccessibility(accessibilityAnnouncements.notificationMarkedRead());
          speak(accessibilityAnnouncements.notificationMarkedRead());
        }
      } finally {
        setOpeningId(null);
        void refreshUnreadCount();
      }
    },
    [adjustUnreadCount, markLocallyAsRead, refreshUnreadCount, router, speak]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    speak(buildActionSpeech("Marcar todas como lidas"));
    setMarkingAll(true);

    try {
      await notificationService.markAllAsRead();
      setState((current) => ({
        ...current,
        items: current.items.map((item) => ({ ...item, read: true })),
      }));
      adjustUnreadCount("reset");
      announceForAccessibility(accessibilityAnnouncements.notificationsAllRead());
      speak(accessibilityAnnouncements.notificationsAllRead());
    } catch (error) {
      showGlobalToast({
        variant: "error",
        message: formatApiErrorMessage(error, "Não foi possível marcar as notificações como lidas."),
      });
    } finally {
      setMarkingAll(false);
      void refreshUnreadCount();
    }
  }, [adjustUnreadCount, refreshUnreadCount, speak]);

  const handleEnablePush = useCallback(async () => {
    speak(buildActionSpeech("Ativar notificações no celular"));
    setEnablingPush(true);

    try {
      const enabled = await enablePush();
      const message = enabled
        ? accessibilityAnnouncements.pushEnabled()
        : accessibilityAnnouncements.pushStillDisabled();
      announceForAccessibility(message);
      speak(message);
    } finally {
      setEnablingPush(false);
    }
  }, [enablePush, speak]);

  const hasUnread = unreadCount > 0 || state.items.some((item) => !item.read);
  const showPushCard = pushPermission === "denied" || pushPermission === "undetermined";

  const renderContent = () => {
    if (state.status === "loading") {
      return <ScreenLoading label="Carregando notificações" />;
    }

    if (state.status === "error") {
      return (
        <ScreenError
          title="Não foi possível carregar as notificações"
          message={state.error}
          onRetry={() => {
            void loadPage("initial");
          }}
          retrying={false}
        />
      );
    }

    if (state.items.length === 0) {
      return (
        <ScreenEmpty
          title="Você ainda não tem notificações"
          description="Novos matches, mensagens, seguidores e interações nas suas publicações aparecem aqui."
        />
      );
    }

    return (
      <FlatList
        accessibilityLabel="Lista de notificações, mais recentes primeiro"
        data={state.items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => {
              void loadPage("refresh");
            }}
            tintColor="#EAEA00"
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!state.hasNext || state.loadingMore || state.refreshing) {
            return;
          }

          void loadPage("more", state.page + 1);
        }}
        ListFooterComponent={
          state.loadingMore ? (
            <View className="py-6" accessibilityLabel="Carregando mais notificações">
              <ActivityIndicator color="#EAEA00" size="small" />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <NotificationRow
            authToken={authToken}
            highContrast={highContrast}
            notification={item}
            onPress={(notification) => {
              void handleOpen(notification);
            }}
            opening={openingId === item.id}
          />
        )}
      />
    );
  };

  return (
    <View className={`flex-1 ${highContrast ? "bg-hc-bg" : "bg-[#1F2023]"}`}>
      <SafeAreaView className="flex-1">
        <GlobalTopNav />

        <View className="mx-auto w-full max-w-[720px] flex-1 px-6 pt-6">
          <View className="mb-4 flex-row flex-wrap items-center justify-between gap-3">
            <View className="flex-1">
              <Text
                ref={headingRef}
                accessibilityRole="header"
                className={`text-[28px] font-extrabold ${highContrast ? "text-hc-text" : "text-white"}`}
              >
                Notificações
              </Text>
              <Text
                className={`mt-1 text-[14px] font-bold ${highContrast ? "text-hc-text" : "text-[#CAC3D8]"}`}
                accessibilityLiveRegion="polite"
              >
                {formatUnreadNotifications(unreadCount)}
              </Text>
            </View>

            <Pressable
              className={`min-h-[44px] flex-row items-center gap-2 rounded-full border px-4 ${
                hasUnread
                  ? highContrast
                    ? "border-hc-accent bg-hc-surface"
                    : "border-[#CDBDFF] bg-[#2B2338]"
                  : "border-[#3A3545] bg-transparent opacity-60"
              }`}
              disabled={!hasUnread || markingAll}
              onPress={() => {
                void handleMarkAllAsRead();
              }}
              accessibilityRole="button"
              accessibilityLabel="Marcar todas como lidas"
              accessibilityHint="Zera o contador de notificações não lidas"
              accessibilityState={{ disabled: !hasUnread || markingAll, busy: markingAll }}
            >
              {markingAll ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" importantForAccessibility="no" />
              )}
              <Text className="text-[14px] font-black text-white">Marcar todas como lidas</Text>
            </Pressable>
          </View>

          {showPushCard ? (
            <View
              className={`mb-4 rounded-[22px] border p-4 ${
                highContrast ? "border-hc-border bg-hc-surface" : "border-[#3A3246] bg-[#17181C]"
              }`}
            >
              <Text className={`text-[16px] font-black ${highContrast ? "text-hc-text" : "text-white"}`}>
                Avisos no celular desligados
              </Text>
              <Text
                className={`mt-1 text-[14px] font-semibold leading-5 ${
                  highContrast ? "text-hc-text" : "text-[#CAC3D8]"
                }`}
              >
                Ative para saber de matches, mensagens e seguidores mesmo com o app fechado.
              </Text>
              <Pressable
                className="mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-full bg-[#7C4DFF] px-4"
                disabled={enablingPush}
                onPress={() => {
                  void handleEnablePush();
                }}
                accessibilityRole="button"
                accessibilityLabel="Ativar notificações no celular"
                accessibilityHint={
                  pushPermission === "denied"
                    ? "Pede a permissão de novo ou abre os ajustes do aparelho"
                    : "Mostra o pedido de permissão do sistema"
                }
                accessibilityState={{ busy: enablingPush, disabled: enablingPush }}
              >
                {enablingPush ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="notifications" size={18} color="#FFFFFF" importantForAccessibility="no" />
                )}
                <Text className="text-[15px] font-black text-white">Ativar notificações</Text>
              </Pressable>
            </View>
          ) : null}

          <View className="flex-1">{renderContent()}</View>
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}
