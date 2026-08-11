import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { communityService } from "../services/communityService";
import { showGlobalToast } from "../utils/globalToast";

export type UseCommunityDangerActionsArgs = {
  communityId?: string | null;
  /** Executado apos exclusao/saida bem-sucedida, antes do redirecionamento. */
  onCompleted?: () => void;
};

/**
 * Acoes destrutivas de comunidade (excluir e sair) compartilhadas entre o feed
 * (`app/community/[communityId].tsx`) e a tela de configuracoes
 * (`app/community/settings.tsx`). Cada acao pede confirmacao via `Alert.alert`
 * e, ao concluir, volta para o diretorio de comunidades.
 */
export function useCommunityDangerActions({
  communityId,
  onCompleted,
}: UseCommunityDangerActionsArgs) {
  const router = useRouter();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const confirmDeleteCommunity = useCallback(async () => {
    const targetCommunityId = communityId?.trim();

    if (!targetCommunityId || deleteBusy) {
      return;
    }

    setDeleteBusy(true);

    try {
      await communityService.deleteCommunity(targetCommunityId);
      showGlobalToast({
        title: "Comunidade removida",
        variant: "success",
        message: "A comunidade foi excluída com sucesso.",
      });
      onCompleted?.();
      router.replace("/community");
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setDeleteBusy(false);
    }
  }, [communityId, deleteBusy, onCompleted, router]);

  const handleDeleteCommunity = useCallback(() => {
    Alert.alert(
      "Excluir comunidade",
      "Essa ação apaga a comunidade permanentemente. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            void confirmDeleteCommunity();
          },
        },
      ]
    );
  }, [confirmDeleteCommunity]);

  const confirmLeaveCommunity = useCallback(async () => {
    const targetCommunityId = communityId?.trim();

    if (!targetCommunityId || leaveBusy) {
      return;
    }

    setLeaveBusy(true);

    try {
      await communityService.leaveCommunity(targetCommunityId);
      showGlobalToast({
        title: "Você saiu da comunidade",
        variant: "success",
        message: "Você pode entrar novamente quando quiser.",
      });
      onCompleted?.();
      router.replace("/community");
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setLeaveBusy(false);
    }
  }, [communityId, leaveBusy, onCompleted, router]);

  const handleLeaveCommunity = useCallback(() => {
    Alert.alert(
      "Sair da comunidade",
      "Você deixará de ver as publicações e não poderá mais interagir. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: () => {
            void confirmLeaveCommunity();
          },
        },
      ]
    );
  }, [confirmLeaveCommunity]);

  return {
    deleteBusy,
    leaveBusy,
    confirmDeleteCommunity,
    handleDeleteCommunity,
    confirmLeaveCommunity,
    handleLeaveCommunity,
  };
}
