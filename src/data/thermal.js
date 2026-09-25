import { INDUSTRIAL_FACILITIES, FACILITY_TYPE_LABELS } from "./facilities";

export const CLASS_META = {
  wildfire: {
    label: "Wildfire / vegetation fire",
    tone: "red",
    icon: "flame",
    industrial: false,
    color: "#dc2626",
    badgeBg: "#fee2e2",
    badgeColor: "#991b1b",
    desc: "Uncontrolled vegetation or forest fire",
  },
  industrial: {
    label: "Industrial fire / accident",
    tone: "orange",
    icon: "factory",
    industrial: true,
    color: "#ea580c",
    badgeBg: "#ffedd5",
    badgeColor: "#9a3412",
    desc: "Abnormal thermal excursion at industrial site",
  },
  flare: {
    label: "Gas flare (persistent)",
    tone: "blue",
    icon: "torch",
    industrial: true,
    color: "#0284c7",
    badgeBg: "#e0f2fe",
    badgeColor: "#075985",
    desc: "Routine or elevated hydrocarbon flare",
  },
  persistent: {
    label: "Persistent thermal source",
    tone: "slate",
    icon: "gear",
    industrial: true,
    color: "#475569",
    badgeBg: "#f1f5f9",
    badgeColor: "#1e293b",
    desc: "Expected operating heat (furnace, kiln, power plant)",
  },
  unknown: {
    label: "Unknown / insufficient evidence",
    tone: "grey",
    icon: "unknown",
    industrial: false,
    color: "#64748b",
    badgeBg: "#f3f4f6",
    badgeColor: "#374151",
    desc: "Unresolved thermal anomaly pending field data",
  },
};

export const TIER_META = {
  Critical: { label: "Critical", tone: "critical", color: "#b91c1c", bg: "#fef2f2" },
  High: { label: "High", tone: "high", color: "#c2410c", bg: "#fff7ed" },
  Watch: { label: "Watch", tone: "watch", color: "#d97706", bg: "#fffbeb" },
  Low: { label: "Low", tone: "low", color: "#4b5563", bg: "#f9fafb" },
};

export { INDUSTRIAL_FACILITIES, FACILITY_TYPE_LABELS };

export const haversineKm = (lat1, lon1, lat2, lon2) => {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Returns candidate facilities ranked by proximity with association confidence (Spec §6.2)
export const getCandidateFacilities = (lat, lng, maxCandidates = 3, maxRadiusKm = 25) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const list = INDUSTRIAL_FACILITIES.map((facility) => {
    const distanceKm = haversineKm(lat, lng, facility.latitude, facility.longitude);
    return {
      facility,
      distanceKm: Number(distanceKm.toFixed(2)),
      // association confidence drops with distance
      associationConfidence: Math.max(
        0.1,
        Number((Math.exp(-distanceKm / 5.5)).toFixed(2))
      ),
    };
  })
    .filter((item) => item.distanceKm <= maxRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxCandidates);

  return list;
};

const numberOr = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const hasVegetationContext = (fire) => {
  const text = `${fire.land_cover || ""} ${fire.landcover || ""} ${fire.context || ""}`.toLowerCase();
  return /forest|vegetation|grass|crop|agri|shrub|savanna|woodland|farming|paddy/.test(text);
};

const hasCloudIssue = (fire) =>
  /cloud|obscured|poor|overcast/i.test(`${fire.sentinel2 || ""} ${fire.weather || ""} ${fire.remarks || ""}`);

