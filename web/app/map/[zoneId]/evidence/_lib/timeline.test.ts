import { describe, expect, it } from "vitest";
import teknafManifest from "@/public/evidence/teknaf/manifest.json";
import { hasEvidencePack } from "./available";
import { evidenceImageUrls, getEvidencePack } from "./packs";
import { contiguousRuns, dayOfMonth, despeckleWindow, parseEventWindow } from "./timeline";

describe("parseEventWindow", () => {
  it("reads the manifest's own window format", () => {
    expect(parseEventWindow("2026-07-06 to 2026-07-24")).toEqual({
      start: "2026-07-06",
      end: "2026-07-24",
    });
  });

  it("rejects malformed or reversed windows instead of guessing", () => {
    expect(parseEventWindow("6-24 July 2026")).toBeNull();
    expect(parseEventWindow("2026-07-24 to 2026-07-06")).toBeNull();
  });
});

describe("contiguousRuns", () => {
  it("groups unbroken true stretches, inclusive", () => {
    expect(contiguousRuns([false, true, true, false, true])).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 4 },
    ]);
  });

  it("handles a run that reaches the end, and no runs at all", () => {
    expect(contiguousRuns([false, true, true])).toEqual([{ start: 1, end: 2 }]);
    expect(contiguousRuns([false, false])).toEqual([]);
    expect(contiguousRuns([])).toEqual([]);
  });
});

describe("dayOfMonth", () => {
  it("parses the day without going through Date", () => {
    expect(dayOfMonth("2026-07-09")).toBe(9);
    expect(dayOfMonth("2026-07-25T00:00:00Z")).toBe(25);
  });
});

describe("despeckleWindow", () => {
  it("reads the filter size out of the manifest note", () => {
    expect(despeckleWindow(teknafManifest.before_after.despeckle_note)).toEqual({
      width: 15,
      height: 15,
    });
    expect(despeckleWindow("no filter named here")).toBeNull();
  });
});

describe("Teknaf evidence pack", () => {
  it("is registered, and only for its own zone", () => {
    expect(hasEvidencePack("zone-cht-teknaf")).toBe(true);
    expect(hasEvidencePack("zone-cht-lama")).toBe(false);
    expect(getEvidencePack("zone-cht-teknaf")?.manifest.zone_id).toBe("zone-cht-teknaf");
    expect(getEvidencePack("zone-cht-lama")).toBeNull();
  });

  it("finds the real six-day optical blackout as one run", () => {
    const days = teknafManifest.july_event_timeline.daily_optical_precip;
    const runs = contiguousRuns(days.map((day) => !day.optical_available));
    expect(runs).toHaveLength(1);
    expect(days[runs[0].start].date).toBe("2026-07-11");
    expect(days[runs[0].end].date).toBe("2026-07-16");
    // Blackout days carry null, never a misleading 0.
    for (let i = runs[0].start; i <= runs[0].end; i++) {
      expect(days[i].cloud_fraction).toBeNull();
    }
  });

  it("derives image URLs from manifest dates using the build script's naming", () => {
    const pack = getEvidencePack("zone-cht-teknaf");
    expect(pack).not.toBeNull();
    const urls = evidenceImageUrls(pack!);
    expect(urls.before).toBe("/evidence/teknaf/sar_before_2026-05-04.png");
    expect(urls.after).toBe("/evidence/teknaf/sar_after_2026-11-05.png");
    expect(urls.diff).toBe("/evidence/teknaf/sar_diff_2026-05-04_to_2026-11-05.png");
    expect(urls.optical("2026-07-11")).toBe(
      "/evidence/teknaf/optical_timeline/optical_2026-07-11.png",
    );
  });
});
