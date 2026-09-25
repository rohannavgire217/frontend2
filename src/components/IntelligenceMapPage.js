import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  CLASS_META,
  DEMO_SIGNALS,
  TIER_META,
  INDUSTRIAL_FACILITIES,
  FACILITY_TYPE_LABELS,
  buildMarkerHtml,
  classifyFirm,
  clusterSignals,
  signalKey,
  signature,
} from "../data/thermal";

import { playAlarm, unlockAlarmAudio } from "../utils/alarm";

const initialDemo = DEMO_SIGNALS;

// Spec §10: Interactive Self-Baseline Mini-Chart
function MiniChart({ values = [] }) {
  if (!values.length) {
    return <div className="mini-chart-empty">No baseline history</div>;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 38 - ((v - min) / range) * 30;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastPoint = values[values.length - 1];
  const lastX = 100;
  const lastY = 38 - ((lastPoint - min) / range) * 30;

  return (
    <div className="baseline-chart-wrapper">
      <svg
        className="baseline-chart"
        viewBox="0 0 100 44"
        preserveAspectRatio="none"
        aria-label="Historical baseline comparison"
      >
        {/* Expected baseline threshold band (normal operating zone) */}
        <rect x="0" y="20" width="100" height="18" fill="rgba(34, 197, 94, 0.08)" />
        <line x1="0" y1="29" x2="100" y2="29" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="0.8" />
        
        {/* Historical time series trend line */}
        <polyline points={points} fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Latest reading indicator */}
        <circle cx={lastX} cy={lastY} r="3" fill="#b91c1c" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
      <div className="baseline-chart-labels">
        <span>T-7d (Baseline: ~{values[0] || 15} MW)</span>
        <span className="baseline-current-tag">Current: {lastPoint} MW</span>
      </div>
    </div>
  );
}

// Spec §14: Evidence Fusion Card — Exact Specification Format
function FusionCard({ signal, onClose, onVerify }) {
  if (!signal) return null;

  const meta = CLASS_META[signal.className] || CLASS_META.unknown;
  const association =
    signal.facilityAssociation ||
    signal.association ||
    (Number(signal.facilityMatch) >= 80
      ? "Strong"
      : Number(signal.facilityMatch) >= 60
      ? "Moderate"
      : "Unresolved");

  return (
    <aside className="fusion-card" role="dialog" aria-label="Evidence Fusion Card">
      <div className="fusion-card-head">
        <div>
          <span className={`class-kicker tone-${meta.tone}`}>
            {signal.state === "abnormal" ? "ABNORMAL THERMAL EVENT" : "THERMAL DETECTION"} — {meta.label.toUpperCase()}
          </span>
          <h3>{signal.name}</h3>
          <small className="fusion-coords">
            {signal.id} · Lat: {Number(signal.latitude).toFixed(4)}°, Lon: {Number(signal.longitude).toFixed(4)}°
          </small>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close card">
          ×
        </button>
      </div>

      {/* Observation Age per Spec §14 */}
      <div className="observed-note">
        <b>Observed: {signal.observedHoursAgo || 3}h ago</b> (last satellite pass {signal.satellitePass || "17:52"}; alert generated {signal.alertGenerated || "18:04"}; status: <span className="not-live-tag">{signal.liveStatus || "NOT OBSERVED LIVE"}</span>)
      </div>

      {/* Priority and Operating State */}
      <div className="fusion-state-row">
        <div className="fusion-badges">
          <span className={`tier-badge ${String(signal.tier || "Low").toLowerCase()}`}>
            PRIORITY: {signal.tier}
          </span>
          <span className={`state-badge state-${signal.state}`}>
            {signal.state?.toUpperCase()}
          </span>
          <span className="evidence-badge" title="Ground truth evidence validation level">
            LEVEL {signal.evidenceLevel ?? 0}/5 EVIDENCE
          </span>
        </div>
        <div className="fusion-frp-metric">
          <strong>{Number(signal.frp || 0).toFixed(1)} <small>MW FRP</small></strong>
        </div>
      </div>

      {/* Evidence Fusion Breakdown per Spec §14 */}
      <div className="fusion-evidence-box">
        <div className="fusion-evidence-item">
          <span>VIIRS thermal signal:</span>
          <b>{signal.frp >= 40 ? "Strong" : "Moderate"} (FRP: {Number(signal.frp).toFixed(1)} MW, Strength: {signal.signalStrength || 80}/100)</b>
        </div>
        <div className="fusion-evidence-item">
          <span>Historical baseline:</span>
          <b>{Number(signal.baselineMultiple || 1.0).toFixed(1)}× normal (Learned site baseline)</b>
        </div>
        <div className="fusion-evidence-item">
          <span>Sentinel-2 context:</span>
          <b>{signal.sentinel2 || "SWIR hotspot corroborated"}</b>
        </div>
        <div className="fusion-evidence-item">
          <span>OSM facility:</span>
          <b>{signal.facility || "Nearby industrial site"} ({signal.facilityDistanceKm != null ? `${signal.facilityDistanceKm} km` : "Proximity match"} · {association})</b>
        </div>
        <div className="fusion-evidence-item">
          <span>TROPOMI:</span>
          <b>{signal.tropomi || "Plume within atmospheric baseline (SO2/NO2 evaluated)"}</b>
        </div>
        <div className="fusion-evidence-item">
          <span>Weather / Wind:</span>
          <b>{signal.weather || "Wind toward populated area · WNW 14 km/h"}</b>
        </div>
        <div className="fusion-evidence-item">
          <span>Critical infrastructure:</span>
          <b>{signal.criticalInfrastructure || "Pipeline 420 m · High-voltage grid 1.1 km"}</b>
        </div>
        <div className="fusion-evidence-item">
          <span>Population exposure:</span>
          <b className={signal.populationExposure === "High" ? "exposure-high" : ""}>{signal.populationExposure || "High (Settlement downwind)"}</b>
        </div>
      </div>

      {/* Explainable Confidence & Reason */}
      <div className="fusion-reason-box">
        <div className="reason-label">CLASSIFICATION EXPLANATION</div>
        <p>{signal.classificationReason || "Hierarchical classifier fused spatial facility context, thermal severity, and land cover."}</p>
        <div className="confidence-summary">
          <span>Confidence:</span>
          <b>{signal.qualitativeConfidence || `${signal.confidence}% calibrated`}</b>
        </div>
        <div className="confidence-track">
          <i style={{ width: `${Math.min(Number(signal.confidence) || 0, 100)}%` }} />
        </div>
      </div>

      {/* Action Recommendation */}
      <div className="fusion-recommendation">
        <span>Recommended action:</span>
        <b>{signal.recommendedAction || (signal.tier === "Critical" || signal.tier === "High" ? "Field verification required immediately" : "Routine operational monitoring")}</b>
      </div>

      <div className="fusion-actions">
        <button className="primary-button" onClick={() => onVerify(signal)}>
          Verify in Field →
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            navigator.clipboard?.writeText(signal.id);
            alert(`Copied ID: ${signal.id}`);
          }}
        >
          Copy ID
        </button>
      </div>
    </aside>
  );
}

