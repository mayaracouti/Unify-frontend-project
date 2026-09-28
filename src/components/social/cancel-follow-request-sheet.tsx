import { ActionSheet } from "../ui/action-sheet";

/**
 * Confirmacao de "cancelar pedido para seguir" (botao "Solicitado" e aba
 * Enviados). `ActionSheet` em vez de `Alert.alert`, que nao existe na web.
 * Quem chama decide o que o "confirmar" faz (DELETE do follow ou do pedido).
 */
export function CancelFollowRequestSheet({
  onClose,
  onConfirm,
  targetName,
}: {
  onClose: () => void;
  onConfirm: () => void;
  /** Nome de quem eu pedi para seguir; `null` fecha a folha. */
  targetName: string | null;
}) {
  return (
    <ActionSheet
      cancelLabel="Manter pedido"
      message={
        targetName
          ? `${targetName} não verá mais o seu pedido. Dá para pedir de novo depois.`
          : undefined
      }
      onClose={onClose}
      options={[
        {
          key: "confirm-cancel-follow-request",
          label: "Cancelar pedido",
          hint: "Retira o seu pedido para seguir agora",
          icon: "close-circle-outline",
          destructive: true,
          onPress: onConfirm,
        },
      ]}
      title={targetName ? `Cancelar pedido para seguir ${targetName}?` : "Cancelar pedido?"}
      visible={targetName !== null}
    />
  );
}
