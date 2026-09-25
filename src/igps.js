// =============================================================================
// IGPS data adapter — Industrial Fire & Flare Intelligence
// -----------------------------------------------------------------------------
// EVERYTHING IN THIS FILE IS DEMO DATA, deterministically generated so the UI
// is stable across reloads. It exists so the frontend can be built and shown
// end-to-end *before* the backend ships the real endpoints.
//
// When the backend is ready, replace the body of each exported function with
// a real `fetch(...)` call to the matching endpoint (see the comment above
// each function) and keep the same function signature / return shape. No
// component needs to change.
// =============================================================================

import { API_BASE_URL } from "./api";

export const IGPS_CLASSES = [
  { id: "industrial_flare", label: "Industrial flare", tone: "coral" },
  { id: "offshore_platform", label: "Offshore platform", tone: "blue" },
  { id: "industrial_thermal", label: "Industrial thermal source", tone: "amber" },
  { id: "agricultural_burn", label: "Agricultural burn", tone: "mint" },
  { id: "forest_wildfire", label: "Forest wildfire", tone: "violet" },
];

export const CORROBORATION_SOURCES = [
  { id: "GEM", label: "Global Energy Monitor" },
  { id: "OSM", label: "OpenStreetMap" },
  { id: "WRI", label: "WRI Global Power Plant Database" },
  { id: "NOAA_EOG", label: "NOAA EOG Global Flare Inventory" },
];

export const TIERS = ["A", "B", "C", "D"];

// --- tiny deterministic PRNG so the demo dataset is stable across reloads ---
function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const classWeights = [
  ["industrial_flare", 0.14],
  ["offshore_platform", 0.05],
  ["industrial_thermal", 0.19],
  ["agricultural_burn", 0.36],
  ["forest_wildfire", 0.26],
];

function pickClass(rng) {
  const roll = rng();
  let acc = 0;
  for (const [id, weight] of classWeights) {
    acc += weight;
    if (roll <= acc) return id;
  }
  return "agricultural_burn";
}

function tierFromProbability(p) {
  if (p >= 0.9) return "A";
  if (p >= 0.75) return "B";
  if (p >= 0.55) return "C";
  return "D";
}

const FACILITY_NAME_PARTS = {
  industrial_flare: ["Refinery", "Gas Terminal", "Cracker Unit", "LNG Facility"],
  offshore_platform: ["Offshore Platform", "FPSO", "Drilling Rig"],
  industrial_thermal: ["Steel Mill", "Cement Works", "Power Plant", "Smelter"],
  agricultural_burn: ["Farm Block", "Crop Residue Zone"],
  forest_wildfire: ["Forest Range", "Reserve Block"],
};

const PLACE_NAMES = [
  "Jamnagar", "Hazira", "Vadodara", "Vizag", "Paradip", "Kandla", "Haldia",
  "Mangalore", "Chennai", "Ennore", "Barmer", "Bina", "Bokaro", "Durgapur",
  "Rourkela", "Bhilai", "Korba", "Singrauli", "Ramagundam", "Neyveli",
  "Kutch", "Sundarbans", "Nilgiris", "Similipal", "Kanha", "Bandipur",
];

