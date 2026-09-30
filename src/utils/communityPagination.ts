import type { PageResponse } from "../types/pagination";

/** Accepts the documented legacy lists and the paginated API contract. */
export function normalizeCommunityPage<T>(
  value: unknown,
  legacyKey: string,
  requestedPage = 0,
  requestedSize = 20
): PageResponse<T> {
  const record = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const content = Array.isArray(value) ? value
    : Array.isArray(record.content) ? record.content
      : Array.isArray(record[legacyKey]) ? record[legacyKey] : null;
  if (!content) throw new Error("A resposta da comunidade está em um formato inválido.");
  const number = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isFinite(input) && input >= 0 ? input : fallback;
  const page = number(record.page ?? record.number, requestedPage);
  const size = number(record.size, requestedSize) || requestedSize;
  const totalElements = number(record.totalElements, content.length);
  const paginated = record.totalElements !== undefined || record.totalPages !== undefined || record.hasNext !== undefined || record.last !== undefined;
  const totalPages = number(record.totalPages, paginated ? Math.ceil(totalElements / size) : content.length ? 1 : 0);
  const hasNext = typeof record.hasNext === "boolean" ? record.hasNext
    : typeof record.last === "boolean" ? !record.last
      : page + 1 < totalPages;
  return { content: content as T[], page, size, totalElements, totalPages, hasNext: content.length > 0 && hasNext };
}

export function mergeCommunityItems<T>(
  current: T[], incoming: T[], key: (item: T) => string | null | undefined
): T[] {
  const result = [...current];
  for (const item of incoming) {
    const id = key(item);
    const index = id ? result.findIndex((existing) => key(existing) === id) : -1;
    if (index < 0) result.push(item);
    else result[index] = item;
  }
  return result;
}