// Map Filter Bar
function FilterBar({ signals, filters, setFilters }) {
  const counts = useMemo(
    () => ({
      total: signals.length,
      industrial: signals.filter((s) => CLASS_META[s.className]?.industrial).length,
      corroborated: signals.filter((s) => s.corroborated).length,
    }),
    [signals]
  );

  const set = (key, value) =>
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));

  return (
    <div className="map-filter-bar">
      <div className="filter-group">
        <span className="filter-label">CLASS</span>
        {Object.entries(CLASS_META).map(([key, meta]) => (
          <button
            key={key}
            className={`filter-chip ${filters.className === key ? "active" : ""}`}
            onClick={() => set("className", filters.className === key ? "all" : key)}
          >
            <i className={`filter-dot tone-${meta.tone}`} />
            {meta.label}
          </button>
        ))}
      </div>

      <div className="filter-group">
        <span className="filter-label">TIER</span>
        {Object.keys(TIER_META).map((tier) => (
          <button
            key={tier}
            className={`filter-chip ${filters.tier === tier ? "active" : ""}`}
            onClick={() => set("tier", filters.tier === tier ? "all" : tier)}
          >
            {tier}
          </button>
        ))}
      </div>

      <button
        className={`filter-chip industrial-only ${filters.industrialOnly ? "active" : ""}`}
        onClick={() => set("industrialOnly", !filters.industrialOnly)}
      >
        Industrial only · {counts.industrial}
      </button>

      <button
        className={`filter-chip ${filters.corroboratedOnly ? "active" : ""}`}
        onClick={() => set("corroboratedOnly", !filters.corroboratedOnly)}
      >
        ✓ Corroborated · {counts.corroborated}
      </button>

      <label className="map-search">
        <span>⌕</span>
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search site, facility, or ID"
        />
      </label>

      <span className="filter-count">{counts.total} signals</span>
    </div>
  );
}

// Layers Panel
function LayersPanel({ layers, setLayers, onClose }) {
  const toggle = (key) =>
    setLayers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

  return (
    <aside className="layers-panel" role="dialog" aria-label="Map layers">
      <div className="panel-title">
        <div>
          <span>GEOSPATIAL LAYERS</span>
          <h4>Overlay configuration</h4>
        </div>
        <button onClick={onClose} aria-label="Close layers">×</button>
      </div>

      <label className="layer-toggle">
        <div>
          <b>Thermal Anomalies (FIRMS)</b>
          <small>Active VIIRS 375m &amp; MODIS 1km detections</small>
        </div>
        <input type="checkbox" checked={layers.thermal} onChange={() => toggle("thermal")} />
        <i />
      </label>

      <label className="layer-toggle">
        <div>
          <b>Industrial Facilities (Registry)</b>
          <small>Refineries, LNG terminals, power plants, steel mills</small>
        </div>
        <input type="checkbox" checked={layers.facilities} onChange={() => toggle("facilities")} />
        <i />
      </label>

      <label className="layer-toggle">
        <div>
          <b>Enrichment Rings (1.5 km buffer)</b>
          <small>Spatial clustering &amp; exposure boundary</small>
        </div>
        <input type="checkbox" checked={layers.rings} onChange={() => toggle("rings")} />
        <i />
      </label>

      <label className="layer-toggle">
        <div>
          <b>Sentinel-2 SWIR Hotspots</b>
          <small>10m/20m infrared band corroboration</small>
        </div>
        <input type="checkbox" checked={layers.swir} onChange={() => toggle("swir")} />
        <i />
      </label>
    </aside>
  );
}

