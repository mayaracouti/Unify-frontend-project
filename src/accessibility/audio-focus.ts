/**
 * Um canal de som por vez (plano 05, 5.9 item 4b): players de audio (chat,
 * apresentacao do perfil) e a leitura "Ouvir mensagem/publicacao" nunca soam
 * juntos. Cada player montado registra como parar; quem vai comecar a tocar
 * (outro player ou a leitura sob demanda) para os demais antes.
 */
type StopPlayback = () => void;

const registeredPlayers = new Set<StopPlayback>();

/** Registra o `stop` de um player montado. Devolve a funcao de remocao. */
export function registerAudioPlayer(stop: StopPlayback): () => void {
  registeredPlayers.add(stop);

  return () => {
    registeredPlayers.delete(stop);
  };
}

/** Para todos os players (menos `except`, quem esta comecando a tocar). */
export function stopAllAudioPlayback(except?: StopPlayback): void {
  registeredPlayers.forEach((stop) => {
    if (stop === except) {
      return;
    }

    try {
      stop();
    } catch {
      // Player ja liberado: nada a parar.
    }
  });
}
