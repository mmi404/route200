import { NextRequest, NextResponse } from "next/server";

/**
 * A Bangladeshi mobile number in E.164 form: "+880" followed by the
 * 10-digit subscriber number (operator prefix 1[3-9], then 8 more
 * digits). The signup form collects the familiar 11-digit local form
 * ("01XXXXXXXXX") and strips the leading 0 before it reaches this route.
 */
const PHONE_PATTERN = /^\+8801[3-9]\d{8}$/;

interface AlertSignupPayload {
  phone: string;
  zoneId: string;
  channels: { sms: boolean; voice: boolean };
  language: "bn" | "en";
}

function isAlertSignupPayload(body: unknown): body is AlertSignupPayload {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;

  if (typeof candidate.phone !== "string" || !PHONE_PATTERN.test(candidate.phone)) {
    return false;
  }
  if (typeof candidate.zoneId !== "string" || candidate.zoneId.length === 0) {
    return false;
  }
  if (candidate.language !== "bn" && candidate.language !== "en") {
    return false;
  }

  const channels = candidate.channels;
  if (!channels || typeof channels !== "object") return false;
  const { sms, voice } = channels as Record<string, unknown>;
  if (typeof sms !== "boolean" || typeof voice !== "boolean") return false;
  if (!sms && !voice) return false;

  return true;
}

/**
 * POST /api/alerts
 *
 * Placeholder alert-signup endpoint. There is no contacts database yet
 * (the real one belongs to the alert-delivery track, see
 * docs/WEB_DATA_CONTRACT.md's note on `registeredAlertCount`), so this
 * route only validates the payload shape and acknowledges it; it does
 * not persist anything. The phone number is deliberately left out of the
 * server log below.
 *
 * Swapping this handler to write a real row once that contacts table
 * exists is the entire integration point: the request shape below stays
 * the same, matching the "swap the data source, not the frontend"
 * pattern already used by /api/zones and /api/change-events.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isAlertSignupPayload(body)) {
    return NextResponse.json(
      {
        error:
          "Expected { phone: \"+880\" + 10-digit number starting 1[3-9], zoneId: string, " +
          "channels: { sms: boolean, voice: boolean } with at least one true, " +
          "language: \"bn\" | \"en\" }",
      },
      { status: 400 },
    );
  }

  console.log("[api/alerts] signup received", {
    zoneId: body.zoneId,
    channels: body.channels,
    language: body.language,
  });

  return NextResponse.json({ ok: true, received: true }, { status: 200 });
}
