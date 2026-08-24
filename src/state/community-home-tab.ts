/**
 * Aba ativa da tela de comunidades ("Para você" / "Descubra comunidades").
 *
 * A tela e desmontada ao abrir uma comunidade e remontada no voltar, entao o
 * `useState` sozinho sempre voltaria para "Para você". Guardar a escolha em
 * modulo mantem a aba anterior sem depender de leitura assincrona (que causaria
 * um flash da aba errada no primeiro render).
 */
export type CommunityHomeTab = "forYou" | "discover";

const DEFAULT_COMMUNITY_HOME_TAB: CommunityHomeTab = "forYou";

let lastCommunityHomeTab: CommunityHomeTab = DEFAULT_COMMUNITY_HOME_TAB;

export function getLastCommunityHomeTab(): CommunityHomeTab {
  return lastCommunityHomeTab;
}

export function setLastCommunityHomeTab(tab: CommunityHomeTab) {
  lastCommunityHomeTab = tab;
}
