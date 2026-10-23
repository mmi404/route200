import { describe, expect, it } from "vitest";
import { format, t, zoneDisplayName } from "./i18n";

describe("t", () => {
  it("picks the string for the requested locale out of a bilingual entry", () => {
    const entry = { en: "Get alerts", bn: "অ্যালার্ট নিন" };
    expect(t(entry, "en")).toBe("Get alerts");
    expect(t(entry, "bn")).toBe("অ্যালার্ট নিন");
  });
});

describe("format", () => {
  it("replaces a single placeholder with the given value", () => {
    expect(format("{count} zones tracked", { count: 12 })).toBe("12 zones tracked");
  });

  it("replaces every occurrence of a repeated placeholder", () => {
    expect(format("{name} told {name} about it", { name: "Rahim" })).toBe(
      "Rahim told Rahim about it",
    );
  });

  it("leaves a placeholder untouched when no matching value is supplied", () => {
    // format() has no runtime formatting magic: an unsupplied placeholder
    // is simply never matched by the split/join, not replaced with "" or
    // left to throw.
    expect(format("{count} zones, {district}", { count: 5 })).toBe("5 zones, {district}");
  });

  it("leaves a malformed (unclosed) placeholder in the template untouched", () => {
    expect(format("{count zones", { count: 5 })).toBe("{count zones");
  });

  it("ignores extra values that don't correspond to any placeholder in the template", () => {
    expect(format("plain text", { unused: "value" })).toBe("plain text");
  });

  it("stringifies a numeric value rather than leaving it as a number", () => {
    const result = format("{count}", { count: 0 });
    expect(result).toBe("0");
    expect(typeof result).toBe("string");
  });
});

describe("zoneDisplayName", () => {
  it("uses the Bangla name when the locale is bn and a nameBn is present", () => {
    const properties = { name: "Jamuna char, Kazipur", nameBn: "যমুনার চর, কাজীপুর" };
    expect(zoneDisplayName(properties, "bn")).toBe("যমুনার চর, কাজীপুর");
  });

  it("uses the English name when the locale is en, even if a nameBn is present", () => {
    const properties = { name: "Jamuna char, Kazipur", nameBn: "যমুনার চর, কাজীপুর" };
    expect(zoneDisplayName(properties, "en")).toBe("Jamuna char, Kazipur");
  });

  it("falls back to the English name when the locale is bn but nameBn is absent", () => {
    const properties = { name: "Jamuna char, Kazipur" };
    expect(zoneDisplayName(properties, "bn")).toBe("Jamuna char, Kazipur");
  });

  it("falls back to the English name when nameBn is an empty string", () => {
    // An empty string is falsy, so this exercises the same fallback branch
    // as a genuinely absent nameBn, not a different code path.
    const properties = { name: "Jamuna char, Kazipur", nameBn: "" };
    expect(zoneDisplayName(properties, "bn")).toBe("Jamuna char, Kazipur");
  });
});
