/**
 * Route200 UI translations: English/Bangla dictionary for the public web
 * experience's "বাংলা / EN" toggle.
 *
 * Shape: a lightly-nested object, one group per page/section (matching the
 * component that owns the copy), each leaf a stable string id holding
 * { en, bn }. An implementer wires the toggle by reading `t.bn` instead of
 * `t.en` (or `t[locale]`) wherever a component currently hardcodes English
 * JSX text. Grouping mirrors the component tree, not the visual page order,
 * so "which file does this come from" is always one lookup away:
 *
 *   header        -> app/_landing/SiteHeader.tsx
 *   hero          -> app/_landing/Hero.tsx
 *   problem       -> app/_landing/ProblemSection.tsx
 *   howItWorks    -> app/_landing/HowItWorksSchematic.tsx
 *   mapTeaser     -> app/_landing/MapTeaser.tsx
 *   alertsSection -> app/_landing/AlertsSection.tsx (wraps alertForm)
 *   footer        -> app/_landing/Footer.tsx
 *   mapPage       -> app/map/page.tsx and everything under app/map/_components/
 *   alertForm     -> app/alerts/_components/AlertSignupForm.tsx (shared,
 *                    rendered both standalone at /alerts and embedded in
 *                    alertsSection on the landing page)
 *   alertsPage    -> app/alerts/page.tsx (the copy column only; the form
 *                    itself is alertForm)
 *   common        -> strings reused verbatim across 2+ of the groups above
 *                    (zone-group names, "Source", "No data", loading text).
 *                    Prefer these over re-typing the same Bangla twice.
 *
 * Templated strings use plain "{name}" placeholders; interpolate with a
 * simple .replace("{name}", value) at the call site, there is no runtime
 * formatting magic here. For a number that is itself data-driven (a zone
 * count, a severity score, an area in km²), DO NOT bake digits into these
 * templates: pass the number through the existing locale-aware helpers
 * (formatStatNumber / CountUp in app/components/CountUp.tsx, both already
 * take a `locale: "en" | "bn"` option that renders Bengali digits) and
 * splice the formatted result into the template's placeholder. Only
 * strings where the number is fixed, hand-written copy (e.g. "0-100" in a
 * scale caption, "12 zones" in the alerts page's coverage note) carry
 * literal digits here, and those use Bengali digits (০১২৩...) per the
 * project's bn-locale convention. Phone numbers and example phone numbers
 * always stay Latin digits (a global convention Bangla follows too), and
 * so do literal brand/code tokens like "404", "200", "200 OK".
 *
 * Severity-band labels (কম/মাঝারি/উচ্চ/তীব্র) and zone-kind labels
 * (নদীভাঙন/পাহাড়ধস) are NOT duplicated here. They already live in
 * lib/design-tokens.ts as SEVERITY_SHORT_LABEL and ZONE_KIND_LABEL (both
 * already shaped as Record<"en"|"bn", ...>). They were reviewed as part of
 * this translation pass and kept as-is: both are the standard terms used
 * in Bangladeshi media and official hazard communication (CEGIS/BMD style),
 * not stiff or machine-translated. Likewise SeverityScale.tsx's own
 * "alerts sent" / "সতর্কবার্তা" and the "{N}-এর উপরে সতর্কবার্তা" threshold
 * caption are already bilingual inline via that component's `lang` prop,
 * so they are not repeated here either.
 *
 * Zone names: the Bangla zone names used by this dictionary's consumers
 * (the alert form's area select, any Bangla map label, the SMS preview)
 * live on the zone data itself, not here: see the new `nameBn` property on
 * each feature in lib/data/zones.geojson and the corresponding optional
 * `nameBn?: string` field on ZoneProperties in lib/types.ts.
 */

export interface Bilingual {
  en: string;
  bn: string;
}

