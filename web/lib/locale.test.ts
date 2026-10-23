import { beforeEach, describe, expect, it, vi } from "vitest";

// getLocale() calls next/headers's cookies(), which only works inside an
// actual request (Server Component / Route Handler) context. Mocking the
// module is the only way to exercise getLocale()'s own fallback/parsing
// logic in a plain unit test; this does not attempt to test next/headers
// itself.
const getMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: getMock })),
}));

describe("getLocale", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("defaults to bn when the cookie is absent, per the Bangla-first design", async () => {
    getMock.mockReturnValue(undefined);
    const { getLocale } = await import("./locale");

    expect(await getLocale()).toBe("bn");
  });

  it("returns en when the cookie is explicitly set to en", async () => {
    getMock.mockReturnValue({ value: "en" });
    const { getLocale } = await import("./locale");

    expect(await getLocale()).toBe("en");
  });

  it("returns bn when the cookie is explicitly set to bn", async () => {
    getMock.mockReturnValue({ value: "bn" });
    const { getLocale } = await import("./locale");

    expect(await getLocale()).toBe("bn");
  });

  it("falls back to the bn default for a malformed or unrecognized cookie value", async () => {
    getMock.mockReturnValue({ value: "fr" });
    const { getLocale } = await import("./locale");

    expect(await getLocale()).toBe("bn");
  });
});
