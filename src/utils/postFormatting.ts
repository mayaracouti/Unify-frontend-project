const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Data relativa em pt-BR. Falar "há 5 min" situa melhor do que um timestamp
 * cru quando o leitor de tela anuncia o cartão inteiro de uma vez.
 */
export function formatRelativePostDate(isoDate: string, now = Date.now()) {
  const timestamp = Date.parse(isoDate);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const elapsed = now - timestamp;

  if (elapsed < MINUTE_MS) {
    return "agora mesmo";
  }

  if (elapsed < HOUR_MS) {
    return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  }

  if (elapsed < DAY_MS) {
    return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  }

  if (elapsed < 2 * DAY_MS) {
    return "ontem";
  }

  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}`;
}

export function getNameInitial(name: string | null | undefined) {
  return (name?.trim()[0] ?? "?").toUpperCase();
}
