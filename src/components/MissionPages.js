import { useState } from "react";

const sourceRows = [
  [
    "NASA FIRMS / VIIRS",
    "Thermal anomalies, FRP, confidence",
    "Live",
    "4 min ago",
    "mint",
  ],
  [
    "OpenStreetMap + GIS",
    "Industrial zones, facilities, assets",
    "Synced",
    "2 hr ago",
    "blue",
  ],
  [
    "Sentinel-2 imagery",
    "Multispectral scene confirmation",
    "Healthy",
    "18 min ago",
    "amber",
  ],
  [
    "Landsat thermal archive",
    "Historical land surface temperature",
    "Healthy",
    "Yesterday",
    "mint",
  ],
];

export function AnalyticsPage() {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [activeMix, setActiveMix] = useState(null);
  const mix = [
    { name: "Industrial fire", value: "12%", count: "46", tone: "coral" },
    { name: "Persistent source", value: "31%", count: "119", tone: "mint" },
    { name: "Other / natural", value: "57%", count: "219", tone: "amber" },
  ];
  const trendPoints = [
    ["01 AUG", 42, 31], ["05 AUG", 57, 44], ["08 AUG", 46, 36],
    ["12 AUG", 73, 56], ["15 AUG", 59, 42], ["18 AUG", 71, 61],
    ["22 AUG", 63, 50], ["26 AUG", 88, 73], ["30 AUG", 82, 77],
  ];
  const updateHover = (event) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const position = Math.max(0, Math.min(0.999, (event.clientX - left) / width));
    setHoveredPoint(Math.round(position * (trendPoints.length - 1)));
  };
  return (
    <section className="mission-page">
      <div className="mission-heading">
        <div>
          <p className="eyebrow">AI DECISION INTELLIGENCE</p>
          <h2>Classification performance</h2>
          <span>
            How the model separates industrial incidents from persistent and
            natural heat.
          </span>
        </div>
        <button className="date-button">Last 30 days ▾</button>
      </div>
      <div className="classification-grid">
        <article className="class-chart card">
          <div className="card-head">
            <div>
              <p>EVENT SEGREGATION</p>
              <h3>Thermal source mix</h3>
            </div>
            <span className="chart-total">100%</span>
          </div>
          <div className={"donut " + (activeMix ? `mix-${activeMix.tone}` : "") }>
            <div>
              <strong>{activeMix ? activeMix.count : "384"}</strong>
              <small>{activeMix ? activeMix.name : "events reviewed"}</small>
            </div>
          </div>
          <div className="class-legend">
            {mix.map((item) => (
              <button
                className={activeMix?.tone === item.tone ? "active" : ""}
                onMouseEnter={() => setActiveMix(item)}
                onMouseLeave={() => setActiveMix(null)}
                onFocus={() => setActiveMix(item)}
                onBlur={() => setActiveMix(null)}
                onClick={() => setActiveMix(activeMix?.tone === item.tone ? null : item)}
                key={item.tone}
              >
                <i className={item.tone} /> {item.name} <b>{item.value}</b>
              </button>
            ))}
          </div>
        </article>

        {/* Spatial Clustering & Facility Density Correlation Diagram */}
        <article className="cluster-chart card">
          <div className="card-head">
            <div>
              <p>GEOSPATIAL CLUSTERING & DENSITY CORRELATION</p>
              <h3>Infrastructure proximity & noise filtering</h3>
            </div>
            <span className="cluster-efficiency-tag">DBSCAN · 84.2% Corroborated</span>
          </div>

          <div className="cluster-visual-wrap">
            <svg viewBox="0 0 460 210" className="cluster-svg">
              {/* Background Radar Grid */}
              <circle cx="230" cy="105" r="95" fill="none" stroke="rgba(185,28,28,0.12)" strokeDasharray="3 3" />
              <circle cx="230" cy="105" r="65" fill="none" stroke="rgba(185,28,28,0.18)" strokeDasharray="3 3" />
              <circle cx="230" cy="105" r="35" fill="none" stroke="rgba(185,28,28,0.25)" />
              <line x1="230" y1="5" x2="230" y2="205" stroke="rgba(185,28,28,0.08)" />
              <line x1="130" y1="105" x2="330" y2="105" stroke="rgba(185,28,28,0.08)" />

              {/* Cluster 1: Refinery Petrochem Complex (Dense Industrial Hotspot) */}
              <g className="cluster-group cluster-1">
                <circle cx="160" cy="80" r="32" fill="rgba(234,88,12,0.15)" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="4 2" />
                <circle cx="160" cy="80" r="16" fill="rgba(234,88,12,0.3)" />
                <rect x="154" y="74" width="12" height="12" rx="3" fill="#ea580c" />
                <text x="160" y="82" fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">🏢</text>
                {/* VIIRS Hotspots */}
                <circle cx="152" cy="70" r="4.5" fill="#dc2626" className="anim-pulse" />
                <circle cx="170" cy="74" r="4" fill="#0284c7" />
                <circle cx="162" cy="92" r="3.5" fill="#ea580c" />
                <circle cx="146" cy="84" r="3.5" fill="#dc2626" />
                <text x="160" y="122" fill="#7f1d1d" fontSize="9" fontWeight="700" textAnchor="middle">Jamnagar Hub</text>
                <text x="160" y="132" fill="#9ca3af" fontSize="8" textAnchor="middle">18 hits · 0.2km core</text>
              </g>

              {/* Cluster 2: Thermal Power Plant & Steel Belt */}
              <g className="cluster-group cluster-2">
                <circle cx="295" cy="75" r="28" fill="rgba(71,85,105,0.15)" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 2" />
                <circle cx="295" cy="75" r="14" fill="rgba(71,85,105,0.28)" />
                <rect x="289" y="69" width="12" height="12" rx="3" fill="#475569" />
                <text x="295" y="77" fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">⚙</text>
                {/* Hotspots */}
                <circle cx="286" cy="68" r="4" fill="#475569" />
                <circle cx="304" cy="72" r="4" fill="#475569" />
                <circle cx="298" cy="86" r="3.5" fill="#ea580c" />
                <text x="295" y="115" fill="#7f1d1d" fontSize="9" fontWeight="700" textAnchor="middle">Korba Power Belt</text>
                <text x="295" y="125" fill="#9ca3af" fontSize="8" textAnchor="middle">12 hits · 0.5km buffer</text>
              </g>

              {/* Cluster 3: Isolated Wildfire vs Agricultural (Noise Rejection) */}
              <g className="cluster-group cluster-3">
                <circle cx="230" cy="165" r="22" fill="rgba(220,38,38,0.12)" stroke="#dc2626" strokeWidth="1.2" strokeDasharray="3 3" />
                <circle cx="225" cy="162" r="4" fill="#dc2626" />
                <circle cx="236" cy="167" r="3.5" fill="#dc2626" />
                <circle cx="228" cy="172" r="3" fill="#dc2626" />
                <text x="230" y="196" fill="#7f1d1d" fontSize="9" fontWeight="700" textAnchor="middle">Forest Fire Line</text>
                <text x="230" y="206" fill="#9ca3af" fontSize="8" textAnchor="middle">24.8km from industry (Natural)</text>
              </g>

              {/* Distance Buffer Labels */}
              <text x="335" y="102" fill="#9ca3af" fontSize="8" letterSpacing="0.05em">8.5 km buffer</text>
              <text x="298" y="145" fill="#9ca3af" fontSize="7">1.5 km inner ring</text>
            </svg>
          </div>

          <div className="cluster-metrics-row">
            <div className="cluster-metric-item">
              <span>FACILITY MATCH</span>
              <b>84.2%</b>
              <small>Within 8.5km core</small>
            </div>
            <div className="cluster-metric-item">
              <span>NOISE REJECTION</span>
              <b>88.6%</b>
              <small>Uncertainty dropped</small>
            </div>
            <div className="cluster-metric-item">
              <span>AVG CLUSTER RADIUS</span>
              <b>2.3 km</b>
              <small>Multi-sensor centroid</small>
            </div>
          </div>
        </article>
      </div>

      <div className="trend-card card">
        <div className="card-head">
          <div>
            <p>ANOMALY ACTIVITY</p>
            <h3>Signal volume and model response</h3>
          </div>
          <div className="trend-key">
            <span>
              <i className="coral" /> Detected anomalies
            </span>
            <span>
              <i className="mint" /> Confirmed events
            </span>
          </div>
        </div>
        <div className="trend-graph" onMouseMove={updateHover} onMouseLeave={() => setHoveredPoint(null)}>
          <div className="graph-grid" />
          <svg viewBox="0 0 900 190" preserveAspectRatio="none">
            <defs>
              <linearGradient id="anomalyFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff6653" stopOpacity=".22" />
                <stop offset="100%" stopColor="#ff6653" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="area-path"
              d="M0 150 C70 145 90 105 150 119 S220 168 280 108 S350 95 420 112 S500 63 550 91 S640 102 700 55 S790 76 900 35 V190 H0Z"
            />
            <path
              className="line-path coral-line"
              d="M0 150 C70 145 90 105 150 119 S220 168 280 108 S350 95 420 112 S500 63 550 91 S640 102 700 55 S790 76 900 35"
            />
            <path
              className="line-path mint-line"
              d="M0 168 C70 158 90 133 150 144 S220 170 280 137 S350 122 420 142 S500 88 550 119 S640 127 700 91 S790 105 900 69"
            />
          </svg>
          {hoveredPoint !== null && (
            <div className="graph-inspector" style={{ left: `${(hoveredPoint / (trendPoints.length - 1)) * 100}%` }}>
              <i />
              <div>
                <b>{trendPoints[hoveredPoint][0]}</b>
                <span><em className="coral" /> {trendPoints[hoveredPoint][1]} anomalies</span>
                <span><em className="mint" /> {trendPoints[hoveredPoint][2]} confirmed</span>
              </div>
            </div>
          )}
          <div className="graph-labels">
            <span>01 AUG</span>
            <span>08 AUG</span>
            <span>15 AUG</span>
            <span>22 AUG</span>
            <span>30 AUG</span>
          </div>
        </div>
      </div>

      {/* Operational Intelligence Explanation Card (Request #5) */}
      <div className="operational-intelligence-breakdown card">
        <div className="card-head">
          <div>
            <p>OPERATIONAL METHODOLOGY &amp; DECISION VALUE</p>
            <h3>How this intelligence pipeline solves critical industrial risks</h3>
          </div>
          <span className="pipeline-audit-badge">Audited AI Workflow · Real-time Operational Value</span>
        </div>

        <p className="explainer-lead">
          Current satellite systems like NASA FIRMS detect raw hotspots but cannot distinguish between routine industrial flares,
          accidental chemical fires, power plant boiler vents, and agricultural burnoff. Pyrewatch ingests live FIRMS satellite passes,
          correlates them with Sentinel-2 multispectral SWIR bands, and cross-references an authoritative national registry of 32+ critical
          energy, refinery, and metallurgical facilities.
        </p>

        <div className="pipeline-steps-grid">
          <div className="step-card">
            <div className="step-num">01</div>
            <h4>Satellite Ingestion &amp; Calibrated FRP</h4>
            <p>
              VIIRS 375m I-band and MODIS 1km sensor data are parsed in near-real-time. We compute Fire Radiative Power (MW) and 4µm brightness
              temperatures, discarding cloud-scattered false positives using calibrated solar reflection flags.
            </p>
            <div className="step-tag">VIIRS 375m · Latency &lt; 15m</div>
          </div>

          <div className="step-card">
            <div className="step-num">02</div>
            <h4>Dynamic Facility Self-Baselines</h4>
            <p>
              Industrial facilities generate predictable diurnal thermal emissions. Our model establishes a 90-day seasonal baseline for every facility.
              When current FRP exceeds 2.5× the nominal baseline, the incident is flagged as an <strong>abnormal surge event</strong>.
            </p>
            <div className="step-tag">Z-Score &gt; 2.5 · Surge Detection</div>
          </div>

          <div className="step-card">
            <div className="step-num">03</div>
            <h4>Hierarchical Geospatial Clustering</h4>
            <p>
              DBSCAN spatial clustering groups neighboring thermal detections within a 1.5km to 8.5km radius. Detections close to verified
              refinery flares, LNG terminals, or steel mills are classified with calibrated confidence, cutting unclassified "unknowns" by 88.6%.
            </p>
            <div className="step-tag">Haversine Buffer · OSM GIS Match</div>
          </div>

          <div className="step-card">
            <div className="step-num">04</div>
            <h4>Actionable Dispatch &amp; Alarm Trigger</h4>
            <p>
              Incidents classified as High or Critical trigger browser-synthesized audio alarms and generate an immediate Incident Dossier with
              recommended safety actions, exposure radius, and a one-click field verification confirmation loop.
            </p>
            <div className="step-tag">Web Audio API · Field Loop Verified</div>
          </div>
        </div>
      </div>
    </section>
  );
}

