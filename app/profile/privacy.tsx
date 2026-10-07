import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildOptionToggleSpeech,
  buildSwitchSpeech,
  speak,
} from "../../src/accessibility/tts";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { ActionSheet } from "../../src/components/ui/action-sheet";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { followService } from "../../src/services/followService";
import { privacyService } from "../../src/services/privacyService";
import { isApiError } from "../../src/types/auth";
import {
  PROFILE_FIELD_OPTIONS,
  PROFILE_FIELD_VISIBILITY_OPTIONS,
  type FeedVisibility,
  type ProfileField,
  type ProfileFieldVisibility,
  type UserBlockResponse,
  type UserPrivacySettingsResponse,
  type UserPrivacySettingsUpdateRequest,
} from "../../src/types/privacy";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";
import {
  buildProfileFieldRowLabel,
  buildUniformProfileFieldVisibility,
  normalizePrivacySettings,
  profileFieldLabel,
  profileFieldVisibilityLabel,
} from "../../src/utils/profileFieldVisibility";

/** Alvo da folha de modos: uma parte do perfil ou todas de uma vez. */
type VisibilitySheetTarget = ProfileField | "ALL";

type ToggleKey = "discoverable" | "showDistance" | "showAge";

/** Conta privada = aprovar quem quer me seguir (`followApprovalRequired`). */
const PRIVATE_ACCOUNT_LABEL = "Conta privada (aprovar quem quer me seguir)";
const PRIVATE_ACCOUNT_DESCRIPTION =
  "Quando ativada, só quem você aceitar como seguidor vê seu perfil completo e suas publicações. As outras pessoas veem apenas seu nome, sua foto e o botão para pedir para seguir.";
const PRIVATE_ACCOUNT_FEED_NOTE = "Com a conta privada, só seguidores veem suas publicações.";

const TOGGLES: {
  key: ToggleKey;
  label: string;
  description: string;
  /** Consequencia lida pelo leitor de tela (o `description` fica visivel). */
  hint: string;
}[] = [
  {
    key: "discoverable",
    label: "Aparecer no Encontros",
    description:
      "Quando desativado, seu perfil deixa de ser mostrado para outras pessoas na descoberta. Matches e conversas que já existem continuam.",
    hint: "Ao desativar, seu perfil sai da descoberta de novas pessoas",
  },
  {
    key: "showDistance",
    label: "Mostrar minha distância",
    description:
      "Quando desativado, outras pessoas não veem a que distância você está.",
    hint: "Ao desativar, sua distância deixa de aparecer no seu perfil para outras pessoas",
  },
  {
    key: "showAge",
    label: "Mostrar minha idade",
    description: "Quando desativado, sua idade não aparece no seu perfil para outras pessoas.",
    hint: "Ao desativar, sua idade deixa de aparecer no seu perfil para outras pessoas",
  },
];

const FEED_VISIBILITY_OPTIONS: { value: FeedVisibility; label: string; hint: string }[] = [
  {
    value: "PUBLIC",
    label: "Todo mundo",
    hint: "Qualquer pessoa pode ver suas publicações pessoais",
  },
  {
    value: "FOLLOWERS_ONLY",
    label: "Só quem me segue",
    hint: "Só seus seguidores veem suas publicações pessoais",
  },
];

/**
 * Privacidade e bloqueios (`/profile/privacy`): conta privada, descoberta,
 * distancia, idade, quem ve as publicacoes pessoais, quem ve cada parte do
 * perfil e a lista de pessoas bloqueadas. Os pedidos para seguir ficam no
 * Perfil e no menu (nao aqui).
 *
 * Cada alteracao salva na hora (PUT parcial) com atualizacao otimista: se a
 * requisicao falhar, a opcao volta ao valor anterior e o erro e anunciado.
 */
