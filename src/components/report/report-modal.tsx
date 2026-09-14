import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useAccessibility } from "../../context/AccessibilityContext";
import { userReportService } from "../../services/userReportService";
import { isApiError } from "../../types/auth";
import type { ReportReason, ReportReasonOptionResponse } from "../../types/report";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../utils/auth";
import { showGlobalToast } from "../../utils/globalToast";

const DESCRIPTION_MAX_LENGTH = 2000;

export type ReportModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Id do `User` denunciado (não o id do perfil). */
  reportedUserId: string;
  reportedPostId?: string | null;
  /** Ex.: "perfil de Marina Souza" ou "publicação de João". */
  contextLabel: string;
};

/**
 * Modal de denúncia reutilizável (perfil no discovery, post de comunidade).
 *
 * Canal de confirmação: `announceForAccessibility` (leitor de tela do
 * sistema) + toast visual. Não chama `useTTS().speak()` na mesma ação para
 * não duplicar o anúncio (ver src/utils/accessibilityAnnouncements.ts).
 */
export function ReportModal({
  visible,
  onClose,
  reportedUserId,
  reportedPostId = null,
  contextLabel,
}: ReportModalProps) {
  const { settings } = useAccessibility();
  const reduceMotion = settings.reduceMotion;
  const highContrast = settings.highContrast;

  const [reasons, setReasons] = useState<ReportReasonOptionResponse[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [reasonsError, setReasonsError] = useState("");
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReasons = useCallback(async () => {
    setLoadingReasons(true);
    setReasonsError("");

    try {
      const response = await userReportService.listReasons();
      setReasons(response);
    } catch (error) {
      setReasonsError(
        formatApiErrorMessage(error, "Não foi possível carregar os motivos de denúncia.")
      );
    } finally {
      setLoadingReasons(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setSelectedReason(null);
    setDescription("");
    void loadReasons();
  }, [loadReasons, visible]);

  const canSubmit = Boolean(selectedReason) && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!selectedReason || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await userReportService.createReport({
        reportedUserId,
        reportedPostId,
        reason: selectedReason,
        description: description.trim() ? description.trim() : null,
      });

      onClose();
      showGlobalToast({
        title: "Denúncia enviada",
        variant: "success",
        message: "Nossa equipe irá analisar.",
      });
      announceForAccessibility(accessibilityAnnouncements.reportSent());
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        onClose();
        showGlobalToast({
          title: "Denúncia já registrada",
          variant: "info",
          message:
            "Você já denunciou este perfil/post e a análise está em andamento.",
        });
        announceForAccessibility(accessibilityAnnouncements.reportDuplicate());
        return;
      }

      showGlobalToast({
        title: "Não foi possível enviar",
        variant: "error",
        message: formatApiErrorMessage(
          error,
          "Não foi possível enviar a denúncia agora. Tente novamente."
        ),
      });
    } finally {
      setSubmitting(false);
    }
  }, [description, onClose, reportedPostId, reportedUserId, selectedReason, submitting]);

  const remainingCharacters = DESCRIPTION_MAX_LENGTH - description.length;

  const cardClassName = useMemo(
    () =>
      `max-h-[88%] rounded-[28px] border p-6 ${
        highContrast ? "border-hc-border bg-hc-surface" : "border-[#393145] bg-surface-alt"
      }`,
    [highContrast]
  );

  const secondaryTextClassName = highContrast ? "text-hc-text" : "text-content-secondary";

  return (
    <Modal
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        className="flex-1 justify-end bg-black/65 px-6 pb-8"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          accessibilityHint="Fecha o formulário de denúncia sem enviar"
          className="absolute bottom-0 left-0 right-0 top-0"
          onPress={onClose}
          disabled={submitting}
        />

        <View className={cardClassName}>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text accessibilityRole="header" className="text-[21px] font-black text-white">
                Denunciar
              </Text>
              <Text className={`mt-2 text-[14px] font-semibold leading-6 ${secondaryTextClassName}`}>
                Você está denunciando {contextLabel}. Escolha o motivo que melhor descreve
                o problema.
              </Text>
            </View>

            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-[#2A2430]"
              onPress={onClose}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Fechar formulário de denúncia"
              accessibilityHint="Descarta a denúncia e volta para a tela anterior"
              accessibilityState={{ disabled: submitting }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            className="mt-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loadingReasons ? (
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Carregando motivos de denúncia"
                accessibilityState={{ busy: true }}
                className="items-center py-6"
              >
                <ActivityIndicator color="#EAEA00" />
              </View>
            ) : null}

            {reasonsError ? (
              <View className="rounded-2xl border border-[#6A4456] bg-[#2A1C24] p-4">
                <Text
                  accessibilityRole="alert"
                  className="text-[14px] font-semibold text-[#FFEAF0]"
                >
                  {reasonsError}
                </Text>
                <Pressable
                  className="mt-3 self-start rounded-full border border-[#494455] px-4 py-2"
                  onPress={() => {
                    void loadReasons();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar carregar os motivos novamente"
                >
                  <Text className="text-[13px] font-bold text-white">Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}

            {!loadingReasons && !reasonsError ? (
              <View accessibilityRole="radiogroup" accessibilityLabel="Motivo da denúncia">
                {reasons.map((option) => {
                  const checked = option.value === selectedReason;

                  return (
                    <Pressable
                      key={option.value}
                      className={`mb-2 flex-row items-center rounded-2xl border px-4 py-3 ${
                        checked
                          ? "border-[#CDBDFF] bg-[#2B2338]"
                          : highContrast
                            ? "border-hc-border bg-hc-bg"
                            : "border-[#353534] bg-[#17181C]"
                      }`}
                      onPress={() => setSelectedReason(option.value)}
                      disabled={submitting}
                      accessibilityRole="radio"
                      accessibilityLabel={option.description}
                      accessibilityHint="Seleciona este motivo para a denúncia"
                      accessibilityState={{ checked, disabled: submitting }}
                    >
                      <Ionicons
                        name={checked ? "radio-button-on" : "radio-button-off"}
                        size={22}
                        color={checked ? "#CDBDFF" : "#948EA1"}
                      />
                      <Text className="ml-3 flex-1 text-[15px] font-semibold text-white">
                        {option.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Text className={`mt-4 text-[13px] font-bold ${secondaryTextClassName}`}>
              Detalhes (opcional)
            </Text>
            <TextInput
              className="mt-2 min-h-[96px] rounded-2xl border border-[#494455] bg-[#1A1C1F] px-4 py-3 text-[15px] text-white"
              multiline
              textAlignVertical="top"
              maxLength={DESCRIPTION_MAX_LENGTH}
              value={description}
              onChangeText={setDescription}
              editable={!submitting}
              placeholder="Conte o que aconteceu"
              placeholderTextColor="#948EA1"
              accessibilityLabel="Detalhes da denúncia"
              accessibilityHint={`Campo opcional com até ${DESCRIPTION_MAX_LENGTH} caracteres`}
            />
            <Text
              className={`mt-1 text-right text-[12px] font-semibold ${secondaryTextClassName}`}
              accessibilityLabel={`${remainingCharacters} caracteres restantes`}
            >
              {remainingCharacters} restantes
            </Text>

            <Pressable
              className={`mt-5 h-14 items-center justify-center rounded-[18px] ${
                canSubmit ? "bg-[#F1EF00]" : "bg-[#3B3841]"
              }`}
              onPress={() => {
                void handleSubmit();
              }}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Enviar denúncia"
              accessibilityHint={
                selectedReason
                  ? "Envia a denúncia para análise da equipe"
                  : "Selecione um motivo antes de enviar"
              }
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            >
              {submitting ? (
                <ActivityIndicator color="#1D1D00" size="small" />
              ) : (
                <Text
                  className={`text-[16px] font-black ${
                    canSubmit ? "text-[#1D1D00]" : "text-[#948EA1]"
                  }`}
                >
                  Enviar denúncia
                </Text>
              )}
            </Pressable>

            <Pressable
              className="mt-3 h-12 items-center justify-center rounded-[18px]"
              onPress={onClose}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancelar denúncia"
              accessibilityState={{ disabled: submitting }}
            >
              <Text className="text-[15px] font-bold text-white">Cancelar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
