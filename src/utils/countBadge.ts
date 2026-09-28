/** Acima disso o badge mostra "99+" (o numero exato vai no rotulo acessivel). */
export const COUNT_BADGE_MAX = 99;

/**
 * Texto do badge contador: `null` quando nao ha o que mostrar (0, negativo,
 * nulo ou invalido) e "99+" acima de 99.
 */
export function formatBadgeCount(count: number | null | undefined): string | null {
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return null;
  }

  const rounded = Math.floor(count);

  if (rounded <= 0) {
    return null;
  }

  return rounded > COUNT_BADGE_MAX ? `${COUNT_BADGE_MAX}+` : String(rounded);
}
