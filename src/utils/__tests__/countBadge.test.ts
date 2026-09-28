import { formatBadgeCount } from "../countBadge";

describe("formatBadgeCount", () => {
  it("mostra o numero ate 99", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(99)).toBe("99");
  });

  it("acima de 99 vira 99+", () => {
    expect(formatBadgeCount(100)).toBe("99+");
    expect(formatBadgeCount(2500)).toBe("99+");
  });

  it("some com zero, negativo, nulo ou invalido", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(-3)).toBeNull();
    expect(formatBadgeCount(null)).toBeNull();
    expect(formatBadgeCount(undefined)).toBeNull();
    expect(formatBadgeCount(Number.NaN)).toBeNull();
  });
});