export default function PrivacySettingsScreen() {
  const headingRef = useScreenHeadingFocus<Text>();
  const { settings: accessibilitySettings } = useAccessibility();
  const highContrast = accessibilitySettings.highContrast;

  const [settings, setSettings] = useState<UserPrivacySettingsResponse | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<UserBlockResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [unblockTarget, setUnblockTarget] = useState<UserBlockResponse | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [visibilitySheetTarget, setVisibilitySheetTarget] =
    useState<VisibilitySheetTarget | null>(null);
  /** Pedidos recebidos pendentes; `null` enquanto carrega ou se a contagem falhar. */
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number | null>(null);
  const [approvalOffConfirmVisible, setApprovalOffConfirmVisible] = useState(false);

  const loadPendingRequestsCount = useCallback(async () => {
    try {
      // Silencioso: a contagem e um extra; sem ela o switch salva direto.
      const response = await followService.listFollowRequests({ page: 0, size: 1, silent: true });
      setPendingRequestsCount(response.totalElements);
    } catch {
      setPendingRequestsCount(null);
    }
  }, []);

  // Recarrega ao voltar da tela de pedidos (aceitou/recusou por la).
  useFocusEffect(
    useCallback(() => {
      void loadPendingRequestsCount();
    }, [loadPendingRequestsCount])
  );

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [settingsResponse, blockedResponse] = await Promise.all([
        privacyService.getSettings(),
        privacyService.listBlockedUsers(),
      ]);

      setSettings(normalizePrivacySettings(settingsResponse));
      setBlockedUsers(blockedResponse);
      setLoadError("");
    } catch (error) {
      setLoadError(
        formatApiErrorMessage(
          error,
          "Não foi possível carregar suas configurações de privacidade."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function updateSettings(
    patch: UserPrivacySettingsUpdateRequest,
    successAnnouncement: string
  ): Promise<boolean> {
    if (!settings || saving) {
      return false;
    }

    const previous = settings;
    // Otimista: o mapa de visibilidade e mesclado (o PUT tambem e parcial nele).
    setSettings({
      ...settings,
      ...patch,
      profileFieldVisibility: {
        ...settings.profileFieldVisibility,
        ...patch.profileFieldVisibility,
      },
    });
    setSaving(true);

    try {
      const updated = await privacyService.saveSettings(patch);
      setSettings(normalizePrivacySettings(updated));
      announceForAccessibility(successAnnouncement);
      return true;
    } catch {
      setSettings(previous);
      announceForAccessibility(accessibilityAnnouncements.privacySettingFailed());
      // Global API error toast already explains the failure.
      return false;
    } finally {
      setSaving(false);
    }
  }

  function applyProfileFieldVisibility(
    target: VisibilitySheetTarget,
    visibility: ProfileFieldVisibility
  ) {
    setVisibilitySheetTarget(null);

    if (!settings) {
      return;
    }

    const visibilityLabel = profileFieldVisibilityLabel(visibility);
    speak(buildOptionToggleSpeech(visibilityLabel, true));

    if (target === "ALL") {
      void updateSettings(
        { profileFieldVisibility: buildUniformProfileFieldVisibility(visibility) },
        accessibilityAnnouncements.allProfileFieldsVisibilitySaved(visibilityLabel)
      );
      return;
    }

    if (settings.profileFieldVisibility[target] === visibility) {
      return;
    }

    void updateSettings(
      { profileFieldVisibility: { [target]: visibility } },
      accessibilityAnnouncements.profileFieldVisibilitySaved(
        profileFieldLabel(target),
        visibilityLabel
      )
    );
  }

  function handleFollowApprovalChange(next: boolean) {
    // Desligar com pedidos pendentes aceita todos eles: confirma antes.
    if (!next && (pendingRequestsCount ?? 0) > 0) {
      speak(buildActionSpeech("Desativar", "conta privada"));
      setApprovalOffConfirmVisible(true);
      return;
    }

    speak(buildSwitchSpeech(PRIVATE_ACCOUNT_LABEL, next));
    void updateSettings(
      { followApprovalRequired: next },
      accessibilityAnnouncements.privateAccountSaved(next)
    );
  }

  async function confirmFollowApprovalOff() {
    setApprovalOffConfirmVisible(false);
    speak(buildSwitchSpeech(PRIVATE_ACCOUNT_LABEL, false));

    const acceptedCount = pendingRequestsCount ?? 0;
    const saved = await updateSettings(
      { followApprovalRequired: false },
      accessibilityAnnouncements.followApprovalDisabled(acceptedCount)
    );

    if (saved) {
      // O backend aceitou todos os pendentes.
      setPendingRequestsCount(0);
    }
  }

  const visibilitySheetCurrent =
    visibilitySheetTarget && visibilitySheetTarget !== "ALL" && settings
      ? settings.profileFieldVisibility[visibilitySheetTarget]
      : null;

  async function handleUnblock(user: UserBlockResponse) {
    setUnblockTarget(null);
    setUnblockingId(user.userProfileId);

    try {
      await privacyService.unblockUser(user.userProfileId);
    } catch (error) {
      // 404: ja nao estava bloqueado — a lista so estava desatualizada.
      if (!isApiError(error) || error.status !== 404) {
        setUnblockingId(null);
        // Global API error toast already explains the failure.
        return;
      }
    }

    setBlockedUsers((current) =>
      current.filter((item) => item.userProfileId !== user.userProfileId)
    );
    setUnblockingId(null);
    showGlobalToast({
      title: "Usuário desbloqueado",
      message: `Você desbloqueou ${user.name}.`,
      variant: "success",
    });
    announceForAccessibility(accessibilityAnnouncements.userUnblocked(user.name));
  }

  const cardClassName = `mb-4 rounded-[22px] border p-5 ${
    highContrast ? "border-hc-border bg-hc-surface" : "border-[#3A3246] bg-[#17181C]"
  }`;
  const titleClassName = `text-[17px] font-black ${highContrast ? "text-hc-text" : "text-white"}`;
  const descriptionClassName = `mt-2 text-[14px] font-semibold leading-6 ${
    highContrast ? "text-hc-text" : "text-[#CAC3D8]"
  }`;

  const renderBody = () => {
    if (loading) {
      return <ScreenLoading label="Carregando suas configurações de privacidade" />;
    }

    if (loadError || !settings) {
      return (
        <ScreenError
          message={loadError || "Não foi possível carregar suas configurações de privacidade."}
          title="Não foi possível abrir a privacidade"
          onRetry={() => {
            void loadData();
          }}
          retrying={loading}
        />
      );
    }

    return (
      <>
        {/* Estado de salvamento anunciado ao leitor de tela. */}
        <View accessibilityLiveRegion="polite" className="mb-2 min-h-[20px]">
          {saving ? (
            <Text
              className={`text-[13px] font-bold ${
                highContrast ? "text-hc-accent" : "text-[#F2F500]"
              }`}
            >
              Salvando...
            </Text>
          ) : null}
        </View>

        {/* Conta privada vem primeiro: e a escolha que mais muda o que os
            outros veem (perfil travado e posts so para seguidores). */}
        <View className={`${cardClassName} flex-row items-center`}>
          <View className="mr-4 flex-1">
            <Text className={titleClassName}>{PRIVATE_ACCOUNT_LABEL}</Text>
            <Text className={descriptionClassName}>{PRIVATE_ACCOUNT_DESCRIPTION}</Text>
          </View>
          <Switch
            value={settings.followApprovalRequired}
            disabled={saving}
            onValueChange={handleFollowApprovalChange}
            trackColor={{ false: "#5F6068", true: "#F2F500" }}
            thumbColor="#FFFFFF"
            accessibilityRole="switch"
            accessibilityLabel={PRIVATE_ACCOUNT_LABEL}
            accessibilityHint={PRIVATE_ACCOUNT_DESCRIPTION}
            accessibilityState={{ checked: settings.followApprovalRequired, disabled: saving }}
          />
        </View>

        {TOGGLES.map((toggle) => {
          const value = settings[toggle.key];

          return (
            <View key={toggle.key} className={`${cardClassName} flex-row items-center`}>
              <View className="mr-4 flex-1">
                <Text className={titleClassName}>{toggle.label}</Text>
                <Text className={descriptionClassName}>{toggle.description}</Text>
              </View>
              <Switch
                value={value}
                disabled={saving}
                onValueChange={(next) => {
                  speak(buildSwitchSpeech(toggle.label, next));
                  void updateSettings(
                    { [toggle.key]: next },
                    accessibilityAnnouncements.privacySettingSaved(toggle.label, next)
                  );
                }}
                trackColor={{ false: "#5F6068", true: "#F2F500" }}
                thumbColor="#FFFFFF"
                accessibilityRole="switch"
                accessibilityLabel={toggle.label}
                accessibilityHint={toggle.hint}
                accessibilityState={{ checked: value, disabled: saving }}
              />
            </View>
          );
        })}

        <View className={cardClassName}>
          <Text accessibilityRole="header" className={titleClassName}>
            Quem pode ver meus posts
          </Text>
          <Text className={descriptionClassName}>
            Vale para as suas publicações pessoais no Início e no seu perfil. Publicações em
            comunidades seguem as regras de cada comunidade.
          </Text>
          {/* Com a conta privada, "Todo mundo" nao alcanca quem nao segue. */}
          {settings.followApprovalRequired ? (
            <View className="mt-3 flex-row items-start">
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={highContrast ? "#FFD400" : "#F2F500"}
                importantForAccessibility="no"
                style={{ marginTop: 3 }}
              />
              <Text
                className={`ml-2 flex-1 text-[14px] font-bold leading-6 ${
                  highContrast ? "text-hc-accent" : "text-[#F2F500]"
                }`}
              >
                {PRIVATE_ACCOUNT_FEED_NOTE}
              </Text>
            </View>
          ) : null}

          <View
            className="mt-4 flex-row flex-wrap gap-3"
            accessibilityRole="radiogroup"
            accessibilityLabel="Quem pode ver meus posts"
          >
            {FEED_VISIBILITY_OPTIONS.map((option) => {
              const selected = settings.feedVisibility === option.value;

              return (
                <Pressable
                  key={option.value}
                  className={`min-h-[48px] flex-grow items-center justify-center rounded-full border-2 px-5 py-3 ${
                    selected
                      ? highContrast
                        ? "border-hc-accent bg-hc-accent"
                        : "border-[#EAEA00] bg-[#EAEA00]"
                      : highContrast
                        ? "border-hc-border bg-transparent"
                        : "border-[#494455] bg-transparent"
                  }`}
                  disabled={saving}
                  onPress={() => {
                    speak(buildOptionToggleSpeech(option.label, true));

                    if (selected) {
                      return;
                    }

                    void updateSettings(
                      { feedVisibility: option.value },
                      accessibilityAnnouncements.feedVisibilitySaved(option.label)
                    );
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.hint}
                  accessibilityState={{ checked: selected, selected, disabled: saving }}
                >
                  <Text
                    className={`text-center text-[15px] font-bold ${
                      selected ? "text-[#323200]" : highContrast ? "text-hc-text" : "text-white"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className={cardClassName}>
          <Text accessibilityRole="header" className={titleClassName}>
            Quem vê cada parte do meu perfil
          </Text>
          <Text className={descriptionClassName}>
            Escolha quem vê cada informação do seu perfil, inclusive no Encontros. Você sempre vê
            tudo no seu próprio perfil.
          </Text>

          <View className="mt-4" accessibilityRole="list" accessibilityLabel="Partes do perfil">
            {PROFILE_FIELD_OPTIONS.map(({ field, label }) => {
              const visibility = settings.profileFieldVisibility[field];
              const visibilityLabel = profileFieldVisibilityLabel(visibility);
              const restricted = visibility !== "PUBLIC";

              return (
                <Pressable
                  key={field}
                  className={`mb-2 min-h-[44px] flex-row items-center rounded-2xl border px-4 py-3 ${
                    highContrast ? "border-hc-border bg-transparent" : "border-[#353534] bg-[#111214]"
                  }`}
                  disabled={saving}
                  onPress={() => {
                    speak(buildActionSpeech("Quem vê", label));
                    setVisibilitySheetTarget(field);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={buildProfileFieldRowLabel(field, visibility)}
                  accessibilityHint="Abre as opções de quem pode ver esta parte do seu perfil. A escolha é salva na hora"
                  accessibilityState={{ disabled: saving }}
                >
                  <View className="mr-3 flex-1">
                    <Text
                      className={`text-[16px] font-bold ${
                        highContrast ? "text-hc-text" : "text-white"
                      }`}
                    >
                      {label}
                    </Text>
                    <Text
                      className={`mt-1 text-[14px] font-semibold ${
                        restricted
                          ? highContrast
                            ? "text-hc-accent"
                            : "text-[#F2F500]"
                          : highContrast
                            ? "text-hc-text"
                            : "text-[#CAC3D8]"
                      }`}
                    >
                      {visibilityLabel}
                    </Text>
                  </View>
                  <Ionicons
                    name={restricted ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={highContrast ? "#FFD400" : "#CAC3D8"}
                    importantForAccessibility="no"
                  />
                </Pressable>
              );
            })}
          </View>

          <Pressable
            className={`mt-2 min-h-[48px] flex-row items-center justify-center rounded-full border-2 px-5 py-3 ${
              highContrast ? "border-hc-accent" : "border-[#EAEA00]"
            }`}
            disabled={saving}
            onPress={() => {
              speak(buildActionSpeech("Aplicar a todas as partes"));
              setVisibilitySheetTarget("ALL");
            }}
            accessibilityRole="button"
            accessibilityLabel="Aplicar a todas as partes"
            accessibilityHint="Escolhe um modo e aplica a todas as partes do seu perfil de uma vez"
            accessibilityState={{ disabled: saving }}
          >
            <Ionicons
              name="layers-outline"
              size={18}
              color={highContrast ? "#FFD400" : "#EAEA00"}
              importantForAccessibility="no"
            />
            <Text
              className={`ml-2 flex-shrink text-center text-[15px] font-bold ${
                highContrast ? "text-hc-text" : "text-white"
              }`}
            >
              Aplicar a todas as partes
            </Text>
          </Pressable>
        </View>

        <View className="mt-6">
          <Text
            accessibilityRole="header"
            className={`mb-2 text-[20px] font-black ${highContrast ? "text-hc-text" : "text-white"}`}
          >
            Pessoas bloqueadas
          </Text>
          <Text className={`mb-4 ${descriptionClassName}`}>
            Quem está aqui não vê seu perfil nem suas publicações e não pode enviar mensagens para
            você.
          </Text>

          {blockedUsers.length === 0 ? (
            <Text
              className={`text-[14px] font-semibold ${
                highContrast ? "text-hc-text" : "text-[#CAC3D8]"
              }`}
            >
              Você não bloqueou ninguém até agora.
            </Text>
          ) : (
            <View accessibilityRole="list" accessibilityLabel="Pessoas bloqueadas">
              {blockedUsers.map((user) => {
                const unblocking = unblockingId === user.userProfileId;

                return (
                  <View
                    key={user.userProfileId}
                    className={`mb-3 flex-row items-center rounded-2xl border p-4 ${
                      highContrast ? "border-hc-border bg-hc-surface" : "border-[#353534] bg-[#111214]"
                    }`}
                  >
                    <Text
                      className={`mr-3 flex-1 text-[16px] font-bold ${
                        highContrast ? "text-hc-text" : "text-white"
                      }`}
                    >
                      {user.name}
                    </Text>
                    <Pressable
                      className="min-h-[44px] min-w-[44px] flex-row items-center justify-center rounded-full border border-[#494455] bg-[#1A1C1F] px-4 py-2"
                      onPress={() => {
                        speak(buildActionSpeech("Desbloquear", user.name));
                        setUnblockTarget(user);
                      }}
                      disabled={unblocking}
                      accessibilityRole="button"
                      accessibilityLabel={`Desbloquear ${user.name}`}
                      accessibilityHint="Pede confirmação antes de desbloquear"
                      accessibilityState={{ busy: unblocking, disabled: unblocking }}
                    >
                      {unblocking ? (
                        <ActivityIndicator color="#EAEA00" size="small" />
                      ) : (
                        <Text className="text-[14px] font-bold text-white">Desbloquear</Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </>
    );
  };

  return (
    <View className={highContrast ? "flex-1 bg-hc-bg" : "flex-1 bg-[#151515]"}>
      <SafeAreaView className="flex-1">
        <GlobalTopNav
          backRoute="/profile"
          backLabel="Voltar para o seu perfil"
          showMenu={false}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-10 pt-6"
        >
          <View className="mb-4 flex-row items-center">
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={highContrast ? "#FFD400" : "#D6C5FF"}
              importantForAccessibility="no"
            />
            <Text
              ref={headingRef}
              accessibilityRole="header"
              className={`ml-3 flex-1 text-[24px] font-black ${
                highContrast ? "text-hc-text" : "text-white"
              }`}
            >
              Privacidade e bloqueios
            </Text>
          </View>

          <Text
            className={`mb-4 text-[14px] font-semibold leading-6 ${
              highContrast ? "text-hc-text" : "text-[#B9BAC4]"
            }`}
          >
            Escolha o que outras pessoas veem sobre você e gerencie quem você bloqueou. As
            alterações são salvas automaticamente.
          </Text>

          {renderBody()}
        </ScrollView>

        <GlobalBottomNav />
      </SafeAreaView>

      <ActionSheet
        message={
          pendingRequestsCount && pendingRequestsCount > 0
            ? `${
                pendingRequestsCount === 1
                  ? "O pedido pendente será aceito"
                  : `Os ${pendingRequestsCount} pedidos pendentes serão aceitos`
              } e essas pessoas passam a te seguir. Depois, qualquer pessoa pode te seguir sem pedir.`
            : undefined
        }
        onClose={() => setApprovalOffConfirmVisible(false)}
        options={[
          {
            key: "confirm-follow-approval-off",
            label: "Desativar e aceitar pedidos",
            hint: "Desativa a conta privada e aceita todos os pedidos pendentes",
            icon: "people-outline",
            onPress: () => {
              void confirmFollowApprovalOff();
            },
          },
        ]}
        title="Desativar a conta privada?"
        visible={approvalOffConfirmVisible}
      />

      <ActionSheet
        message={
          unblockTarget
            ? `${unblockTarget.name} voltará a poder ver seu perfil e suas publicações e enviar mensagens. Vocês não voltam a se seguir automaticamente.`
            : undefined
        }
        onClose={() => setUnblockTarget(null)}
        options={[
          {
            key: "confirm-unblock",
            label: unblockTarget ? `Desbloquear ${unblockTarget.name}` : "Desbloquear",
            hint: "Remove o bloqueio agora",
            icon: "lock-open-outline",
            onPress: () => {
              if (unblockTarget) {
                void handleUnblock(unblockTarget);
              }
            },
          },
        ]}
        title="Desbloquear usuário?"
        visible={Boolean(unblockTarget)}
      />

      <ActionSheet
        message={
          visibilitySheetTarget === "ALL"
            ? "O modo escolhido vale para todas as partes do seu perfil. Depois dá para ajustar cada uma."
            : "Você sempre vê tudo no seu próprio perfil."
        }
        onClose={() => setVisibilitySheetTarget(null)}
        options={PROFILE_FIELD_VISIBILITY_OPTIONS.map((option) => {
          const selected =
            visibilitySheetCurrent !== null ? visibilitySheetCurrent === option.value : undefined;

          return {
            key: option.value,
            label: option.label,
            description: option.description,
            hint: selected ? `Opção atual. ${option.description}` : option.description,
            selected,
            onPress: () => {
              if (visibilitySheetTarget) {
                applyProfileFieldVisibility(visibilitySheetTarget, option.value);
              }
            },
          };
        })}
        title={
          visibilitySheetTarget === "ALL"
            ? "Quem vê todas as partes do perfil?"
            : visibilitySheetTarget
              ? `Quem vê ${profileFieldLabel(visibilitySheetTarget)}?`
              : "Quem vê esta parte?"
        }
        visible={Boolean(visibilitySheetTarget)}
      />
    </View>
  );
}
