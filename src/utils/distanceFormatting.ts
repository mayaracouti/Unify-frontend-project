/**
 * Distancia entre perfis, para texto e para fala. Abaixo de 1 km o
 * arredondamento daria "0 km" (parece dado faltando), entao vira "menos de
 * 1 km"; a fala concorda em numero ("1 quilômetro", "2 quilômetros").
 * Distancia ausente/oculta pelo dono devolve null: a linha some.
 */
function normalizeDistance(distanceKm: number | null | undefined): number | null {
  return typeof distanceKm === "number" && Number.isFinite(distanceKm) && distanceKm >= 0
    ? distanceKm
    : null;
}

/** "A menos de 1 km de você" | "A 5 km de você" | null */
export function formatDistanceText(distanceKm: number | null | undefined): string | null {
  const distance = normalizeDistance(distanceKm);
  if (distance === null) {
    return null;
  }
  const rounded = Math.round(distance);
  return rounded < 1 ? "A menos de 1 km de você" : `A ${rounded} km de você`;
}

/** "a menos de 1 quilômetro" | "a 1 quilômetro" | "a 5 quilômetros" | null */
export function formatDistanceSpeech(distanceKm: number | null | undefined): string | null {
  const distance = normalizeDistance(distanceKm);
  if (distance === null) {
    return null;
  }
  const rounded = Math.round(distance);
  if (rounded < 1) {
    return "a menos de 1 quilômetro";
  }
  return rounded === 1 ? "a 1 quilômetro" : `a ${rounded} quilômetros`;
}
