/**
 * Ultimo registro do token de push DESTE aparelho no backend: o `id` serve
 * para descadastrar no logout (o token nunca vai na URL) e `token`+`userId`
 * evitam re-registrar a cada abertura do app.
 *
 * Nao e segredo (o token so recebe push; enviar exige a conta de servico do
 * Firebase, que fica no backend): fica no `bulkStorage`.
 */
import { getBulkItem, removeBulkItem, setBulkItem } from "./bulkStorage";

const PUSH_REGISTRATION_KEY = "unify.push.registration";
const PUSH_PERMISSION_AUTO_PROMPTED_KEY = "unify.push.permission-auto-prompted";

export type PushRegistration = {
  id: string;
  token: string;
  userId: string;
};

export async function getPushRegistration(): Promise<PushRegistration | null> {
  const raw = await getBulkItem(PUSH_REGISTRATION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PushRegistration>;

    return typeof parsed.id === "string" &&
      typeof parsed.token === "string" &&
      typeof parsed.userId === "string"
      ? { id: parsed.id, token: parsed.token, userId: parsed.userId }
      : null;
  } catch {
    return null;
  }
}

export async function savePushRegistration(registration: PushRegistration): Promise<void> {
  await setBulkItem(PUSH_REGISTRATION_KEY, JSON.stringify(registration));
}

export async function clearPushRegistration(): Promise<void> {
  await removeBulkItem(PUSH_REGISTRATION_KEY);
}

/**
 * O app ja abriu o dialogo de permissao SOZINHO neste aparelho? Fica no
 * aparelho (nao some no logout): depois de uma recusa o Android 13+ ainda
 * deixa pedir de novo, mas so a pessoa decide isso (botao "Ativar
 * notificacoes" na tela de notificacoes).
 */
export async function hasAutoPromptedPushPermission(): Promise<boolean> {
  return (await getBulkItem(PUSH_PERMISSION_AUTO_PROMPTED_KEY)) === "true";
}

export async function markPushPermissionAutoPrompted(): Promise<void> {
  await setBulkItem(PUSH_PERMISSION_AUTO_PROMPTED_KEY, "true");
}