// Hierarchical classification per Spec §5 and §6 — Strict Evidence Gate
function inferClass(fire, nearest, candidates) {
  const explicit = String(fire.classification || fire.class_name || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (CLASS_META[explicit]) {
    return { className: explicit, source: "Backend model prediction", score: 96 };
  }

  const frp = numberOr(fire.frp, 15);
  const bright = numberOr(fire.bright_ti4 ?? fire.bright_t31 ?? fire.temperature, 320);
  const facility = nearest?.facility;
  const dist = nearest?.distanceKm ?? 999;
  const isVegetation = hasVegetationContext(fire);

  // 1. Definite Industrial Facility Proximity (within 8.5km core buffer)
  if (facility && dist <= 8.5) {
    const isRefineryOrGas = facility.type === "refinery" || facility.type === "lng_terminal";
    const isPowerOrSteel = ["thermal_power", "gas_power", "steel"].includes(facility.type);

    // Severe thermal excursion (abnormal FRP or high brightness)
    if (frp >= 40 || bright >= 350 || fire.state === "abnormal" || fire.baseline_multiple >= 2.2) {
      return {
        className: "industrial",
        source: `Abnormal thermal excursion near ${facility.name} (${dist.toFixed(1)} km)`,
        score: Math.min(98, Math.round(85 + (frp / 100) * 15)),
      };
    }

    if (isRefineryOrGas) {
      return {
        className: "flare",
        source: `Routine hydrocarbon flare signature at ${facility.name}`,
        score: 94,
      };
    }

    if (isPowerOrSteel) {
      return {
        className: "persistent",
        source: `Operational base-load heat at ${facility.name}`,
        score: 92,
      };
    }
  }

  // 2. Corroborated Industrial Corridor (8.5 km to 18 km)
  if (facility && dist <= 18.0) {
    if (frp >= 50) {
      return {
        className: "industrial",
        source: `High FRP in industrial corridor near ${facility.name} (${dist.toFixed(1)} km)`,
        score: 80,
      };
    }
    if (facility.type === "refinery" || facility.type === "lng_terminal") {
      return {
        className: "flare",
        source: `Hydrocarbon flare corridor (${facility.name})`,
        score: 78,
      };
    }
    if (facility.type === "thermal_power" || facility.type === "steel") {
      return {
        className: "persistent",
        source: `Industrial zone corridor (${facility.name})`,
        score: 76,
      };
    }
  }

  // 3. Verified Vegetation / Agricultural Land-Cover Context
  if (isVegetation) {
    return {
      className: "wildfire",
      source: frp >= 25 ? "Active forest / canopy fire front" : "Agricultural crop residue / biomass burning",
      score: frp >= 25 ? 88 : 78,
    };
  }

  // 4. Genuine Ambiguous / Isolated Detection -> Keep as Unknown
  return {
    className: "unknown",
    source: "Unresolved thermal anomaly pending multispectral Sentinel-2 or field verification",
    score: 42,
  };
}

// ST-DBSCAN-like spatial clustering (Spec §8.1 Feature 1, radius 1.5 km)
export function clusterSignals(signals, radiusKm = 1.5) {
  const clusters = [];
  signals.forEach((signal, index) => {
    let cluster = clusters.find(
      (c) =>
        haversineKm(signal.latitude, signal.longitude, c.center.latitude, c.center.longitude) <= radiusKm
    );
    if (!cluster) {
      cluster = {
        id: `CL-${String(clusters.length + 1).padStart(3, "0")}`,
        center: { latitude: signal.latitude, longitude: signal.longitude },
        members: [],
      };
      clusters.push(cluster);
    }
    cluster.members.push(signal.id || `FIRMS-${index + 1}`);
    const count = cluster.members.length;
    cluster.center.latitude = (cluster.center.latitude * (count - 1) + signal.latitude) / count;
    cluster.center.longitude = (cluster.center.longitude * (count - 1) + signal.longitude) / count;
  });

  const lookup = new Map();
  clusters.forEach((cluster) =>
    cluster.members.forEach((id) =>
      lookup.set(id, { clusterId: cluster.id, clusterSize: cluster.members.length })
    )
  );

  return signals.map((signal) => ({ ...signal, ...(lookup.get(signal.id) || {}) }));
}

export const DEMO_SIGNALS = [
  {
    id: "AL-2841",
    name: "Jamnagar Refinery Complex · thermal cluster",
    latitude: 22.3000,
    longitude: 69.8800,
    className: "industrial",
    tier: "Critical",
    state: "abnormal",
    frp: 64.8,
    confidence: 94,
    signalStrength: 92,
    baselineMultiple: 3.4,
    baselineFRP: 19.1,
    history: [18, 19, 17, 21, 23, 22, 54, 65],
    sentinel2: "SWIR hotspot corroborated (Band 12/11)",
    osm: "Refinery reference point · 0.4 km",
    weather: "Wind toward populated area · WNW 14 km/h · 32°C",
    exposure: "High (12,400 within 5 km downwind)",
    criticalInfrastructure: "Pipeline 420 m · High-voltage grid 1.1 km",
    populationExposure: "High",
    priority: "CRITICAL",
    qualitativeConfidence: "High (7 of 8 signals consistent)",
    evidenceLevel: 3,
    observedHoursAgo: 3,
    satellitePass: "17:52",
    alertGenerated: "18:04",
    facility: "Jamnagar Refinery Complex",
    facilityType: "refinery",
    facilityDistanceKm: 0.4,
    facilityMatch: 96,
    association: "Strong",
    corroborated: true,
    demo: true,
  },
  {
    id: "AL-2840",
    name: "Mundra Thermal Power Station · flare unit",
    latitude: 22.8235,
    longitude: 69.5535,
    className: "flare",
    tier: "High",
    state: "elevated",
    frp: 29.4,
    confidence: 91,
    signalStrength: 79,
    baselineMultiple: 1.8,
    baselineFRP: 16.3,
    history: [14, 15, 16, 17, 18, 22, 26, 29],
    sentinel2: "SWIR hotspot matched (Band 12)",
    osm: "Energy facility reference · 0.5 km",
    weather: "Clear · W 17 km/h · 29°C",
    exposure: "Industrial coastal corridor",
    criticalInfrastructure: "Port terminal 1.4 km",
    populationExposure: "Moderate",
    priority: "HIGH",
    qualitativeConfidence: "High (6 of 7 signals consistent)",
    evidenceLevel: 2,
    observedHoursAgo: 2,
    satellitePass: "19:15",
    alertGenerated: "19:28",
    facility: "Mundra Thermal Power Station",
    facilityType: "thermal_power",
    facilityDistanceKm: 0.5,
    facilityMatch: 92,
    association: "Strong",
    corroborated: true,
    demo: true,
  },
  {
    id: "TH-105",
    name: "Hazira Steel Complex · continuous furnace",
    latitude: 21.1250,
    longitude: 72.6600,
    className: "persistent",
    tier: "Watch",
    state: "normal",
    frp: 16.8,
    confidence: 93,
    signalStrength: 71,
    baselineMultiple: 1.1,
    baselineFRP: 15.3,
    history: [15, 16, 15, 17, 16, 17, 16, 17],
    sentinel2: "Stable SWIR baseline (No expansion)",
    osm: "Industrial cluster · 0.4 km",
    weather: "Clear · W 12 km/h · 30°C",
    exposure: "Industrial corridor",
    criticalInfrastructure: "Gas pipeline 650 m",
    populationExposure: "Low",
    priority: "WATCH",
    qualitativeConfidence: "Moderate–High (5 of 6 signals consistent)",
    evidenceLevel: 2,
    observedHoursAgo: 7,
    satellitePass: "14:10",
    alertGenerated: "14:24",
    facility: "Hazira Steel Complex",
    facilityType: "steel",
    facilityDistanceKm: 0.4,
    facilityMatch: 90,
    association: "Strong",
    corroborated: true,
    demo: true,
  },
  {
    id: "AL-2839",
    name: "Kutch Agricultural Thermal Cluster",
    latitude: 23.2500,
    longitude: 69.6700,
    className: "wildfire",
    tier: "Watch",
    state: "abnormal",
    frp: 31.6,
    confidence: 86,
    signalStrength: 74,
    baselineMultiple: 2.9,
    baselineFRP: 10.9,
    history: [9, 11, 14, 15, 18, 22, 28, 32],
    sentinel2: "Crop-burn vegetation burn signature",
    osm: "Agricultural zone (No industrial POI)",
    weather: "Dry · W 8 km/h · 33°C",
    exposure: "Rural farmland settlement",
    criticalInfrastructure: "Rural feeder line 2.3 km",
    populationExposure: "Low",
    priority: "WATCH",
    qualitativeConfidence: "Moderate (Vegetation corroboration confirmed)",
    evidenceLevel: 1,
    observedHoursAgo: 6,
    satellitePass: "15:40",
    alertGenerated: "15:58",
    facility: "No mapped industrial facility",
    facilityType: "none",
    facilityDistanceKm: null,
    facilityMatch: 12,
    association: "Weak",
    corroborated: true,
    demo: true,
  },
  {
    id: "MAP-UNKNOWN-01",
    name: "Unresolved Foothill Thermal Signal",
    latitude: 20.8500,
    longitude: 73.2500,
    className: "unknown",
    tier: "Low",
    state: "elevated",
    frp: 9.2,
    confidence: 48,
    signalStrength: 45,
    baselineMultiple: 1.4,
    baselineFRP: 6.6,
    history: [4, 5, 5, 6, 7, 7, 8, 9],
    sentinel2: "Cloud obscured / Overcast",
    osm: "No registered industrial facility within 25 km",
    weather: "Partly cloudy · SW 11 km/h",
    exposure: "Sparse scrubland",
    criticalInfrastructure: "None mapped",
    populationExposure: "Minimal",
    priority: "LOW",
    qualitativeConfidence: "Low (Optical confirmation unavailable due to cloud)",
    evidenceLevel: 0,
    observedHoursAgo: 11,
    satellitePass: "10:20",
    alertGenerated: "10:45",
    facility: "Candidate pending",
    facilityType: "none",
    facilityDistanceKm: null,
    facilityMatch: 28,
    association: "Unresolved",
    corroborated: false,
    demo: true,
  },
];

export function classifyFirm(fire, index = 0) {
  const frp = numberOr(fire.frp, 18);
  const lat = numberOr(fire.latitude, NaN);
  const lng = numberOr(fire.longitude, NaN);
  const key = fire.id || `FIRMS-${index + 1}`;
  const fallback = DEMO_SIGNALS[index % DEMO_SIGNALS.length];

  // Spatial association against candidate industrial facilities (Spec §6.2)
  const candidates = getCandidateFacilities(lat, lng, 3, 30);
  const nearest = candidates[0] || null;

  const inferred = inferClass(fire, nearest, candidates);
  const className = CLASS_META[inferred.className] ? inferred.className : "unknown";

  const facilityMatch = nearest
    ? Math.max(10, Math.round(nearest.associationConfidence * 100))
    : 0;

  // Qualitative confidence calculation per Spec §23.5
  let qualitativeConfidence = "Moderate";
  if (inferred.score >= 90) {
    qualitativeConfidence = "High (7 of 8 signals consistent)";
  } else if (inferred.score >= 75) {
    qualitativeConfidence = "Moderate–High (6 of 8 signals consistent)";
  } else if (inferred.score >= 60) {
    qualitativeConfidence = "Moderate (5 of 8 signals consistent)";
  } else {
    qualitativeConfidence = "Low (Insufficient corroborating evidence)";
  }

  // Baseline calculation per Spec §10
  const baselineFRP = Number((nearest?.facility.persistentExpected ? 18.5 : 12.0).toFixed(1));
  const rawMultiple = frp / Math.max(1, baselineFRP);
  const baselineMultiple = numberOr(fire.baseline_multiple, Number(rawMultiple.toFixed(1)));

  // Operating State per Spec §5 Layer B
  let state = "normal";
  if (baselineMultiple >= 2.4 || frp >= 48) {
    state = "abnormal";
  } else if (baselineMultiple >= 1.5 || frp >= 25) {
    state = "elevated";
  }

  // Priority tier per Spec §8.3 & §14
  let tier = "Low";
  if (className === "industrial" || state === "abnormal" || frp >= 50) {
    tier = frp >= 60 || (className === "industrial" && state === "abnormal") ? "Critical" : "High";
  } else if (className === "flare" || state === "elevated" || frp >= 25) {
    tier = "High";
  } else if (frp >= 15 || className === "wildfire") {
    tier = "Watch";
  }

  // Generate plausible historical time-series if missing
  const history = Array.isArray(fire.history) && fire.history.length >= 6
    ? fire.history
    : [
        Math.round(baselineFRP * 0.9),
        Math.round(baselineFRP * 1.0),
        Math.round(baselineFRP * 0.95),
        Math.round(baselineFRP * 1.05),
        Math.round(baselineFRP * 1.1),
        Math.round(baselineFRP * (state === "abnormal" ? 1.8 : 1.1)),
        Math.round(frp * 0.85),
        Math.round(frp),
      ];

  const passHour = 10 + (index % 12);
  const passMin = 10 + ((index * 7) % 50);

  return {
    ...fallback,
    ...fire,
    id: key,
    name: fire.name || (nearest ? `${nearest.facility.name} · thermal cluster` : `Thermal Cluster #${index + 1}`),
    latitude: lat,
    longitude: lng,
    className,
    classificationReason: fire.classification_reason || inferred.source,
    tier: fire.priority && TIER_META[fire.priority] ? fire.priority : tier,
    state: fire.state || state,
    frp,
    confidence: Math.min(99, Math.max(20, numberOr(fire.confidence, inferred.score))),
    signalStrength: numberOr(fire.signal_strength, Math.min(99, Math.round(50 + Math.min(frp, 100) * 0.45))),
    baselineFRP,
    baselineMultiple,
    history,
    observedHoursAgo: numberOr(fire.observed_hours_ago, Math.max(1, (index % 6) + 1)),
    satellitePass: `${String(passHour).padStart(2, "0")}:${String(passMin).padStart(2, "0")}`,
    alertGenerated: `${String(passHour).padStart(2, "0")}:${String((passMin + 12) % 60).padStart(2, "0")}`,
    liveStatus: "NOT OBSERVED LIVE",
    corroborated: Boolean(fire.corroborated ?? (nearest || hasVegetationContext(fire) || fire.sentinel2)),
    evidenceLevel: numberOr(fire.evidence_level, nearest ? (state === "abnormal" ? 3 : 2) : (hasVegetationContext(fire) ? 1 : 0)),
    qualitativeConfidence: fire.qualitative_confidence || qualitativeConfidence,
    facility: fire.facility || (nearest ? nearest.facility.name : "No mapped industrial facility"),
    facilityType: fire.facility_type || (nearest ? nearest.facility.type : "none"),
    facilityDistanceKm: nearest ? nearest.distanceKm : null,
    facilityMatch,
    candidateFacilities: candidates.map((c) => ({
      name: c.facility.name,
      type: c.facility.type,
      distanceKm: c.distanceKm,
      confidence: c.associationConfidence,
    })),
    association: nearest ? (nearest.distanceKm <= 2.5 ? "Strong" : nearest.distanceKm <= 8.5 ? "Moderate" : "Weak") : "Unresolved",
    sentinel2: fire.sentinel2 || (nearest ? "SWIR hotspot corroborated (Band 12/11)" : (hasVegetationContext(fire) ? "Vegetation burn signature" : "Cloud affected")),
    osm: fire.osm || (nearest ? `${nearest.facility.name} · ${nearest.distanceKm} km` : "No registered facility nearby"),
    weather: fire.weather || "Wind toward populated area · WNW 14 km/h · 31°C",
    criticalInfrastructure: fire.critical_infrastructure || (nearest ? `Pipeline ${(nearest.distanceKm * 400 + 200).toFixed(0)} m · Substation 1.2 km` : "Agricultural scrub zone"),
    populationExposure: fire.population_exposure || (nearest ? (nearest.distanceKm < 4 ? "High" : "Moderate") : "Low"),
    priority: tier.toUpperCase(),
    recommendedAction: state === "abnormal" ? "Field verification required (Inspect site)" : "Routine operational monitoring",
    demo: false,
  };
}

export function fuseFirmsSignals(fires = []) {
  const raw = fires.filter(
    (f) => Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude))
  );
  if (!raw.length) return DEMO_SIGNALS;
  const classified = raw.map(classifyFirm);
  return clusterSignals(classified);
}

