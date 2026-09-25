import { useEffect, useMemo, useState } from "react";
import {
  IGPS_CLASSES,
  TIERS,
  IGPS_PRESETS,
  getIgpsSources,
  getIgpsSource,
  getIgpsStats,
  predictIgps,
  exportGeoJSON,
  exportCSV,
  exportKML,
} from "../igps";

const classLabel = (id) => IGPS_CLASSES.find((c) => c.id === id)?.label || id;
const classTone = (id) => IGPS_CLASSES.find((c) => c.id === id)?.tone || "mint";
const NATURAL_CLASSES = ["agricultural_burn", "forest_wildfire"];

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "under 1h ago";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function TierBadge({ tier }) {
  return <span className={`igps-tier igps-tier-${tier}`}>Tier {tier}</span>;
}

function ToneChip({ tone, children }) {
  return <span className={`igps-chip tone-${tone}`}>{children}</span>;
}

function SourceDossier({ id, onClose }) {
  const [source, setSource] = useState(null);
  const [status, setStatus] = useState("loading");
  const [featureTab, setFeatureTab] = useState("FIRMS raw + derived");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getIgpsSource(id)
      .then((data) => {
        if (cancelled) return;
        setSource(data);
        setStatus(data ? "ready" : "empty");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="igps-dossier-overlay" onClick={onClose}>
      <aside className="igps-dossier" role="dialog" aria-label={`Source dossier ${id}`} onClick={(e) => e.stopPropagation()}>
        <div className="igps-dossier-head">
          <div>
            <span>SOURCE DOSSIER</span>
            <h3>{id}</h3>
          </div>
          <button onClick={onClose} aria-label="Close dossier">✕</button>
        </div>
        {status === "loading" && <p className="igps-note">Loading high-resolution evidence…</p>}
        {status === "error" && <p className="igps-note igps-note-error">Could not load this source record.</p>}
        {status === "empty" && <p className="igps-note">No record found for this source ID.</p>}
        {status === "ready" && source && (
          <div className="igps-dossier-body">
            <div className="igps-dossier-summary-card">
              <div className="summary-left">
                <ToneChip tone={classTone(source.predicted_class)}>{classLabel(source.predicted_class)}</ToneChip>
                <TierBadge tier={source.confidence_tier} />
              </div>
              <div className="summary-right">
                <span className="summary-prob-num">{(source.probability * 100).toFixed(1)}%</span>
                <span className="summary-prob-lbl">Calibrated Confidence</span>
              </div>
            </div>

            <div className="igps-dossier-grid">
              <div className="dossier-stat-tile">
                <span>FACILITY MATCH</span>
                <b>{source.corroboration.matched ? source.corroboration.facility_name : "No Immediate Facility"}</b>
                {source.corroboration.matched && (
                  <small>
                    {source.corroboration.distance_m}m from {source.corroboration.dataset}
                  </small>
                )}
              </div>
              <div className="dossier-stat-tile">
                <span>FIRST OBSERVED</span>
                <b>{new Date(source.first_seen).toLocaleDateString()}</b>
                <small>Pass timestamp</small>
              </div>
              <div className="dossier-stat-tile">
                <span>LATEST PASS</span>
                <b>{timeAgo(source.last_seen)}</b>
                <small>VIIRS NRT</small>
              </div>
              <div className="dossier-stat-tile">
                <span>TOTAL DETECTIONS</span>
                <b>{source.detection_count} Passes</b>
                <small>Cluster history</small>
              </div>
            </div>

            <div className="igps-conformal-card">
              <div className="conformal-title">
                <span>CONFORMAL PREDICTION SET (~90% Coverage Guarantee)</span>
              </div>
              <div className="conformal-chips">
                {source.conformal_set.map((cls) => (
                  <ToneChip tone={classTone(cls)} key={cls}>{classLabel(cls)}</ToneChip>
                ))}
              </div>
            </div>

            <nav className="igps-feature-tabs">
              {Object.keys(source.features).map((group) => (
                <button
                  key={group}
                  className={featureTab === group ? "active" : ""}
                  onClick={() => setFeatureTab(group)}
                >
                  {group}
                </button>
              ))}
            </nav>

            <div className="igps-feature-list">
              {source.features[featureTab]?.map(([label, value]) => (
                <div key={label} className="feature-item">
                  <small>{label}</small>
                  <b>{String(value)}</b>
                </div>
              ))}
            </div>

            <div className="igps-dossier-actions">
              <button className="dossier-close-btn" onClick={onClose}>Done Inspecting</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function RegistryTab() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [classFilter, setClassFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [corroboratedOnly, setCorroboratedOnly] = useState(false);
  const [industrialOnly, setIndustrialOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getIgpsSources({ cls: classFilter || undefined, tier: tierFilter || undefined, corroboratedOnly })
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setStatus(data.length ? "ready" : "empty");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [classFilter, tierFilter, corroboratedOnly]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (industrialOnly) {
      list = list.filter((r) => !NATURAL_CLASSES.includes(r.predicted_class));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.predicted_class.toLowerCase().includes(q) ||
          (r.corroboration?.facility_name && r.corroboration.facility_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, industrialOnly, search]);

  const visibleRows = filteredRows.slice(0, visibleCount);

  return (
    <div className="igps-registry-container">
      {/* Search and Filter Controls */}
      <div className="igps-filters-card">
        <div className="filters-left">
          <button
            className={"igps-chip-btn " + (industrialOnly ? "active" : "")}
            onClick={() => setIndustrialOnly((v) => !v)}
          >
            🏭 Industrial only
          </button>
          <button
            className={"igps-chip-btn " + (corroboratedOnly ? "active" : "")}
            onClick={() => setCorroboratedOnly((v) => !v)}
          >
            ✓ Corroborated only
          </button>
          <select
            className="igps-select"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">All Classification Classes</option>
            {IGPS_CLASSES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <select
            className="igps-select"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
          >
            <option value="">All Confidence Tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>Tier {t}</option>
            ))}
          </select>
        </div>
        <div className="filters-right">
          <input
            type="text"
            className="igps-search-input"
            placeholder="Search source ID, site or facility…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {status === "loading" && (
        <div className="igps-loading-state">
          <div className="loading-spinner" />
          <p>Querying national thermal registry &amp; satellite records…</p>
        </div>
      )}

      {status === "error" && (
        <div className="igps-error-state">
          <p>Could not connect to the remote source registry. Falling back to local cache.</p>
        </div>
      )}

      {status === "empty" && (
        <div className="igps-empty-state">
          <p>No thermal sources match the specified filters.</p>
          <button className="igps-reset-btn" onClick={() => { setClassFilter(""); setTierFilter(""); setIndustrialOnly(false); setCorroboratedOnly(false); setSearch(""); }}>
            Reset Filters
          </button>
        </div>
      )}

      {status === "ready" && (
        <div className="igps-table-wrapper">
          <table className="igps-modern-table">
            <thead>
              <tr>
                <th style={{ width: "95px" }}>ID</th>
                <th style={{ width: "160px" }}>CLASSIFICATION</th>
                <th style={{ width: "95px" }}>TIER</th>
                <th style={{ width: "170px" }}>PROBABILITY</th>
                <th style={{ width: "170px" }}>CORROBORATION</th>
                <th style={{ width: "110px" }}>LAST SEEN</th>
                <th style={{ width: "90px", textAlign: "right" }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className={selectedId === row.id ? "row-selected" : ""}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="cell-id">
                    <code>{row.id}</code>
                  </td>
                  <td>
                    <ToneChip tone={classTone(row.predicted_class)}>
                      {classLabel(row.predicted_class)}
                    </ToneChip>
                  </td>
                  <td>
                    <TierBadge tier={row.confidence_tier} />
                  </td>
                  <td>
                    <div className="prob-bar-cell">
                      <div className="prob-track">
                        <div
                          className="prob-fill"
                          style={{ width: `${Math.max(5, row.probability * 100)}%` }}
                        />
                      </div>
                      <span className="prob-pct">{(row.probability * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td>
                    {row.corroboration.matched ? (
                      <span className="corrob-badge matched" title={row.corroboration.facility_name}>
                        ✓ {row.corroboration.dataset}
                      </span>
                    ) : (
                      <span className="corrob-badge uncorroborated">— Isolated</span>
                    )}
                  </td>
                  <td className="cell-time">{timeAgo(row.last_seen)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(row.id);
                      }}
                    >
                      Inspect ➔
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="igps-table-footer-bar">
            <span>
              Showing <strong>{visibleRows.length}</strong> of <strong>{filteredRows.length}</strong> thermal sources
            </span>
            {visibleCount < filteredRows.length && (
              <button className="load-more-btn" onClick={() => setVisibleCount((v) => v + 40)}>
                Load More Records (40)
              </button>
            )}
          </div>
        </div>
      )}

      {selectedId && <SourceDossier id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function InferenceTab() {
  const [form, setForm] = useState({
    lat: "22.3511",
    lng: "69.8493",
    frp: "62",
    brightness_k: "356",
    land_cover: "industrial",
  });
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");

  const applyPreset = (preset) => {
    setForm({
      lat: String(preset.lat),
      lng: String(preset.lng),
      frp: String(preset.frp),
      brightness_k: String(preset.brightness_k),
      land_cover: preset.land_cover,
    });
  };

  const runInference = async () => {
    setStatus("loading");
    try {
      const output = await predictIgps({
        lat: Number(form.lat),
        lng: Number(form.lng),
        frp: Number(form.frp),
        brightness_k: Number(form.brightness_k),
        land_cover: form.land_cover,
      });
      setResult(output);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="igps-inference-container">
      {/* Preset Quick-Selector Strip */}
      <div className="presets-bar">
        <span className="presets-label">⚡ INDIAN INDUSTRIAL PRESETS:</span>
        <div className="presets-chips">
          {IGPS_PRESETS.map((p) => (
            <button
              key={p.name}
              className="preset-chip"
              onClick={() => applyPreset(p)}
              title={`${p.name} (FRP: ${p.frp}MW, ${p.land_cover})`}
            >
              📍 {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="inference-split-grid">
        {/* Left Column: Input Form */}
        <div className="inference-form-card">
          <div className="card-header">
            <h4>Satellite &amp; Geospatial Parameters</h4>
            <span className="sensor-tag">NASA FIRMS VIIRS 375m Inputs</span>
          </div>

          <div className="form-fields-grid">
            <div className="field-group">
              <label>Latitude (Degrees N)</label>
              <input
                type="number"
                step="0.0001"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
              />
            </div>

            <div className="field-group">
              <label>Longitude (Degrees E)</label>
              <input
                type="number"
                step="0.0001"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
              />
            </div>

            <div className="field-group">
              <label>Fire Radiative Power (MW)</label>
              <input
                type="number"
                step="0.1"
                value={form.frp}
                onChange={(e) => setForm({ ...form, frp: e.target.value })}
              />
            </div>

            <div className="field-group">
              <label>Brightness Temp (Kelvin)</label>
              <input
                type="number"
                step="0.1"
                value={form.brightness_k}
                onChange={(e) => setForm({ ...form, brightness_k: e.target.value })}
              />
            </div>

            <div className="field-group field-full">
              <label>Corroborated Land Cover Class</label>
              <select
                value={form.land_cover}
                onChange={(e) => setForm({ ...form, land_cover: e.target.value })}
              >
                <option value="industrial">Industrial Complex / Refinery Zone</option>
                <option value="offshore">Offshore Platform / Marine Basin</option>
                <option value="agricultural">Agricultural Farmland / Crop Residue</option>
                <option value="forest">Protected Forest / Dense Canopy</option>
              </select>
            </div>
          </div>

          <button
            className="run-inference-btn"
            onClick={runInference}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Executing Geospatial Inference…" : "⚡ Run Real-Time Classification"}
          </button>
        </div>

        {/* Right Column: Model Decision Output */}
        <div className="inference-result-card">
          <div className="card-header">
            <h4>Classification Output &amp; Decision Confidence</h4>
            <span className="sensor-tag">Pyrewatch MCDA Decision Engine</span>
          </div>

          {status === "idle" && (
            <div className="result-placeholder">
              <span className="placeholder-icon">🛰</span>
              <h5>Classifier Ready</h5>
              <p>Select any Indian industrial preset or enter coordinates, then click Run Real-Time Classification.</p>
            </div>
          )}

          {status === "loading" && (
            <div className="result-placeholder">
              <div className="loading-spinner" />
              <h5>Simulating Satellite Pass Inference…</h5>
              <p>Calculating cross-layer spatial distance, calibrated FRP ratio, and conformal bounds.</p>
            </div>
          )}

          {status === "error" && (
            <div className="result-placeholder error">
              <span className="placeholder-icon">⚠️</span>
              <h5>Classification Failure</h5>
              <p>Model could not process the provided coordinates. Please verify your numerical inputs.</p>
            </div>
          )}

          {status === "ready" && result && (
            <div className="result-content-body">
              <div className="decision-banner">
                <div className="decision-class">
                  <ToneChip tone={classTone(result.predicted_class)}>
                    {classLabel(result.predicted_class)}
                  </ToneChip>
                  <TierBadge tier={result.confidence_tier} />
                </div>
                <div className="decision-gauge">
                  <span className="gauge-val">{(result.probability * 100).toFixed(1)}%</span>
                  <span className="gauge-lbl">Calibrated Probability</span>
                </div>
              </div>

              <div className="conformal-box">
                <div className="conformal-header">
                  <span>CONFORMAL PREDICTION SET</span>
                  <b>~{(result.coverage * 100).toFixed(0)}% Coverage Guarantee</b>
                </div>
                <div className="conformal-pills">
                  {result.conformal_set.map((cls) => (
                    <ToneChip tone={classTone(cls)} key={cls}>
                      {classLabel(cls)}
                    </ToneChip>
                  ))}
                </div>
              </div>

              <div className="feature-attribution-box">
                <h6>MODEL DECISION RATIONALE:</h6>
                <p>{result.note}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportTab() {
  const [classFilter, setClassFilter] = useState("");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getIgpsSources({ cls: classFilter || undefined })
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [classFilter]);

  return (
    <div className="igps-export-container">
      {/* Top Filter Bar */}
      <div className="export-filter-bar">
        <label>
          Filter Dataset:
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All Classification Classes ({rows.length || "…"})</option>
            {IGPS_CLASSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <span className="dataset-count-badge">
          {rows.length} verified thermal records ready
        </span>
      </div>

      {/* 3 Major Export Format Cards */}
      <div className="export-cards-grid">
        <div className="export-card">
          <div className="export-icon">🗺️</div>
          <h3>GeoJSON FeatureCollection</h3>
          <p>
            Standard RFC 7946 geospatial geometry with point coordinates, FRP values,
            calibrated probability, and facility matching metadata.
          </p>
          <div className="export-meta">
            <span>Target: QGIS, ArcGIS Pro, Mapbox</span>
          </div>
          <button
            className="export-action-btn"
            disabled={status !== "ready"}
            onClick={() => exportGeoJSON(rows)}
          >
            Download GeoJSON
          </button>
        </div>

        <div className="export-card">
          <div className="export-icon">📊</div>
          <h3>CSV Geospatial Dataset</h3>
          <p>
            Tabular comma-separated records with latitude, longitude, observation timestamps,
            FRP, confidence tiers, and nearest infrastructure names.
          </p>
          <div className="export-meta">
            <span>Target: Python Pandas, R, Microsoft Excel</span>
          </div>
          <button
            className="export-action-btn"
            disabled={status !== "ready"}
            onClick={() => exportCSV(rows)}
          >
            Download CSV Dataset
          </button>
        </div>

        <div className="export-card">
          <div className="export-icon">🌐</div>
          <h3>Google Earth 3D KML</h3>
          <p>
            Keyhole Markup Language export structured by class folders with custom pin styles,
            elevation mapping, and thermal emission popups.
          </p>
          <div className="export-meta">
            <span>Target: Google Earth Pro 3D flyover</span>
          </div>
          <button
            className="export-action-btn"
            disabled={status !== "ready"}
            onClick={() => exportKML(rows)}
          >
            Download KML Package
          </button>
        </div>
      </div>

      <div className="export-notice-banner">
        <span>🔒 CLIENT-SIDE GENERATION:</span>
        <p>Exports execute client-side directly against the active filtered set. No data egress to unverified endpoints.</p>
      </div>
    </div>
  );
}

function IgpsPage() {
  const [tab, setTab] = useState("registry");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getIgpsStats().then(setStats).catch(() => {});
  }, []);

  return (
    <section className="igps-page">
      {/* Hero Header */}
      <div className="igps-hero">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="badge-dot" />
            NATIONAL GEOSPATIAL THERMAL INTELLIGENCE
          </div>
          <h2>Industrial Fire, Flare &amp; Thermal Source Segregation</h2>
          <p>
            Five-class Geospatial Expert Classification Engine with conformal uncertainty bounds,
            corroborated against GEM, OpenStreetMap, the WRI Power Plant Database, and the NOAA EOG Flare Inventory.
          </p>
        </div>
        <div className="hero-badge">
          <b>CALIBRATED MODEL</b>
          <span>Pyrewatch MCDA Engine</span>
        </div>
      </div>

      {/* KPI Stats Strip */}
      {stats && (
        <div className="igps-stats">
          <article className="stat-card">
            <span>TOTAL SOURCES SCORED</span>
            <b>{stats.total}</b>
            <small>Active national catalog</small>
          </article>
          <article className="stat-card">
            <span>INDUSTRIAL SOURCES</span>
            <b>{stats.industrialCount}</b>
            <small>Flares &amp; manufacturing</small>
          </article>
          <article className="stat-card">
            <span>CORROBORATED (&lt;1 KM)</span>
            <b>{stats.corroboratedCount}</b>
            <small>Asset boundary match</small>
          </article>
          <article className="stat-card">
            <span>ENRICHMENT FACTOR</span>
            <b>{stats.enrichmentFactor}×</b>
            <small>Over raw FIRMS accuracy</small>
          </article>
        </div>
      )}

      {/* Tabs */}
      <nav className="igps-tabs">
        <button
          className={tab === "registry" ? "active" : ""}
          onClick={() => setTab("registry")}
        >
          📋 Source Registry ({stats?.total || "…"})
        </button>
        <button
          className={tab === "inference" ? "active" : ""}
          onClick={() => setTab("inference")}
        >
          ⚡ Live Model Inference
        </button>
        <button
          className={tab === "export" ? "active" : ""}
          onClick={() => setTab("export")}
        >
          📥 Geospatial Export (GIS / CSV)
        </button>
      </nav>

      {/* Tab Panels */}
      {tab === "registry" && <RegistryTab />}
      {tab === "inference" && <InferenceTab />}
      {tab === "export" && <ExportTab />}
    </section>
  );
}

export default IgpsPage;
