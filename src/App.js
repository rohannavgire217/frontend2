import { useEffect, useRef, useState } from "react";
import "./App.css";
import SignalPulse from "./components/SignalPulse";
import SatelliteMap from "./components/SatelliteMap";
import { AnalyticsPage } from "./components/MissionPages";
import ClassificationPage from "./components/ClassificationPage";
import { getBackendHealth, getEntities, getFirms } from "./api";



const alerts = [
  [
    "AL-2841",
    "Critical",
    "Thermal spread detected",
    "Narmada Refinery - Unit 04",
    "94",
    "coral",
  ],
  [
    "AL-2840",
    "Watch",
    "Unusual flare intensity",
    "Mundra Energy Terminal",
    "72",
    "amber",
  ],
  [
    "AL-2839",
    "Resolved",
    "Crop-burn false positive",
    "Kutch district",
    "18",
    "mint",
  ],
];
const liveAlertTemplates = [
  ["AL-2842", "Critical", "Thermal spread detected", "Hazira LNG Terminal", "89", "coral"],
  ["AL-2843", "Watch", "Persistent source deviation", "Kutch Steel Works", "77", "amber"],
  ["AL-2844", "Watch", "Unexpected heat signature", "Narmada Refinery - Unit 02", "83", "amber"],
];
const facilities = [
  ["Narmada Refinery", "Refinery", "18", "92"],
  ["Kutch Steel Works", "Steel mill", "11", "76"],
  ["Hazira LNG Terminal", "Gas terminal", "7", "68"],
];

