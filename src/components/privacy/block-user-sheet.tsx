import { privacyService } from "../../services/privacyService";
import { isApiError } from "../../types/auth";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../utils/accessibilityAnnouncements";
import { showGlobalToast } from "../../utils/globalToast";
import { ActionSheet } from "../ui/action-sheet";

export type BlockUserTarget = {
  userProfileId: string;
  name: string;
};

/**
 * Confirmacao acessivel de bloqueio (perfil publico, conversa e Encontros).
 *
 * Usa a `ActionSheet` do app em vez de `Alert.alert` (que nao existe na web):
 * titulo como cabecalho, consequencia no texto e no `hint` do botao, e
 * "Cancelar" sempre presente. A requisicao so sai depois da confirmacao.
 *
 * Sucesso: toast (audivel pelo TTS in-app) + anuncio para o leitor do sistema e
 * `onBlocked` — a tela decide o que fazer (voltar, avancar o card...). 409 (ja
 * bloqueado) conta como sucesso: o estado desejado ja vale. Outros erros ja
 * aparecem no toast global de erro da API.
 */
export function BlockUserSheet({
  onBlocked,
  onClose,
  target,
}: {
  onBlocked: (target: BlockUserTarget) => void;
  onClose: () => void;
  target: BlockUserTarget | null;
}) {
  async function confirmBlock() {
    if (!target) {
      return;
    }

    const current = target;
    onClose();

    try {
      await privacyService.blockUser(current.userProfileId);
    } catch (error) {
      if (!isApiError(error) || error.status !== 409) {
        // Global API error toast already explains the failure.
        return;
      }
    }

    showGlobalToast({
      title: "Usuário bloqueado",
      message: `${current.name} foi bloqueado. Desbloqueie em Privacidade e bloqueios quando quiser.`,
      variant: "success",
    });
    announceForAccessibility(accessibilityAnnouncements.userBlocked(current.name));
    onBlocked(current);
  }

  return (
    <ActionSheet
      message={
        target
          ? `${target.name} não poderá ver seu perfil, seguir você nem enviar mensagens, e você também deixará de ver essa pessoa. Vocês deixam de se seguir. O histórico de conversas continua visível.`
          : undefined
      }
      onClose={onClose}
      options={[
        {
          key: "confirm-block",
          label: target ? `Bloquear ${target.name}` : "Bloquear",
          hint: "Bloqueia agora. Dá para desfazer em Privacidade e bloqueios, no seu perfil",
          icon: "ban-outline",
          destructive: true,
          onPress: () => {
            void confirmBlock();
          },
        },
      ]}
      title="Bloquear usuário?"
      visible={Boolean(target)}
    />
  );
}
