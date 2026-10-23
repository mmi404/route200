import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/alerts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validPayload = {
  phone: "+8801712345678",
  zoneId: "zone-jamuna-kazipur",
  channels: { sms: true, voice: false },
  language: "bn" as const,
};

describe("POST /api/alerts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid payload and acknowledges it", async () => {
    const response = await POST(postRequest(validPayload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, received: true });
  });

  it("never logs the phone number, even for a valid, accepted submission", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await POST(postRequest(validPayload));

    expect(logSpy).toHaveBeenCalled();
    const loggedPayload = JSON.stringify(logSpy.mock.calls);
    expect(loggedPayload).not.toContain(validPayload.phone);
  });

  it("rejects a phone number missing the +880 country code", async () => {
    const response = await POST(postRequest({ ...validPayload, phone: "01712345678" }));
    expect(response.status).toBe(400);
  });

  it("rejects a phone number with an operator prefix digit outside 3-9", async () => {
    // "+88012..." has second digit "2", which the real Bangladeshi mobile
    // numbering plan (and this route's own pattern) never issues.
    const response = await POST(postRequest({ ...validPayload, phone: "+8801212345678" }));
    expect(response.status).toBe(400);
  });

  it("rejects a payload with both sms and voice channels false", async () => {
    const response = await POST(
      postRequest({ ...validPayload, channels: { sms: false, voice: false } }),
    );
    expect(response.status).toBe(400);
  });

  it("accepts a payload with only the voice channel true", async () => {
    const response = await POST(
      postRequest({ ...validPayload, channels: { sms: false, voice: true } }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects a payload missing zoneId", async () => {
    const { zoneId, ...withoutZoneId } = validPayload;
    void zoneId;
    const response = await POST(postRequest(withoutZoneId));
    expect(response.status).toBe(400);
  });

  it("rejects a language value outside bn/en", async () => {
    const response = await POST(postRequest({ ...validPayload, language: "fr" }));
    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON with its own distinct 400 message", async () => {
    const response = await POST(postRequest("{not valid json"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid JSON body");
  });
});
