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

/** "12 segundos" / "1 minuto e 5 segundos" */
export function formatAudioDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || seconds <= 0) {
    return "duração desconhecida";
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