function buildFeatures(rng, cls) {
  const isIndustrial = cls !== "agricultural_burn" && cls !== "forest_wildfire";
  const frp = 5 + rng() * (isIndustrial ? 90 : 45);
  return {
    "FIRMS raw + derived": [
      ["confidence", `${Math.round(60 + rng() * 39)} / 100`],
      ["satellite / instrument", rng() > 0.5 ? "NOAA-20 / VIIRS" : "Suomi-NPP / VIIRS"],
      ["frp", `${frp.toFixed(1)} MW`],
      ["log_frp", Math.log10(frp).toFixed(2)],
      ["frp_per_km2", (frp / (10 + rng() * 40)).toFixed(2)],
      ["bright_ti31", `${(320 + rng() * 40).toFixed(1)} K`],
      ["is_high_confidence", rng() > 0.3 ? "YES" : "NO"],
      ["scan / track", `${rng().toFixed(2)} / ${rng().toFixed(2)}`],
    ],
    "Temporal recurrence + trend": [
      ["count_detections_30d", Math.round(rng() * 30)],
      ["count_detections_365d", Math.round(rng() * 300)],
      ["days_active_365d", Math.round(rng() * 365)],
      ["time_since_last", `${Math.round(rng() * 96)} h`],
      ["mean_frp_last_5", (frp * (0.7 + rng() * 0.3)).toFixed(1)],
      ["frp_trend_5", `${(rng() * 20 - 5).toFixed(1)} MW / step`],
      ["frp_zscore_current", (rng() * 3 - 1).toFixed(2)],
      ["month_entropy", rng().toFixed(2)],
    ],
    "OSM spatial context": [
      ["inside_industrial_polygon", isIndustrial && rng() > 0.25 ? "YES" : "NO"],
      ["distance_industrial_m", Math.round(rng() * (isIndustrial ? 500 : 6000))],
      ["count_industrial_1km", Math.round(rng() * (isIndustrial ? 20 : 2))],
      ["distance_residential_m", Math.round(300 + rng() * 5000)],
      ["landuse_majority_1km", isIndustrial ? "Industrial" : cls === "agricultural_burn" ? "Agricultural" : "Forest"],
      ["osm_completeness_band", rng() > 0.5 ? "High" : "Low"],
    ],
    "Satellite patch + cluster": [
      ["mean_nbr", (rng() * 0.5 - 0.1).toFixed(2)],
      ["delta_nbr", (rng() * -0.4).toFixed(2)],
      ["mean_ndvi", (isIndustrial ? rng() * 0.2 : 0.3 + rng() * 0.4).toFixed(2)],
      ["mean_ndbi", (isIndustrial ? 0.4 + rng() * 0.3 : rng() * 0.2).toFixed(2)],
      ["max_bt_patch", `${(330 + rng() * 45).toFixed(0)} K`],
      ["hot_pixels", Math.round(rng() * 15)],
      ["cluster_area_km2", (rng() * 2.5).toFixed(2)],
    ],
    "Rule flags": [
      ["is_persistent_candidate", rng() > 0.5 ? "YES" : "NO"],
      ["is_sudden_onset", rng() > 0.6 ? "YES" : "NO"],
      ["is_industrial_context", isIndustrial ? "YES" : "NO"],
      ["is_likely_flare", cls === "industrial_flare" ? "YES" : "NO"],
    ],
  };
}

function buildConformalSet(rng, primaryClass, probability) {
  // Coarse stand-in for a real conformal predictor: lower confidence widens
  // the prediction set so it still carries the qualitative idea of guaranteed
  // coverage. A real backend should compute this from calibrated nonconformity
  // scores (see spec §23.5) — this is a stated demo approximation.
  const included = [primaryClass];
  if (probability < 0.9) {
    const others = IGPS_CLASSES.map((c) => c.id).filter((id) => id !== primaryClass);
    const extra = others[Math.floor(rng() * others.length)];
    included.push(extra);
  }
  if (probability < 0.65) {
    const others = IGPS_CLASSES.map((c) => c.id).filter((id) => !included.includes(id));
    if (others.length) included.push(others[Math.floor(rng() * others.length)]);
  }
  return included;
}

