import { formatDistanceSpeech, formatDistanceText } from "../distanceFormatting";

describe("distanceFormatting", () => {
  it("abaixo de 1 km nao mostra 0 km", () => {
    expect(formatDistanceText(0)).toBe("A menos de 1 km de você");
    expect(formatDistanceText(0.4)).toBe("A menos de 1 km de você");
    expect(formatDistanceSpeech(0.2)).toBe("a menos de 1 quilômetro");
  });

  it("arredonda e concorda em numero na fala", () => {
    expect(formatDistanceText(4.6)).toBe("A 5 km de você");
    expect(formatDistanceSpeech(1.2)).toBe("a 1 quilômetro");
    expect(formatDistanceSpeech(2)).toBe("a 2 quilômetros");
  });

  it("distancia ausente ou invalida some", () => {
    for (const value of [null, undefined, Number.NaN, -1]) {
      expect(formatDistanceText(value)).toBeNull();
      expect(formatDistanceSpeech(value)).toBeNull();
    }
  });
});
