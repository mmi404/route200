import { describe, expect, it } from "vitest";
import { SEVERITY_BANDS, severityToBand } from "./types";

describe("severityToBand", () => {
  it("maps a mid-band score to the expected band and label", () => {
    const result = severityToBand(40);
    expect(result).toEqual({
      score: 40,
      band: "moderate",
      label: SEVERITY_BANDS[1].label,
    });
  });

  it("treats each band's max as inclusive to that band, not the next one", () => {
    // SEVERITY_BANDS: low <=25, moderate <=50, high <=75, severe <=100.
    expect(severityToBand(25).band).toBe("low");
    expect(severityToBand(26).band).toBe("moderate");
    expect(severityToBand(50).band).toBe("moderate");
    expect(severityToBand(51).band).toBe("high");
    expect(severityToBand(75).band).toBe("high");
    expect(severityToBand(76).band).toBe("severe");
    expect(severityToBand(100).band).toBe("severe");
  });

  it("holds at the exact boundary between low and moderate for fractional scores too", () => {
    expect(severityToBand(25.0).band).toBe("low");
    expect(severityToBand(25.01).band).toBe("moderate");
  });

  it("clamps a score above 100 down to 100 (severe) rather than erroring or extrapolating", () => {
    const result = severityToBand(150);
    expect(result.score).toBe(100);
    expect(result.band).toBe("severe");
  });

  it("clamps a negative score up to 0 (low) rather than erroring", () => {
    const result = severityToBand(-20);
    expect(result.score).toBe(0);
    expect(result.band).toBe("low");
  });

  it("returns the exact label text from SEVERITY_BANDS for the matched band, not a re-derived string", () => {
    expect(severityToBand(0).label).toBe(SEVERITY_BANDS[0].label);
    expect(severityToBand(100).label).toBe(SEVERITY_BANDS[3].label);
  });
});