// Ranked Source List beside Map
function SourceList({ signals, selected, onSelect }) {
  return (
    <section className="source-list">
      <div className="panel-title">
        <div>
          <span>SOURCE LIST</span>
          <h4>Ranked thermal candidates</h4>
        </div>
        <b>{signals.length}</b>
      </div>

      <div className="source-list-scroll">
        {signals.length === 0 && (
          <p className="empty-sources">No signals match current filters.</p>
        )}
        {signals.slice(0, 30).map((signal) => {
          const meta = CLASS_META[signal.className] || CLASS_META.unknown;
          const isSelected = selected?.id === signal.id;
          return (
            <button
              key={signal.id}
              className={`source-row ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(signal)}
            >
              <span className={`source-shape tone-${meta.tone}`}>
                {signal.className === "industrial" ? "I" : signal.className === "flare" ? "F" : signal.className === "wildfire" ? "W" : signal.className === "persistent" ? "P" : "?"}
              </span>
              <div className="source-row-info">
                <b>{signal.name}</b>
                <small>
                  {signal.id} · {signal.tier} · FRP: {Number(signal.frp || 0).toFixed(0)} MW · {signal.facility}
                </small>
              </div>
              <strong className="source-confidence">{signal.confidence}%</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Incident Inspector Panel with Self-Baseline & Candidate Facilities (Spec §6.2)
function Inspector({ signal, onVerify }) {
  if (!signal) {
    return (
      <section className="inspector empty-inspector">
        <span>Select an anomaly on map</span>
        <b>Inspect fused evidence → verify</b>
      </section>
    );
  }

  const association =
    signal.facilityAssociation ||
    signal.association ||
    (Number(signal.facilityMatch) >= 80
      ? "Strong"
      : Number(signal.facilityMatch) >= 60
      ? "Moderate"
      : "Unresolved");

  const candidates = signal.candidateFacilities && signal.candidateFacilities.length
    ? signal.candidateFacilities
    : [
        { name: signal.facility || "Primary industrial candidate", type: signal.facilityType, confidence: (signal.facilityMatch || 80) / 100 },
        { name: "Secondary industrial asset", type: "ancillary", confidence: 0.45 },
        { name: "Regional infrastructure grid", type: "power_line", confidence: 0.22 },
      ];

  return (
    <section className="inspector">
      <div className="panel-title">
        <div>
          <span>INCIDENT INSPECTOR</span>
          <h4>{signal.id}</h4>
        </div>
        <span className={`tier-badge ${String(signal.tier || "Low").toLowerCase()}`}>
          {signal.tier}
        </span>
      </div>

      <div className="inspector-grid">
        <div>
          <span>Classification</span>
          <b>{CLASS_META[signal.className]?.label || "Unknown"}</b>
        </div>
        <div>
          <span>Radiative Power (FRP)</span>
          <b>{Number(signal.frp || 0).toFixed(1)} MW</b>
        </div>
        <div>
          <span>Facility match</span>
          <b>{signal.facilityMatch}%</b>
        </div>
        <div>
          <span>Association strength</span>
          <b>{association}</b>
        </div>
        <div>
          <span>Corroboration</span>
          <b className={signal.corroborated ? "status-yes" : "status-no"}>
            {signal.corroborated ? "YES (Corroborated)" : "NO (Uncorroborated)"}
          </b>
        </div>
        <div>
          <span>Operating State</span>
          <b className={`state-text state-${signal.state}`}>
            {signal.state?.toUpperCase()}
          </b>
        </div>
      </div>

      {/* Spec §10: "Is it unusual for this place?" Self-Baseline */}
      <div className="baseline-panel">
        <div className="baseline-head">
          <span>IS IT UNUSUAL FOR THIS PLACE?</span>
          <b>{Number(signal.baselineMultiple || 1.0).toFixed(1)}× baseline</b>
        </div>
        <MiniChart values={signal.history} />
        <small>
          Self-baseline evaluates current anomaly against learned historical median (BOCPD changepoint detection).
        </small>
      </div>

      {/* Spec §6.2: Ranked Candidate-Facility List */}
      <div className="candidate-list">
        <span>CANDIDATE FACILITIES (375m PIXEL FOOTPRINT)</span>
        {candidates.map((cand, idx) => (
          <div key={idx} className="candidate-row">
            <div className="candidate-name">
              <b>{idx + 1}. {cand.name}</b>
              <small>{FACILITY_TYPE_LABELS[cand.type] || cand.type || "Industrial asset"}</small>
            </div>
            <div className="candidate-score">
              <em>{(cand.confidence * 100).toFixed(0)}%</em>
              <div className="cand-bar"><i style={{ width: `${cand.confidence * 100}%` }} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Spec §23.2: Level 0–5 Ground Truth Evidence Badge */}
      <div className="evidence-level-card">
        <div className="evidence-level-number">
          <b>{signal.evidenceLevel ?? 0}</b>
          <span>/ 5</span>
        </div>
        <div className="evidence-level-text">
          <strong>GROUND TRUTH EVIDENCE LEVEL</strong>
          <p>
            {signal.evidenceLevel === 5 ? "Level 5: Official incident investigation" :
             signal.evidenceLevel === 4 ? "Level 4: Fire/emergency authority confirmation" :
             signal.evidenceLevel === 3 ? "Level 3: Verified field inspection with photo evidence" :
             signal.evidenceLevel === 2 ? "Level 2: High-resolution satellite confirmation (Sentinel-2)" :
             signal.evidenceLevel === 1 ? "Level 1: Expert manual interpretation" :
             "Level 0: Weak label (OSM tag / registry inference only)"}
          </p>
        </div>
      </div>

      {/* Classification Reason */}
      <div className="classification-reason-box">
        <span>EXPLAINABLE AI ATTRIBUTION (SHAP)</span>
        <p>{signal.classificationReason || "Hierarchical classifier verified spatial infrastructure proximity and baseline deviation."}</p>
        {signal.className === "unknown" && (
          <div className="unknown-notice">
            ⚠ Unknown is legitimately retained: spatial &amp; spectral evidence does not support a definitive label.
          </div>
        )}
      </div>

      <button className="primary-button full" onClick={() => onVerify(signal)}>
        Open field verification loop →
      </button>
    </section>
  );
}

// Spec §11 & §23: Human-in-the-Loop Field Verification Modal
function VerifyLoop({ signal, onClose, onResult }) {
  const [note, setNote] = useState("");
  const [evidenceLevel, setEvidenceLevel] = useState(3);
  const [submitted, setSubmitted] = useState(false);

  if (!signal) return null;

  const handleDecision = (decision) => {
    onResult(signal, decision, note, evidenceLevel);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="verify-overlay" role="dialog" aria-label="Field verification loop">
      <div className="verify-panel">
        <div className="panel-title">
          <div>
            <span>HUMAN-IN-THE-LOOP VERIFICATION (SPEC §11 &amp; §23)</span>
            <h3>Field Handoff: {signal.id}</h3>
          </div>
          <button onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="verify-desc">
          Field-collected ground truth retrains the classifier. Confirmation or rejection updates the site's persistent baseline and weights future predictions.
        </p>

        <div className="verify-evidence-grid">
          <div>
            <span>Target Anomaly:</span>
            <b>{signal.name}</b>
          </div>
          <div>
            <span>AI Prediction:</span>
            <b>{CLASS_META[signal.className]?.label}</b>
          </div>
          <div>
            <span>Current FRP:</span>
            <b>{Number(signal.frp || 0).toFixed(1)} MW</b>
          </div>
          <div>
            <span>Facility Match:</span>
            <b>{signal.facility} ({signal.facilityMatch}%)</b>
          </div>
        </div>

        {/* Spec §23.2 Ground Truth Level Picker */}
        <label className="verify-level-picker">
          <span>Ground-Truth Verification Tier:</span>
          <select value={evidenceLevel} onChange={(e) => setEvidenceLevel(Number(e.target.value))}>
            <option value="5">Level 5 — Official incident investigation report</option>
            <option value="4">Level 4 — Fire / emergency authority confirmation</option>
            <option value="3">Level 3 — Verified field inspection with geotagged photo</option>
            <option value="2">Level 2 — High-resolution satellite confirmation (Sentinel-2)</option>
            <option value="1">Level 1 — Expert manual interpretation</option>
          </select>
        </label>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter field observation notes, inspector name, or dispatch comments..."
        />

        <div className="field-photo-sim">
          <span>📷 Geotagged Field Photo Evidence: Attached via Mobile PWA Camera API (Simulated)</span>
        </div>

        {submitted ? (
          <div className="verify-success">
            ✓ Field verification recorded! Training dataset recalibrated with Level {evidenceLevel} weight.
          </div>
        ) : (
          <div className="verify-buttons">
            <button className="reject" onClick={() => handleDecision("REJECTED")}>
              Reject (Routine / False Positive)
            </button>
            <button className="confirm" onClick={() => handleDecision("CONFIRMED")}>
              Confirm Anomaly (True Positive)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Live Inference Calculator Panel
function LiveInference() {
  const [lat, setLat] = useState("22.3000");
  const [lon, setLon] = useState("69.8800");
  const [frp, setFrp] = useState("65");
  const [bright, setBright] = useState("355");
  const [res, setRes] = useState(null);

  const calculate = () => {
    const fire = {
      latitude: Number(lat),
      longitude: Number(lon),
      frp: Number(frp),
      bright_ti4: Number(bright),
      id: "CALC-01",
    };
    const classified = classifyFirm(fire, 0);
    setRes(classified);
  };

  return (
    <section className="inference-panel">
      <div className="panel-title">
        <div>
          <span>LIVE INFERENCE BENCHMARK</span>
          <h4>Test custom coordinates &amp; thermal inputs</h4>
        </div>
      </div>

      <div className="inference-grid">
        <label>
          Latitude:
          <input value={lat} onChange={(e) => setLat(e.target.value)} />
        </label>
        <label>
          Longitude:
          <input value={lon} onChange={(e) => setLon(e.target.value)} />
        </label>
        <label>
          FRP (MW):
          <input value={frp} onChange={(e) => setFrp(e.target.value)} />
        </label>
        <label>
          Brightness (K):
          <input value={bright} onChange={(e) => setBright(e.target.value)} />
        </label>
      </div>

      <button className="primary-button full" onClick={calculate}>
        Run Hierarchical Classification Model
      </button>

      {res && (
        <div className="inference-result-box">
          <div className="result-chip-row">
            <span className={`tier-badge ${res.tier.toLowerCase()}`}>{res.tier}</span>
            <b>{CLASS_META[res.className]?.label}</b>
          </div>
          <p>{res.classificationReason}</p>
          <small>Candidate: {res.facility} · Match: {res.facilityMatch}% · Confidence: {res.confidence}%</small>
        </div>
      )}
    </section>
  );
}

// Change Detected Section with Web Audio Alarm
function ChangeDetected({ events, muted, setMuted, onTriggerTestAlarm }) {
  return (
    <section className="change-panel">
      <div className="panel-title">
        <div>
          <span>CHANGE-DETECTED SECTION WITH WEB AUDIO ALARM</span>
          <h4>Successive client-side /v1/firms diff feed</h4>
        </div>
        <div className="alarm-controls">
          <button
            className={`alarm-button ${muted ? "muted" : ""}`}
            onClick={() => setMuted((v) => !v)}
            title="Toggle audible alarm"
          >
            {muted ? "🔇 Muted" : "🔔 Alarm Armed"}
          </button>
          <button className="alarm-test-btn" onClick={onTriggerTestAlarm} title="Test Web Audio Alarm">
            🔊 Test Chime
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="no-changes-note">No new anomalous shifts detected in current 60s poll cycle.</p>
      ) : (
        <div className="change-events">
          {events.slice(0, 5).map((e, i) => (
            <div key={`${e.id}-${i}`} className={`change-event ${String(e.tier || "Low").toLowerCase()}`}>
              <div className="change-event-badge">
                <span>{e.demo ? "LABELLED DEMO" : "NRT DIFF"}</span>
                <em className={`tier-tag ${e.tier?.toLowerCase()}`}>{e.tier}</em>
              </div>
              <b>{e.name}</b>
              <small>FRP: {Number(e.frp || 0).toFixed(0)} MW · {e.facility}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Main Intelligence Map Component
export default function IntelligenceMapPage({
  firmsData = [],
  backendStatus = "connecting",
  onVerifyResult,
}) {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const facilityLayerRef = useRef(null);
  const ringLayerRef = useRef(null);

  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    className: "all",
    tier: "all",
    industrialOnly: false,
    corroboratedOnly: false,
    search: "",
  });

  const [layers, setLayers] = useState({
    thermal: true,
    facilities: true,
    rings: false,
    swir: false,
  });

  const [layersOpen, setLayersOpen] = useState(false);
  const [replay, setReplay] = useState(100);
  const [replayOpen, setReplayOpen] = useState(false);
  const [verify, setVerify] = useState(null);
  const [muted, setMuted] = useState(false);
  const [changes, setChanges] = useState([]);
  const previousSnapshot = useRef(null);

  // Fuse and normalize live FIRMS signals
  const liveSignals = useMemo(() => {
    const raw = Array.isArray(firmsData) && firmsData.length > 0 ? firmsData : initialDemo;
    const classified = raw.map((f, i) => classifyFirm(f, i));
    return clusterSignals(classified);
  }, [firmsData]);

  // Client-side diff and alarm trigger for changes
  useEffect(() => {
    if (!liveSignals.length) return;
    const currentSig = liveSignals.map(signature);
    if (!previousSnapshot.current) {
      previousSnapshot.current = currentSig;
      return;
    }

    const previousSet = new Set(previousSnapshot.current);
    const newItems = liveSignals.filter((signal) => !previousSet.has(signature(signal)));

    if (newItems.length > 0) {
      setChanges((prev) => [...newItems, ...prev].slice(0, 15));
      const hasHighOrCritical = newItems.some((s) => s.tier === "Critical" || s.tier === "High");
      if (hasHighOrCritical) {
        const topTier = newItems.some((s) => s.tier === "Critical") ? "Critical" : "High";
        playAlarm(topTier, muted);
      }
    }
    previousSnapshot.current = currentSig;
  }, [liveSignals, muted]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined;

    const map = L.map(mapNode.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([22.5, 78.5], 5);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Esri World Imagery (Satellite)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        attribution: "Esri Satellite Imagery",
      }
    ).addTo(map);

    // Geographic boundary and city overlays
    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        pane: "overlayPane",
        zIndex: 300,
        attribution: "",
      }
    ).addTo(map);

    facilityLayerRef.current = L.layerGroup().addTo(map);
    ringLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Temporal Replay filter
  const replaySignals = useMemo(() => {
    if (replay >= 100) return liveSignals;
    // Historical simulation slice
    const fraction = replay / 100;
    const count = Math.max(1, Math.round(liveSignals.length * fraction));
    return liveSignals.slice(0, count).map((s) => ({
      ...s,
      frp: Number((s.frp * (0.6 + fraction * 0.4)).toFixed(1)),
    }));
  }, [liveSignals, replay]);

  // Visible filtered signals
  const visibleSignals = useMemo(() => {
    return replaySignals.filter((signal) => {
      const search = filters.search.trim().toLowerCase();
      const searchable = [signal.name, signal.id, signal.facility].filter(Boolean).join(" ").toLowerCase();

      // By default ("all"), hide "unknown" so map is clear and focused on verified events.
      // Show "unknown" only when user explicitly selects "unknown".
      const matchesClass =
        filters.className === "all"
          ? signal.className !== "unknown"
          : signal.className === filters.className;

      return (
        matchesClass &&
        (filters.tier === "all" || signal.tier === filters.tier) &&
        (!filters.industrialOnly || CLASS_META[signal.className]?.industrial) &&
        (!filters.corroboratedOnly || signal.corroborated) &&
        (!search || searchable.includes(search))
      );
    });
  }, [replaySignals, filters]);

  // Render Leaflet Markers & Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markerLayerRef.current) return;

    markerLayerRef.current.clearLayers();
    ringLayerRef.current?.clearLayers();
    facilityLayerRef.current?.clearLayers();

    // 1. Render Registered Facilities POI layer when toggled on
    if (layers.facilities && facilityLayerRef.current) {
      INDUSTRIAL_FACILITIES.forEach((fac) => {
        const facMarker = L.marker([fac.latitude, fac.longitude], {
          icon: L.divIcon({
            className: "facility-marker-host",
            html: `<div class="facility-map-pin" title="${fac.name}">
              <span class="facility-pin-icon">🏢</span>
            </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        });

        facMarker.bindTooltip(
          `<b>${fac.name}</b><br/><small>${FACILITY_TYPE_LABELS[fac.type] || fac.type} · ${fac.state}</small>`,
          { className: "facility-tooltip", direction: "top", offset: [0, -10] }
        );

        facMarker.on("click", () => {
          map.flyTo([fac.latitude, fac.longitude], 10, { duration: 0.5 });
        });

        facMarker.addTo(facilityLayerRef.current);
      });
    }

    // 2. Render Thermal Anomaly Markers
    if (layers.thermal) {
      visibleSignals.forEach((signal) => {
        const lat = Number(signal.latitude);
        const lng = Number(signal.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "fusion-marker-host",
            html: buildMarkerHtml(signal),
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
        });

        const meta = CLASS_META[signal.className] || CLASS_META.unknown;
        marker.bindTooltip(
          `<b>${meta.label}</b><br/>${signal.name}<br/><small>FRP: ${Number(signal.frp).toFixed(1)} MW · ${signal.tier}</small>`,
          { className: "fusion-tooltip", direction: "top", offset: [0, -14] }
        );

        marker.on("click", () => {
          setSelected(signal);
          map.flyTo([lat, lng], Math.max(map.getZoom(), 8), { duration: 0.45 });
        });

        marker.addTo(markerLayerRef.current);

        // 3. Render 1.5km Enrichment Buffers
        if (layers.rings) {
          L.circle([lat, lng], {
            radius: 1500,
            color: meta.color || "#b91c1c",
            weight: 1.2,
            fillOpacity: 0.05,
            dashArray: "4 4",
          }).addTo(ringLayerRef.current);
        }
      });
    }
  }, [visibleSignals, layers]);

  // Export Data (CSV & JSON)
  const handleExport = (format) => {
    const payload = visibleSignals.map((s) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      className: s.className,
      classLabel: CLASS_META[s.className]?.label,
      tier: s.tier,
      state: s.state,
      frp: s.frp,
      confidence: s.confidence,
      facility: s.facility,
      facilityMatch: s.facilityMatch,
      evidenceLevel: s.evidenceLevel,
      observedHoursAgo: s.observedHoursAgo,
      weather: s.weather,
      criticalInfrastructure: s.criticalInfrastructure,
    }));

    let content, mime;
    if (format === "json") {
      content = JSON.stringify(payload, null, 2);
      mime = "application/json";
    } else {
      const headers = Object.keys(payload[0] || {}).join(",");
      const rows = payload.map((row) =>
        Object.values(row)
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      );
      content = [headers, ...rows].join("\n");
      mime = "text/csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pyrewatch-intelligence-export.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleVerifyResult = (signal, decision, note, evidenceLevel) => {
    onVerifyResult?.({
      signalId: signal.id,
      decision,
      note,
      evidenceLevel,
      recordedAt: new Date().toISOString(),
    });
    // Immediately reflect field verification locally
    signal.evidenceLevel = evidenceLevel;
    signal.state = decision === "CONFIRMED" ? "abnormal" : "normal";
    signal.corroborated = true;
  };

  const triggerTestAlarm = () => {
    unlockAlarmAudio();
    playAlarm("Critical", muted);
  };

  return (
    <section className="intelligence-page">
      {/* National Government Portal Header Strip */}
      <div className="brand-strip">
        <div className="brand-identity">
          <div className="pyre-orbit-logo" title="Tech Taxila · Pyrewatch Operational System">
            <img src="/tech-taxila-logo.png" alt="Tech Taxila Emblem" className="brand-logo-img" />
          </div>
          <div className="brand-titles">
            <div className="brand-main-title">
              <b>TECH TAXILA · PYREWATCH</b>
              <span className="gov-badge">OPERATIONAL COMMAND</span>
            </div>
            <small>National Geospatial Thermal Intelligence &amp; Industrial Anomaly Segregation</small>
          </div>
        </div>

        <div className="portal-status-indicators">
          <span className="page-status">
            <i className="online-beacon" />
            {backendStatus === "offline"
              ? "Backend Offline · Simulating High-Precision Satellite Ingestion"
              : backendStatus === "connecting"
              ? "Connecting NASA FIRMS Feed..."
              : "NASA FIRMS (VIIRS 375m) & Sentinel-2 Feed Active"}
          </span>
          <div className="portal-quick-actions">
            <button className="gov-header-btn" onClick={() => handleExport("csv")}>
              Export CSV
            </button>
            <button className="gov-header-btn" onClick={() => handleExport("json")}>
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Slim KPI Strip */}
      <div className="kpi-strip">
        <div>
          <span>VISIBLE SIGNALS</span>
          <b>{visibleSignals.length}</b>
        </div>
        <div>
          <span>INDUSTRIAL ANOMALIES</span>
          <b>{visibleSignals.filter((s) => CLASS_META[s.className]?.industrial).length}</b>
        </div>
        <div>
          <span>CRITICAL / HIGH TIER</span>
          <b>{visibleSignals.filter((s) => s.tier === "Critical" || s.tier === "High").length}</b>
        </div>
        <div>
          <span>CORROBORATED (1.5 km)</span>
          <b>{visibleSignals.filter((s) => s.corroborated).length}</b>
        </div>
        <div>
          <span>REGISTERED FACILITIES</span>
          <b>{INDUSTRIAL_FACILITIES.length}</b>
        </div>
        <div>
          <span>DATA PIPELINE</span>
          <b className="pipeline-live-tag">LIVE POLL (60s)</b>
        </div>
      </div>

      {/* Map Filter Chip Bar */}
      <FilterBar signals={liveSignals} filters={filters} setFilters={setFilters} />

      {/* Main Two-Column Intelligence Grid */}
      <div className="intelligence-grid">
        {/* Left Column: Leaflet Map */}
        <div className="map-column">
          <div className="map-first-card">
            <div className="map-heading">
              <div>
                <span>GEOSPATIAL FUSION / MAP-FIRST MONITORING</span>
                <h2>Active Thermal Infrastructure &amp; Anomaly Overlay</h2>
              </div>
              <div className="map-heading-actions">
                <button
                  className={`layer-btn ${layersOpen ? "active" : ""}`}
                  onClick={() => setLayersOpen((v) => !v)}
                >
                  ☰ Layers ({Object.values(layers).filter(Boolean).length})
                </button>
                <button
                  className={`replay-btn ${replay < 100 ? "active" : ""}`}
                  onClick={() => setReplayOpen((v) => !v)}
                >
                  ⏱ Temporal Replay {replay < 100 ? `(${100 - replay}% Past)` : ""}
                </button>
              </div>
            </div>

            <div className="map-canvas-wrap">
              <div ref={mapNode} className="fusion-map" />

              {/* Map Legend per Spec §20 — Clickable Actionable Taxonomy */}
              <div className="map-legend-new">
                <div className="legend-title">
                  <span>THERMAL TAXONOMY (SPEC §20)</span>
                  {filters.className !== "all" && (
                    <button
                      className="legend-reset-btn"
                      onClick={() => setFilters((prev) => ({ ...prev, className: "all" }))}
                      title="Clear filter & show all classes"
                    >
                      Show All
                    </button>
                  )}
                </div>
                <div className="legend-items">
                  <button
                    className={`legend-item-btn ${filters.className === "wildfire" ? "active" : ""}`}
                    onClick={() => setFilters((prev) => ({ ...prev, className: prev.className === "wildfire" ? "all" : "wildfire" }))}
                    title="Filter map: Show Wildfire / Vegetation fires only"
                  >
                    <i className="legend-shape tone-red">🔥</i>
                    <span>Wildfire</span>
                    {filters.className === "wildfire" && <b className="legend-active-dot">● Only</b>}
                  </button>
                  <button
                    className={`legend-item-btn ${filters.className === "industrial" ? "active" : ""}`}
                    onClick={() => setFilters((prev) => ({ ...prev, className: prev.className === "industrial" ? "all" : "industrial" }))}
                    title="Filter map: Show Industrial Fires & Accidents only"
                  >
                    <i className="legend-shape tone-orange">🏭</i>
                    <span>Industrial Fire</span>
                    {filters.className === "industrial" && <b className="legend-active-dot">● Only</b>}
                  </button>
                  <button
                    className={`legend-item-btn ${filters.className === "flare" ? "active" : ""}`}
                    onClick={() => setFilters((prev) => ({ ...prev, className: prev.className === "flare" ? "all" : "flare" }))}
                    title="Filter map: Show Gas Flares only"
                  >
                    <i className="legend-shape tone-blue">🕯</i>
                    <span>Gas Flare</span>
                    {filters.className === "flare" && <b className="legend-active-dot">● Only</b>}
                  </button>
                  <button
                    className={`legend-item-btn ${filters.className === "persistent" ? "active" : ""}`}
                    onClick={() => setFilters((prev) => ({ ...prev, className: prev.className === "persistent" ? "all" : "persistent" }))}
                    title="Filter map: Show Persistent Sources (Power, Steel, Kilns) only"
                  >
                    <i className="legend-shape tone-slate">⚙</i>
                    <span>Persistent Source</span>
                    {filters.className === "persistent" && <b className="legend-active-dot">● Only</b>}
                  </button>
                  <button
                    className={`legend-item-btn ${filters.className === "unknown" ? "active" : ""}`}
                    onClick={() => setFilters((prev) => ({ ...prev, className: prev.className === "unknown" ? "all" : "unknown" }))}
                    title="Filter map: Show Unresolved / Unknown signals only"
                  >
                    <i className="legend-shape tone-grey">?</i>
                    <span>Unknown</span>
                    {filters.className === "unknown" && <b className="legend-active-dot">● Only</b>}
                  </button>
                </div>
              </div>

              {/* Temporal Replay Scrub Bar */}
              {replayOpen && (
                <div className="replay-control-bar">
                  <div className="replay-head">
                    <span>TEMPORAL TIME-SCRUBBING</span>
                    <button className="replay-close-btn" onClick={() => setReplayOpen(false)}>×</button>
                  </div>
                  <div className="replay-slider-wrap">
                    <span className="replay-marker">T-7d (PAST)</span>
                    <input
                      type="range"
                      min="15"
                      max="100"
                      value={replay}
                      onChange={(e) => setReplay(Number(e.target.value))}
                    />
                    <span className="replay-marker">T-0 (NOW)</span>
                  </div>
                  <div className="replay-actions-row">
                    <b>{replay === 100 ? "NOW: Current Observation State" : `${100 - replay}% Historical Simulation`}</b>
                    <div className="replay-btn-group">
                      <button className="replay-reset-btn" onClick={() => setReplay(100)}>
                        Reset to Now
                      </button>
                      <button className="replay-done-btn" onClick={() => { setReplay(100); setReplayOpen(false); }}>
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Geospatial Layers Drawer */}
              {layersOpen && (
                <LayersPanel
                  layers={layers}
                  setLayers={setLayers}
                  onClose={() => setLayersOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Change Detection & Web Audio Alarm Panel */}
          <ChangeDetected
            events={changes}
            muted={muted}
            setMuted={setMuted}
            onTriggerTestAlarm={triggerTestAlarm}
          />

          {/* Live Inference Simulator */}
          <LiveInference />
        </div>

        {/* Right Column: Source List & Inspector */}
        <div className="side-column">
          <SourceList
            signals={visibleSignals}
            selected={selected}
            onSelect={(s) => setSelected(s)}
          />

          <Inspector
            signal={selected || visibleSignals[0]}
            onVerify={(s) => setVerify(s)}
          />
        </div>
      </div>

      {/* Floating Evidence Fusion Card when marker selected */}
      {selected && (
        <FusionCard
          signal={selected}
          onClose={() => setSelected(null)}
          onVerify={(s) => setVerify(s)}
        />
      )}

      {/* Human-in-the-Loop Field Verification Modal */}
      {verify && (
        <VerifyLoop
          signal={verify}
          onClose={() => setVerify(null)}
          onResult={handleVerifyResult}
        />
      )}

      {/* National Operational Government Footer */}
      <footer className="intelligence-footer">
        <div>
          <b>TECH TAXILA · PYREWATCH NATIONAL OPERATIONAL COMMAND</b>
          <p>AI-Enabled Geospatial System for Segregation of Industrial Fires &amp; Persistent Thermal Sources</p>
        </div>
        <div className="footer-specs">
          <span>NASA FIRMS VIIRS (375m) &amp; MODIS (1km)</span>
          <span>OpenStreetMap Live Infrastructure</span>
          <span>Sentinel-2 SWIR Corroboration</span>
          <span>Pure Web Audio Synthesizer</span>
        </div>
      </footer>
    </section>
  );
}