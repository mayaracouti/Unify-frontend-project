import {
  buildAuthenticatedImageSource,
  createObjectUrlCache,
  getAuthenticatedImageCacheKey,
  MAX_CACHED_WEB_IMAGES,
} from "../authenticated-remote-image-source";

describe("buildAuthenticatedImageSource", () => {
  it("inclui o header Authorization quando ha token", () => {
    expect(buildAuthenticatedImageSource("https://api/img.png", "abc")).toEqual({
      headers: { Authorization: "Bearer abc" },
      uri: "https://api/img.png",
    });
  });

  it("omite o header quando o token e nulo ou vazio", () => {
    expect(buildAuthenticatedImageSource("https://api/img.png", null)).toEqual({
      uri: "https://api/img.png",
    });
    expect(buildAuthenticatedImageSource("https://api/img.png", "   ")).toEqual({
      uri: "https://api/img.png",
    });
  });

  it("normaliza a uri do mesmo jeito que a chave de cache", () => {
    expect(buildAuthenticatedImageSource("  https://api/img.png  ", "abc").uri).toBe(
      "https://api/img.png"
    );
    expect(getAuthenticatedImageCacheKey("  https://api/img.png  ")).toBe(
      "https://api/img.png"
    );
  });
});

describe("createObjectUrlCache", () => {
  it("guarda e devolve object URLs por uri normalizada", () => {
    const cache = createObjectUrlCache({ revoke: jest.fn() });

    cache.set("https://api/a.png", "blob:a");

    expect(cache.get("  https://api/a.png ")).toBe("blob:a");
    expect(cache.get("https://api/b.png")).toBeNull();
  });

  it("revoga a entrada mais antiga ao estourar o teto (FIFO)", () => {
    const revoke = jest.fn();
    const cache = createObjectUrlCache({ maxEntries: 2, revoke });

    cache.set("a", "blob:a");
    cache.set("b", "blob:b");
    cache.set("c", "blob:c");

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:a");
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("blob:b");
    expect(cache.get("c")).toBe("blob:c");
    expect(cache.size).toBe(2);
  });

  it("revoga o object URL anterior ao sobrescrever a mesma uri", () => {
    const revoke = jest.fn();
    const cache = createObjectUrlCache({ maxEntries: 2, revoke });

    cache.set("a", "blob:a");
    cache.set("a", "blob:a2");

    expect(revoke).toHaveBeenCalledWith("blob:a");
    expect(cache.get("a")).toBe("blob:a2");
    expect(cache.size).toBe(1);
  });

  it("revoga tudo no clear (logout)", () => {
    const revoke = jest.fn();
    const cache = createObjectUrlCache({ revoke });

    cache.set("a", "blob:a");
    cache.set("b", "blob:b");
    cache.clear();

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeNull();
  });

  it("mantem o teto padrao do web em 60", () => {
    const cache = createObjectUrlCache({ revoke: jest.fn() });

    for (let index = 0; index < MAX_CACHED_WEB_IMAGES + 10; index += 1) {
      cache.set(`uri-${index}`, `blob:${index}`);
    }

    expect(cache.size).toBe(MAX_CACHED_WEB_IMAGES);
  });
});
