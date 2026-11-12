/**
 * Which zones have a real satellite evidence pack (built by
 * evidence/scripts/build_evidence.py into public/evidence/<zone>/).
 *
 * Kept apart from packs.ts on purpose: /map's InspectPanel only needs to
 * know whether to offer the evidence link, and importing packs.ts would
 * pull every manifest JSON into the /map client bundle just to answer
 * that. packs.ts types its registry as Record<EvidenceZoneId, ...>, so
 * this list and the real registry cannot drift apart without a type
 * error.
 */
export const EVIDENCE_ZONE_IDS = [
  "zone-cht-teknaf",
  "zone-cht-bandarban-sadar",
  "zone-cht-lama",
  "zone-cht-naikhongchhari",
  "zone-cht-coxsbazar-sadar",
  "zone-cht-ukhiya",
] as const;

export type EvidenceZoneId = (typeof EVIDENCE_ZONE_IDS)[number];

export function hasEvidencePack(zoneId: string): zoneId is EvidenceZoneId {
  return (EVIDENCE_ZONE_IDS as readonly string[]).includes(zoneId);
}