function MapView({ selected, setSelected, onScanAlert, onOpenAlerts }) {
  const [scanning, setScanning] = useState(true);
  const [range, setRange] = useState("Live");
  const [showLayers, setShowLayers] = useState(true);
  const [scanMessage, setScanMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  return (
    <section className={"card map-card " + (isExpanded ? "is-expanded" : "")}>
      <div className="card-head">
        <div>
          <p>LIVE SITUATIONAL VIEW</p>
          <h2>Thermal activity map</h2>
        </div>
        <div className="map-controls">
          {["Live", "24h", "7d"].map((item) => (
            <button
              className={range === item ? "selected-control" : ""}
              onClick={() => setRange(item)}
              key={item}
            >
              {item}
            </button>
          ))}
          <button
            className={"layer-button " + (!showLayers ? "is-off" : "")}
            onClick={() => setShowLayers((visible) => !visible)}
          >
            {showLayers ? "Layers on" : "Layers off"}
          </button>
          <button
            className="map-size-button"
            type="button"
            title={isExpanded ? "Minimize map" : "Open full map"}
            aria-label={isExpanded ? "Minimize map" : "Open full map"}
            onClick={() => setIsExpanded((expanded) => !expanded)}
          >
            {isExpanded ? "Minimize" : "Full map"}
          </button>
        </div>
      </div>
      <div className="map">
        <SatelliteMap
          selected={selected}
          setSelected={setSelected}
          firmsData={firmsData}
          scanning={scanning}
          showLayers={showLayers}
          range={range}
          onToggleLayers={() => setShowLayers((visible) => !visible)}
          onRangeChange={setRange}
          onMinimize={() => setIsExpanded(false)}
          onScanAlert={(alert) => {
            onScanAlert(alert);
            setScanMessage(`Alert queued: thermal change at ${alert[3]}`);
          }}
        />
        <div className="map-legend">
          <span>
            <i className="coral" /> Industrial fire
          </span>
          <span>
            <i className="amber" /> Thermal anomaly
          </span>
          <span>
            <i className="mint" /> Persistent source
          </span>
        </div>
      </div>
      <div className="map-footer">
        <span>
          <i className={scanning ? "live-dot" : ""} /> {scanning ? `Receiving VIIRS NRT feed · ${range}` : "Scan paused"}{" "}
          <small>{scanning ? `Showing ${range} activity` : "Resume to continue scanning"}</small>
        </span>
        <button className="pause-button" onClick={() => setScanning((current) => !current)}>
          {scanning ? "Pause scan" : "Resume scan"}
        </button>
      </div>
      {scanMessage && <div className="scan-queue-message">{scanMessage}</div>}
      <button className="map-alert-link" onClick={onOpenAlerts}>View active alerts →</button>
    </section>
  );
}
function Alerts({ selected, setSelected, alertQueue, onReview, detailAlert, onOpenDetail, onBackToQueue, liveFeed, onToggleLive, onAcknowledge }) {
  return (
    <section className="card alerts-card">
      <div className="card-head">
        <div>
          <p>PRIORITY QUEUE</p>
          <h2>
            Active alerts <b>{alertQueue.length}</b>
          </h2>
        </div>
        <button className={"live-label " + (liveFeed ? "is-live" : "is-paused")} onClick={onToggleLive}>
          <i /> {liveFeed ? "LIVE" : "PAUSED"}
        </button>
      </div>
      <div className="alert-list">
        {alertQueue.length === 0 && <p className="empty-alerts">No active alerts. Monitoring the thermal feed...</p>}
        {alertQueue.map((alert) => (
          <button
            className={
              "alert-row " + (selected[0] === alert[0] ? "chosen" : "")
            }
            onClick={() => {
              setSelected(alert);
              onOpenDetail(alert);
            }}
            key={alert[0]}
          >
            <i className={"alert-bar " + alert[5]} />
            <div className="alert-copy">
              <p>
                <em className={alert[5]}>{alert[1]}</em>
                <small>now</small>
              </p>
              <h3>{alert[2]}</h3>
              <sp
              >{alert[3]}</sp>
            </div>
            <strong>-&gt;</strong>
          </button>
        ))}
      </div>
      <button className="review-button" onClick={onReview}>Open incident review -&gt;</button>
      {detailAlert && (
        <article className="alert-detail">
          <div className="alert-detail-head">
            <button className="detail-back" onClick={onBackToQueue}>&lt;- Alert queue</button>
            <em className={detailAlert[5]}>{detailAlert[1]}</em>
          </div>
          <p className="eyebrow">INCIDENT DETAIL / {detailAlert[0]}</p>
          <h3>{detailAlert[2]}</h3>
          <p className="alert-detail-location">{detailAlert[3]}</p>
          <div className="alert-detail-grid">
            <div><span>AI confidence</span><b>{detailAlert[4]}%</b></div>
            <div><span>Status</span><b>Needs review</b></div>
            <div><span>Detected</span><b>Now</b></div>
          </div>
          <button className="primary-button detail-action" onClick={onReview}>Open classification review -&gt;</button>
          <button className="acknowledge-button" onClick={() => onAcknowledge(detailAlert[0])}>Acknowledge and remove alert</button>
        </article>
      )}
    </section>
  );
}
function Metric({ label, value, note, visual }) {
  return (
    <article className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
      {visual === "pulse" ? (
        <SignalPulse />
      ) : (
        <div className={"mini-" + visual}>
          {visual === "ring" ? "98%" : visual === "dots" ? ". . . . ." : ""}
        </div>
      )}
    </article>
  );
}
function getDayPart() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

function LaunchSequence({ messageIndex }) {
  const launchMessages = [
    "Connecting satellite intelligence",
    "Opening intelligence layer",
    "Syncing thermal feed",
    "Opening dashboard",
  ];

  return (
    <main className="launch-screen" aria-label="Opening Pyrewatch dashboard">
      <div className="launch-grid" />
      <div className="launch-scanlines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="launch-particles" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i /><i />
      </div>
      <div className="starfield" aria-hidden="true">
        {Array.from({ length: 34 }, (_, index) => (
          <span
            key={index}
            style={{
              left: `${(index * 13 + 7) % 100}%`,
              top: `${(index * 17 + 9) % 100}%`,
              width: `${(index % 3) + 2}px`,
              height: `${(index % 3) + 2}px`,
              animationDelay: `${(index % 8) * 0.8}s`,
              animationDuration: `${3 + (index % 5)}s`,
            }}
          />
        ))}
      </div>
      <div className="launch-radar" aria-hidden="true">
        <span className="launch-orbit launch-orbit-one" />
        <span className="launch-orbit launch-orbit-two" />
        <span className="launch-orbit launch-orbit-three" />
        <span className="launch-sweep" />
        <span className="launch-satellite-track">
          <span className="launch-satellite">
            <i className="launch-solar-panel launch-solar-panel-left" />
            <i className="launch-satellite-body" />
            <i className="launch-solar-panel launch-solar-panel-right" />
            <i className="launch-satellite-antenna" />
            <i className="launch-satellite-beam" />
          </span>
        </span>
        <i className="launch-beacon launch-beacon-one" />
        <i className="launch-beacon launch-beacon-two" />
        <i className="launch-beacon launch-beacon-three" />
        <i className="launch-core" />
      </div>
      <div className="launch-copy">
        <p className="eyebrow">PYREWATCH / CONTROL ROOM</p>
        <h1>Reading the heat.</h1>
        <div className="launch-status">
          <i />
          <span className="launch-status-cycle">{launchMessages[messageIndex % launchMessages.length]}</span>
        </div>
        <div className="launch-progress" aria-hidden="true"><i /></div>
      </div>
      <div className="launch-footer">
        <span>VIIRS NRT FEED</span>
        <span>WEST INDIA / 28.61 N / 77.20 E</span>
        <b>BOOT SEQUENCE <em>COMPLETE</em></b>
      </div>
      <div className="launch-corner launch-corner-left">LATENCY 42ms<br />PACKETS 1,284</div>
      <div className="launch-corner launch-corner-right">NODE / 07<br />SIGNAL LOCKED</div>
    </main>
  );
}

function App() {
  const [launching, setLaunching] = useState(true);
  const [launchMessageIndex, setLaunchMessageIndex] = useState(0);
  const [active, setActive] = useState("Overview");
  const [selected, setSelected] = useState(alerts[0]);
  const [alertQueue, setAlertQueue] = useState(alerts);
  const [alertDetail, setAlertDetail] = useState(null);
  const [liveFeed, setLiveFeed] = useState(true);
  const [backendStatus, setBackendStatus] = useState("connecting");
  const [firmsData, setFirmsData] = useState([]);
  const liveCursor = useRef(0);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("pyrewatch-theme") === "dark",
  );
  const dayPart = getDayPart();
  useEffect(() => {
    document.body.dataset.dayPart = dayPart;
  }, [dayPart]);
  useEffect(() => {
    document.body.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("pyrewatch-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
 useEffect(() => {
  const checkBackend = async () => {
    try {
      const response = await fetch(
        "https://backend1-3-zb2a.onrender.com/health"
      );

      if (response.ok) {
        setBackendStatus("connected");
      } else {
        setBackendStatus("Online");
      }
    } catch (error) {
      console.error("Backend connection failed:", error);
      setBackendStatus("offline");
    }
  };

  checkBackend();
}, []);


useEffect(() => {
  const loadFirmsData = async () => {
    try {
      const fires = await getFirms();

      console.log("NASA FIRMS data:", fires);

      setFirmsData(fires);
    } catch (error) {
      console.error("NASA FIRMS request failed:", error);
    }
  };

  loadFirmsData();
}, []);
  useEffect(() => {
    const launchMessageTimer = window.setInterval(() => {
      setLaunchMessageIndex((current) => (current + 1) % 4);
    }, 2200);

    const launchTimer = window.setTimeout(() => {
      setLaunching(false);
      window.clearInterval(launchMessageTimer);
    }, 7600);

    return () => {
      window.clearInterval(launchMessageTimer);
      window.clearTimeout(launchTimer);
    };
  }, []);
  useEffect(() => {
    if (launching || !liveFeed) return undefined;
    const liveTimer = window.setInterval(() => {
      const incomingAlert = liveAlertTemplates[liveCursor.current % liveAlertTemplates.length];
      liveCursor.current += 1;
      setAlertQueue((queue) => [
        incomingAlert,
        ...queue.filter((alert) => alert[0] !== incomingAlert[0]),
      ].slice(0, 6));
    }, 7000);
    return () => window.clearInterval(liveTimer);
  }, [launching, liveFeed]);
  if (launching) return <LaunchSequence messageIndex={launchMessageIndex} />;
  const nav = ["Overview", "Live map", "Alerts", "Analytics", "Classification"];
  const overview = (
    <>
      <section className="mission-pulse">
        <div className="pulse-copy">
          <div className="pulse-kicker"><i /> NETWORK PULSE <span>09:42:18 IST</span></div>
          <h2>Heat is moving <em>north-west.</em></h2>
          <p>One critical anomaly needs attention across the monitored corridor.</p>
        </div>
        <div className="pulse-orbit" aria-hidden="true">
          <span className="orbit-ring ring-one" />
          <span className="orbit-ring ring-two" />
          <span className="orbit-core" />
          <span className="orbit-sweep" />
        </div>
        <div className="pulse-readout">
          <div><span>THREAT INDEX</span><strong>72<small>/100</small></strong></div>
          <div><span>LAST SWEEP</span><strong>04:18<small>ago</small></strong></div>
          <div><span>RESPONSE POSTURE</span><strong className="posture-ready">READY</strong></div>
        </div>
      </section>
      <div className="metrics">
        <Metric
          label="ACTIVE ANOMALIES"
          value="03"
          note="2 since yesterday"
          visual="bars"
        />
        <Metric
          label="MONITORED FACILITIES"
          value="148"
          note="12 added this month"
          visual="ring"
        />
        <Metric
          label="THERMAL NODES TRACKED"
          value="2,847"
          note="7.4% data coverage"
          visual="pulse"
        />
        <Metric
          label="AVG. ALERT RESPONSE"
          value="08m 42s"
          note="14% faster"
          visual="dots"
        />
      </div>
      <div className="content-grid">
        <MapView
          selected={selected}
          setSelected={setSelected}
          onScanAlert={(alert) =>
            setAlertQueue((queue) => [
              alert,
              ...queue.filter((item) => item[0] !== alert[0]),
            ])
          }
          onOpenAlerts={() => setActive("Alerts")}
        />
        <Alerts
          selected={selected}
          setSelected={setSelected}
          alertQueue={alertQueue}
          onReview={() => setActive("Classification")}
          detailAlert={alertDetail}
          onOpenDetail={setAlertDetail}
          onBackToQueue={() => setAlertDetail(null)}
          liveFeed={liveFeed}
          onToggleLive={() => setLiveFeed((current) => !current)}
          onAcknowledge={(alertId) => {
            setAlertQueue((queue) => queue.filter((alert) => alert[0] !== alertId));
            setAlertDetail(null);
          }}
        />
      </div>
      <div className="lower-grid">
        <section className="card signal-card">
          <div className="card-head">
            <div>
              <p>SELECTED SIGNAL</p>
              <h2>{selected[0]}</h2>
            </div>
            <em className={selected[5]}>{selected[1]}</em>
          </div>
          <h3>{selected[2]}</h3>
          <p>{selected[3]}</p>
          <div className="confidence">
            <span>AI confidence</span>
            <div>
              <i style={{ width: selected[4] + "%" }} />
            </div>
            <b>{selected[4]}%</b>
          </div>
        </section>
        <section className="card facility-card">
          <div className="card-head">
            <div>
              <p>FACILITY INTELLIGENCE</p>
              <h2>High-risk sites</h2>
            </div>
          </div>
          {facilities.map((f) => (
            <div className="facility-row" key={f[0]}>
              <span className="facility-mark">
                {f[0].slice(0, 2).toUpperCase()}
              </span>
              <div>
                <b>{f[0]}</b>
                <span>
                  {f[1]} - {f[2]} thermal nodes
                </span>
              </div>
              <strong>
                {f[3]}
                <small> risk</small>
              </strong>
            </div>
          ))}
        </section>
      </div>
    </>
  );
  let content = overview;
  if (active === "Live map")
    content = (
      <MapView
        selected={selected}
        setSelected={setSelected}
        onScanAlert={(alert) =>
          setAlertQueue((queue) => [
            alert,
            ...queue.filter((item) => item[0] !== alert[0]),
          ])
        }
          onOpenAlerts={() => {
            setAlertDetail(null);
            setActive("Alerts");
          }}
      />
    );
  if (active === "Alerts")
    content = (
      <Alerts
        selected={selected}
        setSelected={setSelected}
        alertQueue={alertQueue}
        onReview={() => setActive("Classification")}
        detailAlert={alertDetail}
        onOpenDetail={setAlertDetail}
        onBackToQueue={() => setAlertDetail(null)}
        liveFeed={liveFeed}
        onToggleLive={() => setLiveFeed((current) => !current)}
        onAcknowledge={(alertId) => {
          setAlertQueue((queue) => queue.filter((alert) => alert[0] !== alertId));
          setAlertDetail(null);
        }}
      />
    );
  if (active === "Analytics") content = <AnalyticsPage />;
  if (active === "Classification") content = <ClassificationPage onNavigate={setActive} />;
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <b>PYREWATCH</b>
          <small>thermal intelligence</small>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              className={active === item ? "active" : ""}
              onClick={() => {
                if (item === "Alerts") setAlertDetail(null);
                setActive(item);
              }}
              key={item}
            >
              <span>
                {item === "Overview"
                  ? "◈"
                  : item === "Live map"
                    ? "⌁"
                    : item === "Facilities"
                      ? "▦"
                      : item === "Alerts"
                        ? "◉"
                        : "◇"}
              </span>
              {item}
              {item === "Alerts" && <em>{alertQueue.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-state">
            <i /> All systems operational
          </div>
          <div className="operator">
            <span>OP</span>
            <div>
              <b>Operator</b>
              <small>Safety operator</small>
            </div>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p>CONTROL ROOM / WEST INDIA</p>
            <h1>{active === "Overview" ? `Good ${dayPart}.` : active}</h1>
          </div>
          <div className="top-actions">
            <span className="system-pill">
              <i /> {backendStatus === "connected" ? "Backend connected" : backendStatus === "Online" ? "Backend Online" : "Connecting backend"}
            </span>
            <button
              className="theme-toggle"
              onClick={() => setDarkMode((current) => !current)}
              aria-label={darkMode ? "Use light mode" : "Use dark mode"}
              title={darkMode ? "Use light mode" : "Use dark mode"}
            >
              {darkMode ? "☀" : "☾"}
            </button>
            <span className="profile">OP</span>
          </div>
        </header>
        {content}
      </section>
    </main>
  );
}
export default App;
