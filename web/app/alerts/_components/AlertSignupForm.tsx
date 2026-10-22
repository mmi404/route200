"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Button, SectionLabel } from "@/app/components";
import type { ZoneFeature, ZoneFeatureCollection } from "@/lib/types";

export type AlertChannels = {
  sms: boolean;
  voice: boolean;
};

export type AlertLanguage = "bn" | "en";

export type AlertSignupFormProps = {
  /**
   * Pre-selects an area: from a `?zone=` query param on /alerts, or passed
   * directly by the landing page / the map inspect panel's "Get alerts for
   * this zone" link. Ignored if it does not match an id from /api/zones.
   */
  defaultZoneId?: string;
  className?: string;
};

type FieldErrors = {
  phone?: string;
  zoneId?: string;
  channels?: string;
};

// The familiar local form Bangladeshis type: 11 digits, leading 0, operator
// prefix 1[3-9]. The route handler gets the E.164 form built from this.
const PHONE_PATTERN = /^01[3-9]\d{8}$/;

function toE164(nationalNumber: string): string {
  return `+880${nationalNumber.slice(1)}`;
}

const ALERT_PREVIEW: Record<AlertLanguage, (area: string) => string> = {
  en: (area) =>
    `Route200 alert: ${area} has crossed the risk threshold. Open the map for details, or wait for our voice call. Reply STOP to unsubscribe.`,
  bn: (area) =>
    `Route200 সতর্কতা: ${area}-এ ঝুঁকির সীমা অতিক্রম করেছে। বিস্তারিত জানতে মানচিত্র দেখুন, নয়তো আমাদের ফোন কলের জন্য অপেক্ষা করুন। বন্ধ করতে উত্তরে STOP লিখুন।`,
};

const AREA_PLACEHOLDER: Record<AlertLanguage, string> = {
  en: "your area",
  bn: "আপনার এলাকা",
};

/**
 * The shared alert signup form: embedded in the landing page's "Get
 * alerts" section and standing alone at /alerts. A plain paper-style
 * form, not a card or modal, per DESIGN_SPEC.md section 7(c).
 *
 * Fetches zones from /api/zones to populate the area select, posts to the
 * placeholder /api/alerts route on submit, and replaces itself in place
 * with a success state. No real backend exists yet; see /api/alerts for
 * the swap-in note.
 */
