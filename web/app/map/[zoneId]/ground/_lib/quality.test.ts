import { describe, expect, it } from "vitest";
import { decideQuality, type DeviceCapabilities } from "./quality";

const DESKTOP: DeviceCapabilities = {
  coarsePointer: false,
  viewportWidth: 1280,
  viewportHeight: 760,
  hardwareConcurrency: 12,
  deviceMemory: 8,
};

describe("decideQuality", () => {
  it("is high on a capable desktop", () => {
    expect(decideQuality(DESKTOP)).toBe("high");
  });

  it("is low on a phone: coarse pointer and a small viewport", () => {
    expect(decideQuality({ ...DESKTOP, coarsePointer: true, viewportWidth: 390, viewportHeight: 780 })).toBe("low");
    // Landscape phone: the short side still decides.
    expect(decideQuality({ ...DESKTOP, coarsePointer: true, viewportWidth: 844, viewportHeight: 390 })).toBe("low");
  });

  it("keeps a coarse-pointer tablet with capable hardware on high", () => {
    expect(decideQuality({ ...DESKTOP, coarsePointer: true, viewportWidth: 1024, viewportHeight: 768 })).toBe("high");
  });

  it("does not treat a small desktop window as a phone", () => {
    expect(decideQuality({ ...DESKTOP, viewportWidth: 400, viewportHeight: 600 })).toBe("high");
  });

  it("is low with four cores or fewer, or 4 GB or less", () => {
    expect(decideQuality({ ...DESKTOP, hardwareConcurrency: 4 })).toBe("low");
    expect(decideQuality({ ...DESKTOP, hardwareConcurrency: 5 })).toBe("high");
    expect(decideQuality({ ...DESKTOP, deviceMemory: 4 })).toBe("low");
    expect(decideQuality({ ...DESKTOP, deviceMemory: 8 })).toBe("high");
  });

  it("ignores values the browser does not report", () => {
    expect(
      decideQuality({ coarsePointer: false, viewportWidth: 1280, viewportHeight: 760 }),
    ).toBe("high");
    expect(decideQuality({ ...DESKTOP, hardwareConcurrency: 0 })).toBe("high");
  });

  it("honours an explicit override", () => {
    expect(decideQuality(DESKTOP, "low")).toBe("low");
    expect(decideQuality({ ...DESKTOP, hardwareConcurrency: 2 }, "high")).toBe("high");
    expect(decideQuality(DESKTOP, "bogus")).toBe("high");
  });
});
