/**
 * "Já viu a explicação do áudio de apresentação?" — mostrada só no primeiro
 * toque em Gravar. Estado de conveniência local (não é segredo): fica no
 * `bulkStorage`, com a chave escopada pelo usuário (`sub` do JWT), para que
 * outra conta no mesmo aparelho também veja a explicação uma vez.
 */
import { getUserId } from "./tokenStorage";
import { getBulkItem, setBulkItem } from "./bulkStorage";

const KEY_PREFIX = "unify.presentationAudio.introSeen.";

async function resolveKey(): Promise<string> {
  const userId = await getUserId();
  return `${KEY_PREFIX}${userId ?? "anonymous"}`;
}

export async function hasSeenPresentationAudioIntro(): Promise<boolean> {
  return (await getBulkItem(await resolveKey())) === "1";
}

export async function markPresentationAudioIntroSeen(): Promise<void> {
  await setBulkItem(await resolveKey(), "1");
}