export const translations = {
  // ---------------------------------------------------------------------
  // common: reused across 2+ sections. Prefer these keys over re-writing
  // the same Bangla text under a page-specific key.
  // ---------------------------------------------------------------------
  common: {
    jamunaCorridor: {
      en: "Jamuna corridor",
      bn: "যমুনা অঞ্চল",
    },
    chattogramHillTracts: {
      en: "Chattogram Hill Tracts",
      bn: "চট্টগ্রাম পার্বত্য অঞ্চল",
    },
    source: {
      en: "Source",
      bn: "সূত্র",
    },
    noData: {
      en: "No data",
      bn: "তথ্য নেই",
    },
    loadingZoneData: {
      en: "Loading zone data",
      bn: "এলাকার তথ্য লোড হচ্ছে",
    },
    loadingZoneDataEllipsis: {
      en: "Loading zone data…",
      bn: "এলাকার তথ্য লোড হচ্ছে…",
    },
    couldNotLoadZoneData: {
      en: "Could not load zone data.",
      bn: "এলাকার তথ্য লোড করা যায়নি।",
    },
    ctaSeeRiskMap: {
      en: "See the risk map",
      bn: "ঝুঁকির মানচিত্র দেখুন",
    },
    ctaGetAlertsForArea: {
      en: "Get alerts for your area",
      bn: "আপনার এলাকার জন্য অ্যালার্ট নিন",
    },
  },

  // ---------------------------------------------------------------------
  // header: app/_landing/SiteHeader.tsx
  // ---------------------------------------------------------------------
  header: {
    // "Route" and "200" are rendered as two separately styled spans
    // ("200" always in the ok/green accent). Kept identical in both
    // languages: Route200 is a proper noun, not translated.
    wordmarkPrefix: { en: "Route", bn: "Route" },
    wordmarkSuffix: { en: "200", bn: "200" },
    navMap: {
      en: "Map",
      bn: "মানচিত্র",
    },
    navGetAlerts: {
      en: "Get alerts",
      bn: "অ্যালার্ট নিন",
    },
    // The toggle control's own label. Shows both scripts regardless of the
    // active locale (it names the two states of the toggle itself, not
    // page content), so it is identical in both columns on purpose.
    langToggle: {
      en: "বাংলা / EN",
      bn: "বাংলা / EN",
    },
  },

  // ---------------------------------------------------------------------
  // hero: app/_landing/Hero.tsx
  // ---------------------------------------------------------------------
  hero: {
    // "404" and "200" kept as Latin digits: they are literal HTTP status
    // codes (the CUET_404 / Route200 brand pairing), a code-like token,
    // not prose numerals.
    headline: {
      en: "From 404 to 200: Bangladesh's climate data finally has a route to you.",
      bn: "404 থেকে 200: বাংলাদেশের জলবায়ু তথ্য এখন সত্যিই আপনার কাছে পৌঁছানোর একটা পথ খুঁজে পেয়েছে।",
    },
    subhead: {
      en: "Route200 turns satellite radar data into a warning that reaches your phone, not just a server.",
      bn: "Route200 স্যাটেলাইট রাডার থেকে পাওয়া তথ্যকে এমন একটা সতর্কবার্তায় বদলে দেয়, যা সার্ভারে আটকে না থেকে পৌঁছে যায় আপনার ফোনে।",
    },
    ctaPrimary: {
      en: "See the risk map",
      bn: "ঝুঁকির মানচিত্র দেখুন",
    },
    ctaSecondary: {
      en: "Get alerts for your area",
      bn: "আপনার এলাকার জন্য অ্যালার্ট নিন",
    },
    sectionLabelLoading: {
      en: "Loading zone data",
      bn: "এলাকার তথ্য লোড হচ্ছে",
    },
    sectionLabelError: {
      en: "Zone data unavailable",
      bn: "এলাকার তথ্য পাওয়া যাচ্ছে না",
    },
    // {count} is the live zone total; splice in via formatStatNumber with
    // the active locale so the digits themselves render correctly too.
    sectionLabelTracking: {
      en: "Tracking {count} zones",
      bn: "{count}টি এলাকা পর্যবেক্ষণে আছে",
    },
    zoneGroupJamuna: {
      en: "Jamuna corridor",
      bn: "যমুনা অঞ্চল",
    },
    zoneGroupHillTracts: {
      en: "Chattogram Hill Tracts",
      bn: "চট্টগ্রাম পার্বত্য অঞ্চল",
    },
    noData: {
      en: "No data",
      bn: "তথ্য নেই",
    },
    // Below-the-fold mobile one-line summary. {count} as above; the
    // optional " · {severeCount} severe" clause is a second template,
    // concatenated only when severeCount > 0 (no English pluralization
    // branch needed in Bangla, one form covers every count).
    mobileSummaryZonesTracked: {
      en: "{count} zones tracked",
      bn: "{count}টি এলাকা পর্যবেক্ষণে",
    },
    mobileSummarySevereSuffix: {
      en: " · {count} severe",
      bn: " · {count}টি তীব্র",
    },
    // The full-width dateline row under the hero.
    datelineJamuna: {
      en: "Jamuna corridor 24.4–25.3°N",
      bn: "যমুনা অঞ্চল ২৪.৪–২৫.৩° উত্তর",
    },
    datelineHillTracts: {
      en: "Chattogram Hill Tracts 21.5–22.2°N",
      bn: "চট্টগ্রাম পার্বত্য অঞ্চল ২১.৫–২২.২° উত্তর",
    },
    // {date} is already locale-formatted text (formatCitationDate's
    // output), so this template only wraps it.
    datelineLatestPass: {
      en: "Latest pass {date}",
      bn: "সর্বশেষ পাস {date}",
    },
    datelineLoading: {
      en: "loading",
      bn: "লোড হচ্ছে",
    },
  },

  // ---------------------------------------------------------------------
  // problem: app/_landing/ProblemSection.tsx
  // ---------------------------------------------------------------------
  problem: {
    sectionLabel: {
      en: "The problem",
      bn: "সমস্যাটা",
    },
    heading: {
      en: "The science exists, and it already works.",
      bn: "বিজ্ঞানটা আছে, আর সেটা কাজও করছে।",
    },
    paragraph1: {
      en: "NASA and ISRO's NISAR mission watches Bangladesh's rivers and hillsides from space. Bangladesh's own CEGIS has tracked the Jamuna's erosion every year since 2004. None of this is hypothetical. The science exists, and it already works.",
      bn: "নাসা আর ইসরোর NISAR মিশন মহাকাশ থেকে বাংলাদেশের নদী আর পাহাড়গুলোর ওপর চোখ রাখছে। বাংলাদেশের নিজের সংস্থা CEGIS তো ২০০৪ সাল থেকে প্রতি বছর যমুনার ভাঙন পর্যবেক্ষণ করে আসছে। এর কোনোটাই কাল্পনিক নয়। বিজ্ঞানটা আছে, আর সেটা কাজও করছে।",
    },
    paragraph2: {
      en: "What doesn't exist is the route from that data to the person standing on the riverbank when it gives way. A UNICEF-Gallup survey from December 2023 found only 37% of Bangladeshi youth could correctly identify the definition of climate change, in one of the most climate-exposed countries on earth.",
      bn: "যা নেই, সেটা হলো এই তথ্য থেকে নদীর পাড়ে দাঁড়িয়ে থাকা মানুষটার কাছে পৌঁছানোর রাস্তা, ঠিক যে মুহূর্তে পাড়টা ভেঙে পড়ে। ২০২৩ সালের ডিসেম্বরে করা ইউনিসেফ-গ্যালাপের এক জরিপে দেখা গেছে, পৃথিবীর সবচেয়ে বেশি জলবায়ু ঝুঁকিতে থাকা দেশগুলোর একটা হয়েও বাংলাদেশের মাত্র ৩৭% তরুণ জলবায়ু পরিবর্তনের সঠিক সংজ্ঞা বলতে পেরেছে।",
    },
    statCegisYearLabel: {
      en: "The year CEGIS began tracking Jamuna erosion every year",
      bn: "যে বছর থেকে CEGIS প্রতি বছর যমুনার ভাঙন পর্যবেক্ষণ শুরু করে",
    },
    statCegisSource: {
      en: "CEGIS",
      bn: "CEGIS",
    },
    statYouthLabel: {
      en: "of Bangladeshi youth could correctly define climate change",
      bn: "বাংলাদেশি তরুণ জলবায়ু পরিবর্তনের সঠিক সংজ্ঞা জানে",
    },
    statYouthSource: {
      en: "UNICEF-Gallup, Dec 2023",
      bn: "ইউনিসেফ-গ্যালাপ, ডিসেম্বর ২০২৩",
    },
    statDeathsLabel: {
      en: "deaths in the July 2026 Chattogram Hill Tracts landslides",
      bn: "২০২৬ সালের জুলাইয়ের চট্টগ্রাম পার্বত্য অঞ্চলের পাহাড়ধসে মৃত্যু",
    },
    statDeathsSource: {
      en: "News reporting, Jul 2026",
      bn: "সংবাদমাধ্যমের তথ্য, জুলাই ২০২৬",
    },
    paragraph3: {
      en: "The July 2026 monsoon landslides across the Chattogram Hill Tracts killed more than fifty people. The data wasn't the surprise. The silence around it was. That gap, between what satellites already see and who gets told, is what Route200 closes.",
      bn: "২০২৬ সালের জুলাইয়ের বর্ষায় চট্টগ্রাম পার্বত্য অঞ্চলে যে পাহাড়ধস হয়েছিল, তাতে পঞ্চাশের বেশি মানুষ প্রাণ হারায়। অবাক করার মতো ছিল না তথ্যটা, অবাক করার মতো ছিল তার চারপাশের নীরবতা। স্যাটেলাইট যা আগে থেকেই দেখতে পায় আর কাকে সেটা জানানো হয়, এই দুটোর মধ্যে যে ফাঁক, Route200 সেই ফাঁকটাই বন্ধ করে।",
    },
    pullQuote: {
      en: "That gap, between what satellites already see and who gets told, is what Route200 closes.",
      bn: "স্যাটেলাইট যা আগে থেকেই দেখতে পায় আর কাকে সেটা জানানো হয়, এই দুটোর মধ্যে যে ফাঁক, Route200 সেই ফাঁকটাই বন্ধ করে।",
    },
  },

  // ---------------------------------------------------------------------
  // howItWorks: app/_landing/HowItWorksSchematic.tsx
  // ---------------------------------------------------------------------
  howItWorks: {
    sectionLabel: {
      en: "How it works",
      bn: "যেভাবে এটা কাজ করে",
    },
    heading: {
      en: "One engine, two tracks.",
      bn: "একটা ইঞ্জিন, দুটো রাস্তা।",
    },
    paragraph1: {
      en: "Satellites like NISAR and Sentinel-1 scan the same riverbank or hillside on repeat passes, in cloud and in clear sky alike, since radar sees through monsoon weather the way an ordinary camera can't. Comparing passes over time reveals where land is eroding or shifting, before it becomes a headline.",
      bn: "NISAR আর Sentinel-1-এর মতো স্যাটেলাইট একই নদীর পাড় বা পাহাড়ি ঢালের ওপর দিয়ে বারবার যায়, মেঘ থাকুক বা পরিষ্কার আকাশ, কারণ রাডার বর্ষার আবহাওয়া ভেদ করে দেখতে পারে, যেটা সাধারণ ক্যামেরা পারে না। সময়ের সাথে এই পাসগুলো তুলনা করলে বোঝা যায় কোথায় মাটি ভাঙছে বা সরে যাচ্ছে, খবরের শিরোনাম হওয়ার আগেই।",
    },
    paragraph2: {
      en: "That single stream of change data feeds two front doors. One is a public map, for anyone curious or affected, showing the change visually. The other is a direct line to risk-zone households: automated SMS and Bangla voice calls, triggered the moment a zone crosses a risk threshold, no map or app needed on the receiving end.",
      bn: "পরিবর্তনের এই একটামাত্র তথ্যস্রোত গিয়ে পড়ে দুটো দরজায়। একটা পাবলিক মানচিত্র, যে কেউ কৌতূহলী হোক বা ঝুঁকিতে থাকুক, পরিবর্তনটা চোখে দেখতে পারে। আরেকটা সরাসরি লাইন ঝুঁকিপূর্ণ এলাকার ঘরে ঘরে, অটোমেটেড SMS আর বাংলা ভয়েস কল, যেই মুহূর্তে কোনো এলাকা ঝুঁকির সীমা পার হয় তখনই পাঠানো হয়, যার কাছে এটা পৌঁছায় তার কোনো মানচিত্র বা অ্যাপের দরকারই নেই।",
    },
    svgAriaLabel: {
      en: "NISAR GCOV and Sentinel-1 GRD feed the change engine, which forks into the public map and SMS plus Bangla voice call.",
      bn: "NISAR GCOV আর Sentinel-1 GRD চেঞ্জ ইঞ্জিনে তথ্য দেয়, যা থেকে বেরিয়ে আসে পাবলিক মানচিত্র আর SMS ও বাংলা ভয়েস কল।",
    },
    // Node labels inside the inline SVG schematic. NISAR GCOV / Sentinel-1
    // GRD are real scene-type proper nouns, not translated.
    nodeNisar: { en: "NISAR GCOV", bn: "NISAR GCOV" },
    nodeSentinel: { en: "Sentinel-1 GRD", bn: "Sentinel-1 GRD" },
    nodeEngine: { en: "Change engine", bn: "পরিবর্তন ইঞ্জিন" },
    nodePublicMap: { en: "Public map", bn: "পাবলিক মানচিত্র" },
    nodeAlert: { en: "SMS + Bangla voice call", bn: "SMS + বাংলা ভয়েস কল" },
  },

  // ---------------------------------------------------------------------
  // mapTeaser: app/_landing/MapTeaser.tsx
  // ---------------------------------------------------------------------
  mapTeaser: {
    sectionLabel: {
      en: "The map",
      bn: "মানচিত্র",
    },
    step1: {
      en: "Open the map and the Jamuna isn't a static blue line. It's a river caught mid-motion, bank lines from different years laid over each other so you can watch, in minutes, erosion that actually unfolded over seasons. In the Chattogram Hill Tracts, slopes are shaded by how much ground has shifted, the kind of movement that preceded the 2026 monsoon landslides.",
      bn: "মানচিত্রটা খুললে যমুনাকে আর একটা স্থির নীল রেখার মতো মনে হবে না। এটা যেন ঠিক চলমান অবস্থায় ধরা একটা নদী, বিভিন্ন বছরের পাড়ের রেখা একটার ওপর আরেকটা বসিয়ে দেখানো, যাতে আপনি মিনিটের মধ্যেই দেখতে পারেন সেই ভাঙন, যা আসলে কেটেছে পুরো কয়েকটা মরসুম ধরে। চট্টগ্রাম পার্বত্য অঞ্চলে পাহাড়ের ঢালগুলোকে রং করা হয়েছে মাটি কতটা সরেছে তার ভিত্তিতে, ঠিক সেই রকম সরে যাওয়া যা ২০২৬-এর বর্ষার পাহাড়ধসের আগে দেখা গিয়েছিল।",
    },
    step2: {
      en: "If your village sits on a Jamuna char, or your family's land is on a Chattogram hillside, this map is the closest thing to watching your own risk from orbit, in your own language.",
      bn: "আপনার গ্রাম যদি যমুনার কোনো চরে হয়, বা আপনার পরিবারের জমি থাকে চট্টগ্রামের কোনো পাহাড়ি ঢালে, তাহলে এই মানচিত্রই সবচেয়ে কাছের জায়গা, যেখান থেকে আপনি মহাকাশ থেকে নিজের ঝুঁকিটা নিজের ভাষায় দেখতে পারবেন।",
    },
    severityScaleTitle: {
      en: "Change severity, engine score 0–100",
      bn: "পরিবর্তনের তীব্রতা, ইঞ্জিন স্কোর ০–১০০",
    },
    cta: {
      en: "See the risk map",
      bn: "ঝুঁকির মানচিত্র দেখুন",
    },
  },

  // ---------------------------------------------------------------------
  // alertsSection: app/_landing/AlertsSection.tsx (copy only; the embedded
  // form itself is the alertForm group below)
  // ---------------------------------------------------------------------
  alertsSection: {
    sectionLabel: {
      en: "Get alerts",
      bn: "অ্যালার্ট নিন",
    },
    heading: {
      en: "Get alerts for your area",
      bn: "আপনার এলাকার জন্য অ্যালার্ট নিন",
    },
    paragraph: {
      en: "If you live in a zone we're tracking, you don't need a smartphone, an app, or a data plan to find out when the ground under you starts changing. Give us a phone number and your area, and when our engine flags real risk there, we send a text and place a Bangla voice call, the same way an ordinary phone call already reaches you. No install, no login, no catch.",
      bn: "আমরা যে এলাকাগুলো পর্যবেক্ষণ করি, তার কোনোটায় আপনি থাকলে, আপনার পায়ের নিচের মাটি বদলাতে শুরু করলে সেটা জানার জন্য স্মার্টফোন, অ্যাপ বা ইন্টারনেট প্যাকেজ কোনোটাই লাগবে না। আমাদের একটা ফোন নম্বর আর আপনার এলাকার নাম দিন, আর আমাদের ইঞ্জিন যখন সেখানে সত্যিকারের ঝুঁকি দেখবে, তখন আমরা একটা মেসেজ পাঠাব আর একটা বাংলা ভয়েস কল করব, ঠিক যেভাবে একটা সাধারণ ফোন কল এমনিতেই আপনার কাছে পৌঁছে যায়। কোনো ইনস্টল নেই, লগইন নেই, কোনো শর্তও নেই।",
    },
  },

  // ---------------------------------------------------------------------
  // footer: app/_landing/Footer.tsx
  // ---------------------------------------------------------------------
  footer: {
    heading: {
      en: "A 404 means the road was never built, not that the destination doesn't exist.",
      bn: "404 মানে এই না যে গন্তব্যটা নেই, এর মানে হলো সেই রাস্তাটাই কখনো বানানো হয়নি।",
    },
    paragraph: {
      en: "Route200 is that road: from the data already orbiting above Bangladesh to the people standing on the ground it's about.",
      bn: "Route200 সেই রাস্তাটাই: বাংলাদেশের আকাশে ঘুরতে থাকা তথ্য থেকে শুরু করে, ঠিক যাদের কথা বলা হচ্ছে সেই মানুষগুলো পর্যন্ত, যারা দাঁড়িয়ে আছে মাটিতে।",
    },
    ctaPrimary: {
      en: "See the risk map",
      bn: "ঝুঁকির মানচিত্র দেখুন",
    },
    ctaSecondary: {
      en: "Get alerts for your area",
      bn: "আপনার এলাকার জন্য অ্যালার্ট নিন",
    },
    creditsData: {
      en: "Data: NASA/ISRO NISAR, ESA Copernicus Sentinel-1, CEGIS, OpenStreetMap contributors via OpenFreeMap.",
      bn: "তথ্যসূত্র: NASA/ISRO NISAR, ESA Copernicus Sentinel-1, CEGIS এবং OpenFreeMap-এর মাধ্যমে OpenStreetMap কন্ট্রিবিউটররা।",
    },
    creditsTeam: {
      en: "Built by team CUET_404 for NASA Space Apps Challenge 2026.",
      bn: "তৈরি করেছে টিম CUET_404, NASA Space Apps Challenge 2026-এর জন্য।",
    },
  },

  // ---------------------------------------------------------------------
  // mapPage: app/map/page.tsx and app/map/_components/*
  // ---------------------------------------------------------------------
  mapPage: {
    // page.tsx metadata
    metaTitle: {
      en: "Risk map",
      bn: "ঝুঁকির মানচিত্র",
    },
    metaDescription: {
      en: "Jamuna corridor erosion and Chattogram Hill Tracts landslide zones, from satellite change detection.",
      bn: "যমুনা অঞ্চলের নদী ভাঙন আর চট্টগ্রাম পার্বত্য অঞ্চলের পাহাড়ধস এলাকা, স্যাটেলাইট পরিবর্তন সনাক্তকরণের মাধ্যমে।",
    },
    loadingShell: {
      en: "Loading zone data…",
      bn: "এলাকার তথ্য লোড হচ্ছে…",
    },
    // MapExperience.tsx error/loading states
    errorHeading: {
      en: "Could not load zone data.",
      bn: "এলাকার তথ্য লোড করা যায়নি।",
    },
    // The underlying thrown-error message, surfaced verbatim below the
    // heading above (useMapData.ts). Both of its possible values:
    errorServiceDidNotRespond: {
      en: "The map data service did not respond.",
      bn: "ম্যাপ ডেটা সার্ভিস সাড়া দেয়নি।",
    },
    errorFallback: {
      en: "Could not load zone data.",
      bn: "এলাকার তথ্য লোড করা যায়নি।",
    },
    loading: {
      en: "Loading zone data…",
      bn: "এলাকার তথ্য লোড হচ্ছে…",
    },
    // Mobile sheet "peek" summary. {count} and {severeCount} are
    // locale-formatted numbers; no singular/plural branch needed for bn.
    summaryZonesTracked: {
      en: "{count} zones tracked",
      bn: "{count}টি এলাকা পর্যবেক্ষণে",
    },
    summarySevereSuffix: {
      en: " · {count} severe",
      bn: " · {count}টি তীব্র",
    },
    // ZoneRail.tsx
    heading: {
      en: "Risk map",
      bn: "ঝুঁকির মানচিত্র",
    },
    latestPass: {
      en: "Latest pass {date}",
      bn: "সর্বশেষ পাস {date}",
    },
    // ZoneListPanel.tsx
    kindFilterAll: {
      en: "All",
      bn: "সব",
    },
    kindFilterGroupAriaLabel: {
      en: "Filter zones by kind",
      bn: "ধরন অনুযায়ী এলাকা ফিল্টার করুন",
    },
    severityScaleZonesTitle: {
      en: "Zones",
      bn: "এলাকা",
    },
    // DateRangeSlider.tsx
    dateWindowLabel: {
      en: "Date window",
      bn: "তারিখের সীমা",
    },
    dateWindowStartAriaLabel: {
      en: "Window start date",
      bn: "শুরুর তারিখ",
    },
    dateWindowEndAriaLabel: {
      en: "Window end date",
      bn: "শেষের তারিখ",
    },
    // InspectPanel.tsx
    backToAllZones: {
      en: "← All zones",
      bn: "← সব এলাকা",
    },
    noDataInWindow: {
      en: "No data in this window",
      bn: "এই সময়সীমায় কোনো তথ্য নেই",
    },
    areaChangedLabel: {
      en: "Area changed in this window",
      bn: "এই সময়সীমায় পরিবর্তিত এলাকা",
    },
    noEventInWindow: {
      en: "No change event from this zone falls in the selected date window. Widen the window to see its recorded history.",
      bn: "নির্বাচিত সময়সীমার মধ্যে এই এলাকার কোনো পরিবর্তনের ঘটনা পড়ছে না। এর রেকর্ড করা ইতিহাস দেখতে সময়সীমাটা বাড়িয়ে দেখুন।",
    },
    // {count} is zone.properties.registeredAlertCount, locale-formatted.
    registeredAlertCount: {
      en: "{count} registered for alerts in this zone.",
      bn: "এই এলাকায় অ্যালার্টের জন্য নিবন্ধিত আছে {count} জন।",
    },
    decisionSupportNote: {
      en: "Decision support, not a forecast.",
      bn: "সিদ্ধান্ত নেওয়ার সহায়ক তথ্য, পূর্বাভাস নয়।",
    },
    getAlertsForThisZone: {
      en: "Get alerts for this zone",
      bn: "এই এলাকার জন্য অ্যালার্ট নিন",
    },
    // StripChart.tsx
    noEventsRecorded: {
      en: "No change events recorded yet for this zone.",
      bn: "এই এলাকার জন্য এখনো কোনো পরিবর্তনের ঘটনা রেকর্ড করা হয়নি।",
    },
    changeSeverityOverTime: {
      en: "Change severity over time",
      bn: "সময়ের সাথে পরিবর্তনের তীব্রতা",
    },
    // {start} and {end} are already formatCitationDate output.
    stripChartAriaLabel: {
      en: "Severity score for each recorded change event, from {start} to {end}.",
      bn: "প্রতিটা রেকর্ড করা পরিবর্তনের ঘটনার তীব্রতার স্কোর, {start} থেকে {end} পর্যন্ত।",
    },
    // FloatingControls.tsx
    zoomIn: {
      en: "Zoom in",
      bn: "জুম ইন",
    },
    zoomOut: {
      en: "Zoom out",
      bn: "জুম আউট",
    },
    // MobileSheet.tsx
    resizeZonePanel: {
      en: "Resize the zone panel",
      bn: "এলাকার প্যানেলের আকার পরিবর্তন করুন",
    },
  },

  // ---------------------------------------------------------------------
  // alertForm: app/alerts/_components/AlertSignupForm.tsx. Shared between
  // the standalone /alerts page and the landing page's alertsSection.
  // ---------------------------------------------------------------------
  alertForm: {
    sectionLabel: {
      en: "Alerts by SMS and voice call",
      bn: "SMS আর ভয়েস কলে অ্যালার্ট",
    },
    phoneNumberLabel: {
      en: "Phone number",
      bn: "ফোন নম্বর",
    },
    phoneHelperText: {
      en: "We will text and call this number only about risk in your area.",
      bn: "আমরা শুধু আপনার এলাকার ঝুঁকি নিয়েই এই নম্বরে মেসেজ আর কল করব।",
    },
    // The 11-digit count is a word ("১১"), not part of the phone number
    // itself, so it takes a Bengali digit; the "01" prefix and the example
    // number are literal phone-number text and stay Latin digits.
    phoneErrorFormat: {
      en: "Check this: enter an 11-digit mobile number starting with 01, like 01712345678.",
      bn: "এটা দেখুন: 01 দিয়ে শুরু হওয়া ১১ ডিজিটের মোবাইল নম্বর দিন, যেমন 01712345678।",
    },
    yourAreaLabel: {
      en: "Your area",
      bn: "আপনার এলাকা",
    },
    zoneErrorRequired: {
      en: "Check this: choose the area you want alerts for.",
      bn: "এটা দেখুন: যে এলাকার জন্য অ্যালার্ট চান, সেটা বেছে নিন।",
    },
    areasFailedToLoad: {
      en: "Areas failed to load",
      bn: "এলাকার তালিকা লোড করা যায়নি",
    },
    selectYourArea: {
      en: "Select your area",
      bn: "আপনার এলাকা বেছে নিন",
    },
    loadingZoneData: {
      en: "Loading zone data",
      bn: "এলাকার তথ্য লোড হচ্ছে",
    },
    refreshToRetryAreas: {
      en: "Refresh the page to try loading the area list again.",
      bn: "তালিকাটা আবার লোড করতে পেজ রিফ্রেশ করুন।",
    },
    optgroupJamuna: {
      en: "Jamuna corridor",
      bn: "যমুনা অঞ্চল",
    },
    optgroupHillTracts: {
      en: "Chattogram Hill Tracts",
      bn: "চট্টগ্রাম পার্বত্য অঞ্চল",
    },
    howToReachYouLegend: {
      en: "How to reach you",
      bn: "কীভাবে যোগাযোগ করব",
    },
    // "SMS" kept as-is, a technical/brand term encountered in Latin script
    // even in everyday spoken Bangla.
    channelSms: { en: "SMS", bn: "SMS" },
    channelVoice: {
      en: "Bangla voice call",
      bn: "বাংলা ভয়েস কল",
    },
    channelsErrorRequired: {
      en: "Check this: choose at least one way to be reached.",
      bn: "এটা দেখুন: অন্তত একটা মাধ্যম বেছে নিন, যেভাবে আপনার সাথে যোগাযোগ করা যাবে।",
    },
    languageLegend: {
      en: "Language",
      bn: "ভাষা",
    },
    // The Bangla option's own label is "বাংলা" in both UI languages (a
    // language naming itself in its own script); only the English option's
    // label changes between locales.
    languageOptionBn: { en: "বাংলা", bn: "বাংলা" },
    languageOptionEn: { en: "English", bn: "ইংরেজি" },
    smsPreviewIntro: {
      en: "This is what your SMS will say:",
      bn: "আপনার SMS-এ এটাই লেখা থাকবে:",
    },
    consentText: {
      en: "By submitting, you agree to receive automated SMS and voice alerts about risk changes in your selected area. Standard message rates may apply.",
      bn: "সাবমিট করার মাধ্যমে আপনি রাজি হচ্ছেন যে আপনার বেছে নেওয়া এলাকার ঝুঁকি পরিবর্তনের অটোমেটেড SMS আর ভয়েস অ্যালার্ট পাবেন। স্ট্যান্ডার্ড মেসেজ রেট প্রযোজ্য হতে পারে।",
    },
    submitErrorGeneric: {
      en: "Check this: the signup did not go through. Try again in a moment.",
      bn: "এটা দেখুন: সাইনআপ সম্পন্ন হয়নি। একটু পর আবার চেষ্টা করুন।",
    },
    submitSending: {
      en: "Sending...",
      bn: "পাঠানো হচ্ছে...",
    },
    submitDefault: {
      en: "Get alerts for my area",
      bn: "আমার এলাকার জন্য অ্যালার্ট নিন",
    },
    // Success state. "200 OK" is kept as-is in both: a literal HTTP status
    // code echoing the Route200 brand, not prose.
    successEyebrow: { en: "200 OK", bn: "200 OK" },
    successHeading: {
      en: "You are signed up for alerts.",
      bn: "আপনি অ্যালার্টের জন্য নিবন্ধিত হয়ে গেছেন।",
    },
    // {area} is the selected zone's label (name + district); {channelsLabel}
    // is one of the three successChannelsX entries below.
    successBody: {
      en: "We will reach you about {area} by {channelsLabel}, the moment our engine flags real risk there.",
      bn: "আমাদের ইঞ্জিন যখনই {area}-এ সত্যিকারের ঝুঁকি দেখবে, তখনই আমরা {channelsLabel}-এর মাধ্যমে আপনার কাছে পৌঁছে যাব।",
    },
    successChannelsBoth: {
      en: "SMS and a Bangla voice call",
      bn: "SMS আর বাংলা ভয়েস কল",
    },
    successChannelsSmsOnly: {
      en: "SMS",
      bn: "SMS",
    },
    successChannelsVoiceOnly: {
      en: "a Bangla voice call",
      bn: "বাংলা ভয়েস কল",
    },
    addAnotherArea: {
      en: "Add another area",
      bn: "আরেকটা এলাকা যুক্ত করুন",
    },
    // The area placeholder shown before a zone is selected, used inside the
    // SMS preview sentence below. Already implemented bilingually inline
    // in AlertSignupForm.tsx's AREA_PLACEHOLDER constant; mirrored here so
    // this file is a complete reference of every string in the form.
    areaPlaceholder: {
      en: "your area",
      bn: "আপনার এলাকা",
    },
    // The SMS preview sentence template. {area} is either a real zone's
    // "{name}, {district}" or areaPlaceholder above. Already implemented
    // bilingually inline in AlertSignupForm.tsx's ALERT_PREVIEW constant;
    // mirrored here for the same reason as areaPlaceholder. Reviewed as
    // part of this pass and kept as-is: natural, not machine-translated.
    smsPreviewTemplate: {
      en: "Route200 alert: {area} has crossed the risk threshold. Open the map for details, or wait for our voice call. Reply STOP to unsubscribe.",
      bn: "Route200 সতর্কতা: {area}-এ ঝুঁকির সীমা অতিক্রম করেছে। বিস্তারিত জানতে মানচিত্র দেখুন, নয়তো আমাদের ফোন কলের জন্য অপেক্ষা করুন। বন্ধ করতে উত্তরে STOP লিখুন।",
    },
  },

  // ---------------------------------------------------------------------
  // alertsPage: app/alerts/page.tsx (the copy column; the form is
  // alertForm above, rendered unchanged on this page)
  // ---------------------------------------------------------------------
  alertsPage: {
    metaTitle: {
      en: "Get alerts",
      bn: "অ্যালার্ট নিন",
    },
    metaDescription: {
      en: "Sign up for SMS and Bangla voice alerts when Route200's engine flags real risk in your area.",
      bn: "Route200-এর ইঞ্জিন আপনার এলাকায় সত্যিকারের ঝুঁকি দেখলে, SMS আর বাংলা ভয়েস অ্যালার্টের জন্য সাইনআপ করুন।",
    },
    sectionLabel: {
      en: "Get alerts",
      bn: "অ্যালার্ট নিন",
    },
    heading: {
      en: "Get alerts for your area",
      bn: "আপনার এলাকার জন্য অ্যালার্ট নিন",
    },
    lede: {
      en: "If you live in a zone we are tracking, you do not need a smartphone, an app, or a data plan to find out when the ground under you starts changing.",
      bn: "আমরা যে এলাকাগুলো পর্যবেক্ষণ করি, তার কোনোটায় থাকলে, আপনার পায়ের নিচের মাটি বদলাতে শুরু করলে সেটা জানার জন্য স্মার্টফোন, অ্যাপ বা ইন্টারনেট প্যাকেজের দরকার নেই।",
    },
    paragraph1: {
      en: "Give us a phone number and your area. When our engine flags real risk there, the same threshold that marks a zone severe on the public map, we send a text and place a Bangla voice call, the same way an ordinary phone call already reaches you.",
      bn: "আমাদের একটা ফোন নম্বর আর আপনার এলাকার নাম দিন। আমাদের ইঞ্জিন যখন সেখানে সত্যিকারের ঝুঁকি দেখবে, ঠিক যে সীমাটা পাবলিক মানচিত্রে একটা এলাকাকে তীব্র বলে চিহ্নিত করে, তখন আমরা একটা মেসেজ পাঠাব আর একটা বাংলা ভয়েস কল করব, ঠিক যেভাবে একটা সাধারণ ফোন কল এমনিতেই আপনার কাছে পৌঁছায়।",
    },
    paragraph2: {
      en: "There is no install, no login, and no cost beyond your own phone plan. One signup covers both channels by default: a text to read and a voice call to hear, in Bangla or English, whichever reaches you better. Add a second area later, for example a family home in a different zone.",
      bn: "কোনো ইনস্টল নেই, লগইন নেই, নিজের ফোন প্ল্যানের বাইরে কোনো খরচও নেই। একবার সাইনআপ করলেই ডিফল্টভাবে দুটো মাধ্যমই পাবেন, পড়ার জন্য একটা মেসেজ আর শোনার জন্য একটা ভয়েস কল, বাংলা বা ইংরেজিতে, যেটা আপনার জন্য সহজ। পরে আরেকটা এলাকাও যুক্ত করতে পারবেন, যেমন অন্য কোনো এলাকায় থাকা পরিবারের বাড়ি।",
    },
    // "12" is literal hand-written copy (not a live count), so it takes a
    // Bengali digit like the rest of this sentence.
    coverageNote: {
      en: "Covers all 12 zones we track: the Jamuna corridor and the Chattogram Hill Tracts.",
      bn: "আমরা পর্যবেক্ষণ করা সব ১২টা এলাকাই এখানে আছে: যমুনা অঞ্চল আর চট্টগ্রাম পার্বত্য অঞ্চল।",
    },
    ctaSeeMapFirst: {
      en: "See the risk map first",
      bn: "আগে ঝুঁকির মানচিত্রটা দেখুন",
    },
  },
} as const;

export type Translations = typeof translations;