function generateSource(index, rng) {
  const cls = pickClass(rng);
  const isIndustrial = cls !== "agricultural_burn" && cls !== "forest_wildfire";
  const probability = isIndustrial
    ? 0.55 + rng() * 0.44
    : 0.5 + rng() * 0.49;
  const tier = tierFromProbability(probability);
  const lat = 8 + rng() * 26;
  const lng = 68 + rng() * 29;
  const corroborated = isIndustrial && rng() > 0.35;
  const dataset = corroborated
    ? CORROBORATION_SOURCES[Math.floor(rng() * CORROBORATION_SOURCES.length)]
    : null;
  const parts = FACILITY_NAME_PARTS[cls];
  const place = PLACE_NAMES[Math.floor(rng() * PLACE_NAMES.length)];
  const facilityName = corroborated
    ? `${place} ${parts[Math.floor(rng() * parts.length)]}`
    : null;
  const now = Date.now();
  const firstSeenDaysAgo = Math.round(90 + rng() * 1000);
  const lastSeenHoursAgo = Math.round(rng() * 96);

  return {
    id: `IGPS-${String(index + 1).padStart(4, "0")}`,
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    predicted_class: cls,
    probability: Number(probability.toFixed(3)),
    confidence_tier: tier,
    corroboration: {
      matched: corroborated,
      dataset: dataset ? dataset.id : null,
      distance_m: corroborated ? Math.round(50 + rng() * 950) : null,
      facility_name: facilityName,
    },
    first_seen: new Date(now - firstSeenDaysAgo * 86400000).toISOString(),
    last_seen: new Date(now - lastSeenHoursAgo * 3600000).toISOString(),
    detection_count: Math.round(1 + rng() * 320),
    conformal_set: buildConformalSet(rng, cls, probability),
    features: buildFeatures(rng, cls),
  };
}

let cachedSources = null;
function generateAllSources(count = 390) {
  if (cachedSources) return cachedSources;
  const rng = mulberry32(20260920);
  cachedSources = Array.from({ length: count }, (_, i) => generateSource(i, rng));
  return cachedSources;
}

// GET /v1/sources — backend not built yet, demo data used instead
export async function getIgpsSources({ cls, tier, corroboratedOnly } = {}) {
  await new Promise((resolve) => setTimeout(resolve, 180));
  let rows = generateAllSources();
  if (cls) rows = rows.filter((r) => r.predicted_class === cls);
  if (tier) rows = rows.filter((r) => r.confidence_tier === tier);
  if (corroboratedOnly) rows = rows.filter((r) => r.corroboration.matched);
  return rows;
}

// GET /v1/sources/:id
export async function getIgpsSource(id) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const rows = generateAllSources();
  return rows.find((r) => r.id === id) || null;
}

// GET /v1/stats
export async function getIgpsStats() {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const rows = generateAllSources();
  const byClass = {};
  IGPS_CLASSES.forEach((c) => (byClass[c.id] = 0));
  rows.forEach((r) => (byClass[r.predicted_class] += 1));
  const corroboratedCount = rows.filter((r) => r.corroboration.matched).length;
  const industrialCount = rows.filter(
    (r) => r.predicted_class !== "agricultural_burn" && r.predicted_class !== "forest_wildfire",
  ).length;
  return {
    total: rows.length,
    byClass,
    corroboratedCount,
    industrialCount,
    enrichmentFactor: 18.1, // stated figure from the project pitch — replace with computed value once backend is live
  };
}

export const IGPS_PRESETS = [
  { name: "Jamnagar Refinery Complex", lat: 22.3511, lng: 69.8493, frp: 62, brightness_k: 356, land_cover: "industrial" },
  { name: "Vizag Steel Plant", lat: 17.6868, lng: 83.2185, frp: 48, brightness_k: 349, land_cover: "industrial" },
  { name: "Mumbai High Offshore Field", lat: 19.5, lng: 71.5, frp: 21, brightness_k: 338, land_cover: "offshore" },
  { name: "Hazira LNG Terminal", lat: 21.1167, lng: 72.6167, frp: 34, brightness_k: 344, land_cover: "industrial" },
  { name: "Korba Thermal Power Complex", lat: 22.3595, lng: 82.7501, frp: 56, brightness_k: 352, land_cover: "industrial" },
  { name: "Sundarbans Forest Block", lat: 21.9497, lng: 88.9468, frp: 9, brightness_k: 330, land_cover: "forest" },
  { name: "Punjab Crop Residue Zone", lat: 30.7333, lng: 76.7794, frp: 14, brightness_k: 333, land_cover: "agricultural" },
];