export function AlertSignupForm({
  defaultZoneId,
  className = "",
}: AlertSignupFormProps) {
  const phoneId = useId();
  const zoneSelectId = useId();
  const smsId = useId();
  const voiceId = useId();
  const langBnId = useId();
  const langEnId = useId();

  const [zones, setZones] = useState<ZoneFeature[] | null>(null);
  const [zonesFailed, setZonesFailed] = useState(false);

  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState(defaultZoneId ?? "");
  const [channels, setChannels] = useState<AlertChannels>({
    sms: true,
    voice: true,
  });
  const [language, setLanguage] = useState<AlertLanguage>("bn");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    areaLabel: string;
    channels: AlertChannels;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/zones")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load zones");
        return response.json() as Promise<ZoneFeatureCollection>;
      })
      .then((data) => {
        if (!cancelled) setZones(data.features);
      })
      .catch(() => {
        if (!cancelled) setZonesFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!zones) return null;
    return {
      erosion: zones.filter((zone) => zone.properties.kind === "erosion"),
      landslide: zones.filter((zone) => zone.properties.kind === "landslide"),
    };
  }, [zones]);

  // The id actually usable right now: the user's own selection, or the
  // pre-filled defaultZoneId once the zone list has loaded and confirms it
  // is real. Derived at render time rather than copied into state with an
  // effect, so an unknown defaultZoneId is simply ignored, per the prop's
  // contract.
  const effectiveZoneId = useMemo(() => {
    if (!zones) return zoneId;
    return zones.some((zone) => zone.properties.id === zoneId) ? zoneId : "";
  }, [zones, zoneId]);

  const selectedZone = useMemo(
    () => zones?.find((zone) => zone.properties.id === effectiveZoneId) ?? null,
    [zones, effectiveZoneId],
  );

  const areaLabel = selectedZone
    ? `${selectedZone.properties.name}, ${selectedZone.properties.district}`
    : AREA_PLACEHOLDER[language];

  const previewText = ALERT_PREVIEW[language](areaLabel);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!PHONE_PATTERN.test(phone)) {
      next.phone =
        "Check this: enter an 11-digit mobile number starting with 01, like 01712345678.";
    }
    if (!effectiveZoneId) {
      next.zoneId = "Check this: choose the area you want alerts for.";
    }
    if (!channels.sms && !channels.voice) {
      next.channels = "Check this: choose at least one way to be reached.";
    }
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: toE164(phone),
          zoneId: effectiveZoneId,
          channels,
          language,
        }),
      });
      if (!response.ok) throw new Error("Signup request failed");
      setSuccess({ areaLabel, channels });
    } catch {
      setSubmitError(
        "Check this: the signup did not go through. Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function addAnotherArea() {
    setSuccess(null);
    setZoneId("");
    setErrors({});
    // Phone, channels and language carry over: the same person is adding
    // a second area, not starting over.
  }

  const containerBase = `max-w-[32rem] bg-surface p-6 sm:p-8 ${className}`;

  if (success) {
    const channelsLabel =
      success.channels.sms && success.channels.voice
        ? "SMS and a Bangla voice call"
        : success.channels.sms
          ? "SMS"
          : "a Bangla voice call";
    return (
      <div className={`${containerBase} border border-rule border-t-2 border-t-ok`}>
        <p className="type-eyebrow text-ok">200 OK</p>
        <h3 className="type-h3 mt-3">You are signed up for alerts.</h3>
        <p className="type-small mt-3 text-ink-muted">
          We will reach you about {success.areaLabel} by {channelsLabel}, the
          moment our engine flags real risk there.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={addAnotherArea}>
            Add another area
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`${containerBase} border border-rule`}
    >
      <SectionLabel>Alerts by SMS and voice call</SectionLabel>

      <div className="mt-6 flex flex-col gap-6">
        <div>
          <label htmlFor={phoneId} className="type-small block font-medium">
            Phone number
          </label>
          <div className="mt-2 flex h-12 rounded-t-xs border-b-[1.5px] border-ink bg-paper">
            <span className="flex items-center pl-3 font-mono text-ink-muted">
              +880
            </span>
            <input
              id={phoneId}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="01712345678"
              maxLength={11}
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value.replace(/\D/g, ""));
                if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
              }}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
              className="type-body min-w-0 flex-1 bg-transparent px-2 outline-none"
            />
          </div>
          <p className="type-meta mt-1 text-ink-subtle">
            We will text and call this number only about risk in your area.
          </p>
          {errors.phone && (
            <p id={`${phoneId}-error`} className="type-small mt-1 text-sev-high-ink">
              {errors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={zoneSelectId} className="type-small block font-medium">
            Your area
          </label>
          <select
            id={zoneSelectId}
            value={effectiveZoneId}
            disabled={!grouped}
            onChange={(event) => {
              setZoneId(event.target.value);
              if (errors.zoneId) setErrors((e) => ({ ...e, zoneId: undefined }));
            }}
            aria-invalid={Boolean(errors.zoneId)}
            aria-describedby={errors.zoneId ? `${zoneSelectId}-error` : undefined}
            className="type-body mt-2 h-12 w-full rounded-t-xs border-b-[1.5px] border-ink bg-paper px-3 disabled:text-ink-subtle"
          >
            <option value="" disabled>
              {zonesFailed
                ? "Areas failed to load"
                : grouped
                  ? "Select your area"
                  : "Loading zone data"}
            </option>
            {grouped && (
              <>
                <optgroup label="Jamuna corridor">
                  {grouped.erosion.map((zone) => (
                    <option key={zone.properties.id} value={zone.properties.id}>
                      {zone.properties.name} ({zone.properties.district})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Chattogram Hill Tracts">
                  {grouped.landslide.map((zone) => (
                    <option key={zone.properties.id} value={zone.properties.id}>
                      {zone.properties.name} ({zone.properties.district})
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
          {zonesFailed && (
            <p className="type-meta mt-1 text-ink-subtle">
              Refresh the page to try loading the area list again.
            </p>
          )}
          {errors.zoneId && (
            <p id={`${zoneSelectId}-error`} className="type-small mt-1 text-sev-high-ink">
              {errors.zoneId}
            </p>
          )}
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="type-small p-0 font-medium">How to reach you</legend>
          <div className="mt-2 flex flex-col gap-2">
            <label htmlFor={smsId} className="type-body flex items-center gap-2">
              <input
                id={smsId}
                type="checkbox"
                checked={channels.sms}
                onChange={(event) => {
                  setChannels((c) => ({ ...c, sms: event.target.checked }));
                  if (errors.channels) setErrors((e) => ({ ...e, channels: undefined }));
                }}
                className="size-4 accent-river"
              />
              SMS
            </label>
            <label htmlFor={voiceId} className="type-body flex items-center gap-2">
              <input
                id={voiceId}
                type="checkbox"
                checked={channels.voice}
                onChange={(event) => {
                  setChannels((c) => ({ ...c, voice: event.target.checked }));
                  if (errors.channels) setErrors((e) => ({ ...e, channels: undefined }));
                }}
                className="size-4 accent-river"
              />
              Bangla voice call
            </label>
          </div>
          {errors.channels && (
            <p className="type-small mt-1 text-sev-high-ink">{errors.channels}</p>
          )}
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="type-small p-0 font-medium">Language</legend>
          <div className="mt-2 flex gap-6">
            <label htmlFor={langBnId} className="type-body flex items-center gap-2">
              <input
                id={langBnId}
                type="radio"
                name="language"
                value="bn"
                checked={language === "bn"}
                onChange={() => setLanguage("bn")}
                className="size-4 accent-river"
              />
              বাংলা
            </label>
            <label htmlFor={langEnId} className="type-body flex items-center gap-2">
              <input
                id={langEnId}
                type="radio"
                name="language"
                value="en"
                checked={language === "en"}
                onChange={() => setLanguage("en")}
                className="size-4 accent-river"
              />
              English
            </label>
          </div>
        </fieldset>

        <div className="bg-well p-4">
          <p className="type-meta text-ink-subtle">This is what your SMS will say:</p>
          <p className="type-meta mt-2 text-ink" lang={language}>
            {previewText}
          </p>
        </div>

        <p className="type-meta text-ink-subtle">
          By submitting, you agree to receive automated SMS and voice alerts
          about risk changes in your selected area. Standard message rates
          may apply.
        </p>

        {submitError && <p className="type-small text-sev-high-ink">{submitError}</p>}

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? "Sending..." : "Get alerts for my area"}
        </Button>
      </div>
    </form>
  );
}
