"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Button, SectionLabel } from "@/app/components";
import { format, t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import type { ZoneFeature, ZoneFeatureCollection, ZoneProperties } from "@/lib/types";

export type AlertChannels = {
  sms: boolean;
  voice: boolean;
};

export type AlertLanguage = Locale;

export type AlertSignupFormProps = {
  /** The page's resolved UI locale (DESIGN_SPEC.md's cookie-based toggle),
   *  passed down from a server-rendered parent. Drives every static label,
   *  legend, button and message in this form. Also seeds the "Language"
   *  radio's initial value below, since that field starts out matching
   *  whatever language the visitor is already browsing in, though it
   *  stays independently changeable (a household may want Bangla voice
   *  calls while browsing the site in English, or the reverse). */
  locale: Locale;
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

/** The area select's own option text: the zone's Bangla name alone when
 *  the UI locale is Bangla (it already reads as a complete, natural
 *  phrase, locality included), "{name} ({district})" otherwise. */
function zoneOptionLabel(properties: ZoneProperties, locale: Locale): string {
  if (locale === "bn" && properties.nameBn) return properties.nameBn;
  return `${properties.name} (${properties.district})`;
}

/** The area name as it reads inside a sentence (the SMS preview, the
 *  success message): the zone's Bangla name alone in Bangla (same reason
 *  as above), "{name}, {district}" otherwise. Takes whichever language
 *  context the surrounding sentence is actually in, which is the alert
 *  recipient's chosen `language` for the SMS preview and the page's own
 *  `locale` for the success state, not always the same value. This is the
 *  actual fix for the QA-flagged issue where the Bangla SMS preview
 *  spliced a raw English zone name into a Bangla sentence.
 */
function zoneSentenceLabel(properties: ZoneProperties, lang: Locale): string {
  if (lang === "bn" && properties.nameBn) return properties.nameBn;
  return `${properties.name}, ${properties.district}`;
}

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
  locale,
  defaultZoneId,
  className = "",
}: AlertSignupFormProps) {
  const copy = translations.alertForm;
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
  const [language, setLanguage] = useState<AlertLanguage>(locale);

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

  const previewAreaLabel = selectedZone
    ? zoneSentenceLabel(selectedZone.properties, language)
    : t(copy.areaPlaceholder, language);

  const previewText = format(t(copy.smsPreviewTemplate, language), {
    area: previewAreaLabel,
  });

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!PHONE_PATTERN.test(phone)) {
      next.phone = t(copy.phoneErrorFormat, locale);
    }
    if (!effectiveZoneId) {
      next.zoneId = t(copy.zoneErrorRequired, locale);
    }
    if (!channels.sms && !channels.voice) {
      next.channels = t(copy.channelsErrorRequired, locale);
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
      setSuccess({
        areaLabel: selectedZone
          ? zoneSentenceLabel(selectedZone.properties, locale)
          : t(copy.areaPlaceholder, locale),
        channels,
      });
    } catch {
      setSubmitError(t(copy.submitErrorGeneric, locale));
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
        ? t(copy.successChannelsBoth, locale)
        : success.channels.sms
          ? t(copy.successChannelsSmsOnly, locale)
          : t(copy.successChannelsVoiceOnly, locale);
    return (
      <div className={`${containerBase} border border-rule border-t-2 border-t-ok`}>
        <p className="type-eyebrow text-ok">{t(copy.successEyebrow, locale)}</p>
        <h3 className="type-h3 mt-3">{t(copy.successHeading, locale)}</h3>
        <p className="type-small mt-3 text-ink-muted">
          {format(t(copy.successBody, locale), {
            area: success.areaLabel,
            channelsLabel,
          })}
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={addAnotherArea}>
            {t(copy.addAnotherArea, locale)}
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
      <SectionLabel>{t(copy.sectionLabel, locale)}</SectionLabel>

      <div className="mt-6 flex flex-col gap-6">
        <div>
          <label htmlFor={phoneId} className="type-small block font-medium">
            {t(copy.phoneNumberLabel, locale)}
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
          <p className="type-meta mt-1 text-ink-subtle">{t(copy.phoneHelperText, locale)}</p>
          {errors.phone && (
            <p id={`${phoneId}-error`} className="type-small mt-1 text-sev-high-ink">
              {errors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={zoneSelectId} className="type-small block font-medium">
            {t(copy.yourAreaLabel, locale)}
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
                ? t(copy.areasFailedToLoad, locale)
                : grouped
                  ? t(copy.selectYourArea, locale)
                  : t(copy.loadingZoneData, locale)}
            </option>
            {grouped && (
              <>
                <optgroup label={t(copy.optgroupJamuna, locale)}>
                  {grouped.erosion.map((zone) => (
                    <option key={zone.properties.id} value={zone.properties.id}>
                      {zoneOptionLabel(zone.properties, locale)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t(copy.optgroupHillTracts, locale)}>
                  {grouped.landslide.map((zone) => (
                    <option key={zone.properties.id} value={zone.properties.id}>
                      {zoneOptionLabel(zone.properties, locale)}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
          {zonesFailed && (
            <p className="type-meta mt-1 text-ink-subtle">{t(copy.refreshToRetryAreas, locale)}</p>
          )}
          {errors.zoneId && (
            <p id={`${zoneSelectId}-error`} className="type-small mt-1 text-sev-high-ink">
              {errors.zoneId}
            </p>
          )}
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="type-small p-0 font-medium">{t(copy.howToReachYouLegend, locale)}</legend>
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
              {t(copy.channelSms, locale)}
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
              {t(copy.channelVoice, locale)}
            </label>
          </div>
          {errors.channels && (
            <p className="type-small mt-1 text-sev-high-ink">{errors.channels}</p>
          )}
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="type-small p-0 font-medium">{t(copy.languageLegend, locale)}</legend>
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
              {t(copy.languageOptionBn, locale)}
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
              {t(copy.languageOptionEn, locale)}
            </label>
          </div>
        </fieldset>

        <div className="bg-well p-4">
          <p className="type-meta text-ink-subtle">{t(copy.smsPreviewIntro, locale)}</p>
          <p className="type-meta mt-2 text-ink" lang={language}>
            {previewText}
          </p>
        </div>

        <p className="type-meta text-ink-subtle">{t(copy.consentText, locale)}</p>

        {submitError && <p className="type-small text-sev-high-ink">{submitError}</p>}

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? t(copy.submitSending, locale) : t(copy.submitDefault, locale)}
        </Button>
      </div>
    </form>
  );
}
