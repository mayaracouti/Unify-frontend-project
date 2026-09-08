/**
 * Formatacao de data/hora e duracao para o chat.
 *
 * Duas variantes deliberadas: uma curta para o VISUAL (cabe na linha da lista) e
 * outra por extenso para o leitor de tela, que precisa de frase completa.
 */

/** "14:29" hoje, "ontem", "02/09" para datas antigas. Uso VISUAL. */
export function formatRelativeDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();

  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "ontem";
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** "hoje as 14:29" — uso em accessibilityLabel (leitor de tela). */
export function formatTimeForSpeech(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();

  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) {
    return `hoje às ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `ontem às ${time}`;
  }

  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às ${time}`;
}

/**
 * "12 segundos" / "1 minuto e 5 segundos" — uso em FALA (leitor de tela).
 * Duracao desconhecida ou zero devolve string vazia: quem chama decide a frase
 * (ver `describeAudioMessage`), nunca mostra "duracao desconhecida".
 */
export function formatAudioDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remaining = totalSeconds % 60;

  if (minutes === 0) {
    return `${remaining} ${remaining === 1 ? "segundo" : "segundos"}`;
  }

  const minutePart = `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  return remaining === 0
    ? minutePart
    : `${minutePart} e ${remaining} ${remaining === 1 ? "segundo" : "segundos"}`;
}

/** "Mensagem de áudio de 12 segundos" ou, sem duracao, so "Mensagem de áudio". */
export function describeAudioMessage(seconds: number | null | undefined): string {
  const spoken = formatAudioDuration(seconds);
  return spoken ? `Mensagem de áudio de ${spoken}` : "Mensagem de áudio";
}

/** "0:07" / "1:05" — cronometro VISUAL (gravacao e player). Zero vira "0:00". */
export function formatAudioClock(seconds: number | null | undefined): string {
  const total =
    typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
      ? Math.floor(seconds)
      : 0;
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}