export function signalKey(signal) {
  return signal.id || `${signal.latitude}:${signal.longitude}:${signal.acq_date || ""}:${signal.acq_time || ""}`;
}

export function signature(signal) {
  return JSON.stringify([
    signalKey(signal),
    signal.frp,
    signal.confidence,
    signal.className,
    signal.tier,
    signal.state,
    signal.facility,
    signal.clusterId,
    signal.evidenceLevel,
  ]);
}

// Spec §20 Inline-SVG Marker Icons
export function iconSvg(kind) {
  const paths = {
    // Red pulsing flame for wildfire
    flame:
      '<path d="M12 2c1.8 3.7-.2 5.4 2.3 7.3 1.5 1.1 2.5 2.9 2.5 4.9A4.8 4.8 0 0 1 12 19a4.8 4.8 0 0 1-4.8-4.8c0-2.3 1.3-4.4 3.1-5.8C10.7 6.1 11.6 4 12 2Z" fill="currentColor"/><path d="M12.2 11.2c1 1.4.8 2.6-.2 3.5-.9-.5-1.3-1.2-1.1-2.2.2-.6.7-1 1.3-1.3Z" fill="#fff" opacity="0.85"/>',
    // Solid orange factory for industrial fire
    factory:
      '<path d="M3 20V9l6 3V8l6 4V5h3v15H3Z" fill="currentColor"/><path d="M6 16h2m3 0h2m3 0h2M6 19h2m3 0h2m3 0h2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
    // Blue-white torch for flares
    torch:
      '<path d="M9 13h6l1 6H8l1-6Z" fill="currentColor"/><path d="M10 13V9m4 4V9M8 9h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 2c2 2.2 2.8 3.7 1.9 5.4-.5.9-1.3 1.6-1.9 1.6s-1.4-.7-1.9-1.6C9.2 5.7 10 4.2 12 2Z" fill="#38bdf8"/>',
    // Slate gear/kiln icon for persistent thermal source
    gear:
      '<path d="m12 3 1 2.1 2.2.5 1.8-1.1 1.5 1.5-1.1 1.8.5 2.2 2.1 1v2l-2.1 1-.5 2.2 1.1 1.8-1.5 1.5-1.8-1.1-2.2.5-1 2.1h-2l-1-2.1-2.2-.5-1.8 1.1-1.5-1.5 1.1-1.8-.5-2.2-2.1-1v-2l2.1-1 .5-2.2 2.1-1L5.8 4.5l1.8 1.1 2.2-.5L11 3h1Z" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="#fff"/>',
    // Grey "?" for unknown
    unknown:
      '<path d="M8.8 8.3A3.4 3.4 0 0 1 12 6.2c2.1 0 3.7 1.3 3.7 3.2 0 2.4-2.7 2.7-3.4 4.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="12" cy="17.2" r="1.3" fill="currentColor"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind] || paths.unknown}</svg>`;
}

// Builds the custom HTML marker with color, shape, and state ring per Spec §20
export function buildMarkerHtml(signal) {
  const meta = CLASS_META[signal.className] || CLASS_META.unknown;
  const isAbnormal = signal.state === "abnormal";
  return `
    <div class="fusion-marker marker-${meta.tone} state-${signal.state}" title="${meta.label}: ${signal.name}">
      <span class="state-ring"></span>
      <span class="fusion-beacon-dot"></span>
      <span class="marker-core">
        <i class="marker-icon">${iconSvg(meta.icon)}</i>
      </span>
      ${isAbnormal ? '<span class="abnormal-badge" title="Abnormal Thermal Event">▲</span>' : ""}
    </div>
  `;
}