// POST /v1/predict — this is a heuristic stand-in, NOT a trained LightGBM
// model. It mimics the shape of a real response so the UI and export paths
// can be built now; swap for a real fetch() once the backend exposes /v1/predict.
export async function predictIgps(input) {
  await new Promise((resolve) => setTimeout(resolve, 260));
  const rng = mulberry32(
    Math.abs(Math.round((input.lat || 0) * 1000 + (input.lng || 0) * 1000 + (input.frp || 0) * 7)),
  );
  const landCover = input.land_cover || "industrial";
  const frp = Number(input.frp) || 20;

  let cls = "industrial_thermal";
  if (landCover === "offshore") cls = "offshore_platform";
  else if (landCover === "forest") cls = "forest_wildfire";
  else if (landCover === "agricultural") cls = "agricultural_burn";
  else if (frp > 45) cls = "industrial_flare";

  const base = 0.58 + rng() * 0.4;
  const probability = Number(Math.min(0.99, base + (landCover === "industrial" ? 0.05 : 0)).toFixed(3));
  const tier = tierFromProbability(probability);
  const conformalSet = buildConformalSet(rng, cls, probability);

  return {
    predicted_class: cls,
    probability,
    confidence_tier: tier,
    conformal_set: conformalSet,
    coverage: 0.9,
    note: "Demo scorer — not the trained LightGBM model. Backend /v1/predict will replace this.",
  };
}

// --------------------------- client-side export -----------------------------
// These build real, downloadable GeoJSON / CSV / KML in the browser. If your
// teammate later adds GET /v1/export, you can drop these in favor of a fetch,
// but they cost him zero backend work and already match the shapes above.

function triggerDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportGeoJSON(sources, filename = "igps-sources.geojson") {
  const geojson = {
    type: "FeatureCollection",
    features: sources.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        predicted_class: s.predicted_class,
        probability: s.probability,
        confidence_tier: s.confidence_tier,
        corroborated: s.corroboration.matched,
        facility_name: s.corroboration.facility_name,
        last_seen: s.last_seen,
      },
    })),
  };
  triggerDownload(filename, JSON.stringify(geojson, null, 2), "application/geo+json");
}

export function exportCSV(sources, filename = "igps-sources.csv") {
  const header = [
    "id", "lat", "lng", "predicted_class", "probability", "confidence_tier",
    "corroborated", "corroboration_dataset", "facility_name", "first_seen", "last_seen", "detection_count",
  ];
  const rows = sources.map((s) => [
    s.id, s.lat, s.lng, s.predicted_class, s.probability, s.confidence_tier,
    s.corroboration.matched, s.corroboration.dataset || "", s.corroboration.facility_name || "",
    s.first_seen, s.last_seen, s.detection_count,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  triggerDownload(filename, csv, "text/csv");
}

export function exportKML(sources, filename = "igps-sources.kml") {
  const folders = {};
  sources.forEach((s) => {
    if (!folders[s.predicted_class]) folders[s.predicted_class] = [];
    folders[s.predicted_class].push(s);
  });
  const escapeXml = (str) => String(str).replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  })[c]);
  const folderXml = Object.entries(folders)
    .map(([cls, rows]) => {
      const label = IGPS_CLASSES.find((c) => c.id === cls)?.label || cls;
      const placemarks = rows
        .map(
          (s) => `<Placemark><name>${escapeXml(s.id)}</name><description>${escapeXml(
            `${label} · tier ${s.confidence_tier} · p=${s.probability}`,
          )}</description><Point><coordinates>${s.lng},${s.lat},0</coordinates></Point></Placemark>`,
        )
        .join("");
      return `<Folder><name>${escapeXml(label)}</name>${placemarks}</Folder>`;
    })
    .join("");
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>IGPS sources</name>${folderXml}</Document></kml>`;
  triggerDownload(filename, kml, "application/vnd.google-earth.kml+xml");
}

export const IGPS_BACKEND_BASE_URL = API_BASE_URL;
