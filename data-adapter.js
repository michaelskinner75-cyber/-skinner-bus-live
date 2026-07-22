/**
 * Production data adapter plan
 *
 * Static GitHub Pages must not contain private API keys.
 * Recommended architecture:
 * 1. NaPTAN/NPTG: stop names, coordinates and localities.
 * 2. TNDS / Traveline Scotland TransXChange: scheduled services and journeys.
 * 3. An authorised SIRI/GTFS-RT source: live positions and delay information.
 * 4. bustimes.org public API: optional vehicle metadata such as fleet number,
 *    registration, type and livery, subject to its API terms and availability.
 *
 * A small Cloudflare Worker, Netlify Function or similar backend can normalize
 * these feeds and return Stagecoach East Scotland-only JSON to this site.
 */

export async function getDeparturesForStop(atcoCode) {
  throw new Error(`Live data backend not configured for ${atcoCode}`);
}
