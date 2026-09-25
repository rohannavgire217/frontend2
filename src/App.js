import { useEffect, useRef, useState } from "react";
import "./App.css";

import SignalPulse from "./components/SignalPulse";
import { AnalyticsPage } from "./components/MissionPages";
import ClassificationPage from "./components/ClassificationPage";
import IgpsPage from "./components/IgpsPage";
import IntelligenceMapPage from "./components/IntelligenceMapPage";

import { getFirms } from "./api";
import { unlockAlarmAudio } from "./utils/alarm";

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
  [
    "AL-2842",
    "Critical",
    "Thermal spread detected",
    "Hazira LNG Terminal",
    "89",
    "coral",
  ],
  [
    "AL-2843",
    "Watch",
    "Persistent source deviation",
    "Kutch Steel Works",
    "77",
    "amber",
  ],
  [
    "AL-2844",
    "Watch",
    "Unexpected heat signature",
    "Narmada Refinery - Unit 02",
    "83",
    "amber",
  ],
];

function Alerts({
  selected,
  setSelected,
  alertQueue,
  onReview,
  detailAlert,
  onOpenDetail,
  onBackToQueue,
  liveFeed,
  onToggleLive,
  onAcknowledge,
}) {
  return (
    <section className="card alerts-card">
      <div className="card-head">
        <div>
          <p>PRIORITY QUEUE</p>

          <h2>
            Active alerts <b>{alertQueue.length}</b>
          </h2>
        </div>

        <button
          className={
            "live-label " +
            (liveFeed ? "is-live" : "is-paused")
          }
          onClick={onToggleLive}
        >
          <i /> {liveFeed ? "LIVE" : "PAUSED"}
        </button>
      </div>

      <div className="alert-list">
        {alertQueue.length === 0 && (
          <p className="empty-alerts">
            No active alerts. Monitoring the thermal feed...
          </p>
        )}

        {alertQueue.map((alert) => (
          <button
            className={
              "alert-row " +
              (selected?.[0] === alert[0]
                ? "chosen"
                : "")
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
                <em className={alert[5]}>
                  {alert[1]}
                </em>

                <small>now</small>
              </p>

              <h3>{alert[2]}</h3>

              <span>{alert[3]}</span>
            </div>

            <strong>→</strong>
          </button>
        ))}
      </div>

      <button
        className="review-button"
        onClick={onReview}
      >
        Open incident review →
      </button>

      {detailAlert && (
        <article className="alert-detail">
          <div className="alert-detail-head">
            <button
              className="detail-back"
              onClick={onBackToQueue}
            >
              ← Alert queue
            </button>

            <em className={detailAlert[5]}>
              {detailAlert[1]}
            </em>
          </div>

          <p className="eyebrow">
            INCIDENT DETAIL / {detailAlert[0]}
          </p>

          <h3>{detailAlert[2]}</h3>

          <p className="alert-detail-location">
            {detailAlert[3]}
          </p>

          <div className="alert-detail-grid">
            <div>
              <span>AI confidence</span>
              <b>{detailAlert[4]}%</b>
            </div>

            <div>
              <span>Status</span>
              <b>Needs review</b>
            </div>

            <div>
              <span>Detected</span>
              <b>Now</b>
            </div>
          </div>

          <button
            className="primary-button detail-action"
            onClick={onReview}
          >
            Open classification review →
          </button>

          <button
            className="acknowledge-button"
            onClick={() =>
              onAcknowledge(detailAlert[0])
            }
          >
            Acknowledge and remove alert
          </button>
        </article>
      )}
    </section>
  );
}

function LaunchSequence({
  messageIndex,
  onEnter,
}) {
  const launchMessages = [
    "Connecting satellite intelligence",
    "Opening intelligence layer",
    "Syncing thermal feed",
    "Opening dashboard",
  ];

  return (
    <main
      className="launch-screen"
      aria-label="Opening Pyrewatch dashboard"
    >
      <div className="launch-grid" />

      <div
        className="launch-scanlines"
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </div>

      <div
        className="launch-particles"
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>

      <div
        className="starfield"
        aria-hidden="true"
      >
        {Array.from(
          { length: 34 },
          (_, index) => (
            <span
              key={index}
              style={{
                left:
                  ((index * 13 + 7) %
                    100) +
                  "%",
                top:
                  ((index * 17 + 9) %
                    100) +
                  "%",
                width:
                  ((index % 3) + 2) +
                  "px",
                height:
                  ((index % 3) + 2) +
                  "px",
                animationDelay:
                  (index % 8) * 0.8 +
                  "s",
                animationDuration:
                  3 + (index % 5) + "s",
              }}
            />
          )
        )}
      </div>

      <div
        className="launch-radar"
        aria-hidden="true"
      >
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

      <video
        className="launch-video"
        src="/intro.mp4"
        poster="/intro-poster.svg"
        muted
        playsInline
        autoPlay
        onError={(event) => {
          event.currentTarget.style.display =
            "none";
        }}
        aria-hidden="true"
      />

      <div className="launch-copy">
        <p className="eyebrow">
          PYREWATCH / CONTROL ROOM
        </p>

        <h1>Reading the heat.</h1>

        <p className="launch-subtitle">
          Industrial thermal intelligence ·
          geospatial evidence fusion
        </p>

        <div className="launch-status">
          <i />

          <span className="launch-status-cycle">
            {
              launchMessages[
                messageIndex %
                  launchMessages.length
              ]
            }
          </span>
        </div>

        <div
          className="launch-progress"
          aria-hidden="true"
        >
          <i />
        </div>

        <div className="launch-actions">
          <button
            className="launch-enter"
            onClick={onEnter}
          >
            Enter control room →
          </button>

          <button
            className="launch-skip"
            onClick={onEnter}
          >
            Skip
          </button>
        </div>
      </div>

      <div className="launch-footer">
        <span>VIIRS NRT FEED</span>

        <span>
          WEST INDIA / 28.61 N / 77.20 E
        </span>

        <b>
          BOOT SEQUENCE{" "}
          <em>COMPLETE</em>
        </b>
      </div>

      <div className="launch-corner launch-corner-left">
        LATENCY 42ms
        <br />
        PACKETS 1,284
      </div>

      <div className="launch-corner launch-corner-right">
        NODE / 07
        <br />
        SIGNAL LOCKED
      </div>
    </main>
  );
}

function getDayPart() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
}

function App() {
  const [launching, setLaunching] =
    useState(
      () =>
        sessionStorage.getItem(
          "pyrewatch-intro-seen"
        ) !== "1"
    );

  const [
    launchMessageIndex,
    setLaunchMessageIndex,
  ] = useState(0);

  const [active, setActive] =
    useState("Overview");

  const [selected, setSelected] =
    useState(alerts[0]);

  const [alertQueue, setAlertQueue] =
    useState(alerts);

  const [alertDetail, setAlertDetail] =
    useState(null);

  const [liveFeed, setLiveFeed] =
    useState(true);

  const [backendStatus, setBackendStatus] =
    useState("connecting");

  const [firmsData, setFirmsData] =
    useState([]);

  const [darkMode, setDarkMode] =
    useState(
      () =>
        localStorage.getItem(
          "pyrewatch-theme"
        ) === "dark"
    );

  const liveCursor = useRef(0);

  const dayPart = getDayPart();

  useEffect(() => {
    document.body.dataset.dayPart =
      dayPart;
  }, [dayPart]);

  useEffect(() => {
    document.body.dataset.theme =
      darkMode ? "dark" : "light";

    localStorage.setItem(
      "pyrewatch-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  /*
   * BACKEND HEALTH
   */
  useEffect(() => {
    let cancelled = false;

    async function checkBackend() {
      try {
        const response =
          await fetch(
            "https://backend1-3-zb2a.onrender.com/health"
          );

        if (!cancelled) {
          setBackendStatus(
            response.ok
              ? "connected"
              : "offline"
          );
        }
      } catch (error) {
        console.error(
          "Backend health check failed:",
          error
        );

        if (!cancelled) {
          setBackendStatus("offline");
        }
      }
    }

    checkBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * NASA FIRMS POLLING
   */
  useEffect(() => {
    let cancelled = false;

    async function loadFirms() {
      try {
        const fires =
          await getFirms();

        if (!cancelled) {
          setFirmsData(
            Array.isArray(fires)
              ? fires
              : []
          );

          setBackendStatus(
            "connected"
          );
        }
      } catch (error) {
        console.error(
          "FIRMS request failed:",
          error
        );

        if (!cancelled) {
          setFirmsData([]);

          setBackendStatus(
            (current) =>
              current ===
              "connecting"
                ? "offline"
                : current
          );
        }
      }
    }

    loadFirms();

    const timer =
      window.setInterval(
        loadFirms,
        60000
      );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  /*
   * INTRO SEQUENCE
   */
  useEffect(() => {
    if (!launching) {
      return undefined;
    }

    const timer =
      window.setInterval(() => {
        setLaunchMessageIndex(
          (current) =>
            (current + 1) % 4
        );
      }, 1800);

    return () =>
      window.clearInterval(timer);
  }, [launching]);

  /*
   * LIVE DEMO ALERT STREAM
   */
  useEffect(() => {
    if (
      launching ||
      !liveFeed
    ) {
      return undefined;
    }

    const timer =
      window.setInterval(() => {
        const next =
          liveAlertTemplates[
            liveCursor.current %
              liveAlertTemplates.length
          ];

        liveCursor.current += 1;

        setAlertQueue(
          (queue) =>
            [
              next,
              ...queue.filter(
                (item) =>
                  item[0] !==
                  next[0]
              ),
            ].slice(0, 6)
        );
      }, 7000);

    return () =>
      window.clearInterval(timer);
  }, [
    launching,
    liveFeed,
  ]);

  function enterDashboard() {
    unlockAlarmAudio();

    sessionStorage.setItem(
      "pyrewatch-intro-seen",
      "1"
    );

    setLaunching(false);
  }

  if (launching) {
    return (
      <LaunchSequence
        messageIndex={
          launchMessageIndex
        }
        onEnter={
          enterDashboard
        }
      />
    );
  }

  /*
   * IMPORTANT:
   * iGPS IS RESTORED HERE.
   *
   * Do not remove this item.
   */
  const navigation = [
    "Overview",
    "Live map",
    "Alerts",
    "Analytics",
    "Classification",
    "iGPS Intelligence",
  ];

  let content = (
    <IntelligenceMapPage
      firmsData={firmsData}
      backendStatus={
        backendStatus
      }
      onVerifyResult={(result) =>
        console.info(
          "Verification result:",
          result
        )
      }
    />
  );

  /*
   * OVERVIEW
   */
  if (active === "Overview") {
    content = (
      <IntelligenceMapPage
        firmsData={firmsData}
        backendStatus={
          backendStatus
        }
        onVerifyResult={(result) =>
          console.info(
            "Verification result:",
            result
          )
        }
      />
    );
  }

  /*
   * LIVE MAP
   */
  if (active === "Live map") {
    content = (
      <IntelligenceMapPage
        firmsData={firmsData}
        backendStatus={
          backendStatus
        }
        onVerifyResult={(result) =>
          console.info(
            "Verification result:",
            result
          )
        }
      />
    );
  }

  /*
   * ALERTS
   */
  if (active === "Alerts") {
    content = (
      <Alerts
        selected={selected}
        setSelected={setSelected}
        alertQueue={
          alertQueue
        }
        onReview={() =>
          setActive(
            "Classification"
          )
        }
        detailAlert={
          alertDetail
        }
        onOpenDetail={
          setAlertDetail
        }
        onBackToQueue={() =>
          setAlertDetail(null)
        }
        liveFeed={liveFeed}
        onToggleLive={() =>
          setLiveFeed(
            (current) =>
              !current
          )
        }
        onAcknowledge={(
          alertId
        ) => {
          setAlertQueue(
            (queue) =>
              queue.filter(
                (item) =>
                  item[0] !==
                  alertId
              )
          );

          setAlertDetail(
            null
          );
        }}
      />
    );
  }

  /*
   * ANALYTICS
   */
  if (active === "Analytics") {
    content = (
      <AnalyticsPage />
    );
  }

  /*
   * CLASSIFICATION
   */
  if (
    active ===
    "Classification"
  ) {
    content = (
      <ClassificationPage
        onNavigate={setActive}
      />
    );
  }

  /*
   * iGPS
   *
   * THIS WAS THE MISSING CONNECTION.
   */
  if (
    active ===
    "iGPS Intelligence"
  ) {
    content = (
      <IgpsPage />
    );
  }

  const systemLabel =
    backendStatus === "offline"
      ? "System status · Offline"
      : backendStatus ===
          "connecting"
        ? "System status · Checking"
        : "System status · Healthy";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand brand-with-logo">
          <div
            className="brand-orbit"
            aria-hidden="true"
          >
            <img
              src="/tech-taxila-logo.png"
              alt=""
            />
          </div>

          <div className="brand-copy">
            <b>PYREWATCH</b>

            <small>
              thermal intelligence
            </small>
          </div>
        </div>

        <nav>
          {navigation.map(
            (item) => (
              <button
                key={item}
                className={
                  active === item
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setActive(item);

                  if (
                    item !==
                    "Alerts"
                  ) {
                    setAlertDetail(
                      null
                    );
                  }
                }}
              >
                <span>
                  {item ===
                  "Overview"
                    ? "◈"
                    : item ===
                        "Live map"
                      ? "⌁"
                      : item ===
                          "Alerts"
                        ? "◉"
                        : item ===
                            "Analytics"
                          ? "◌"
                          : item ===
                              "Classification"
                            ? "◇"
                            : "◎"}
                </span>

                {item}

                {item ===
                  "Alerts" && (
                  <em>
                    {
                      alertQueue.length
                    }
                  </em>
                )}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-state">
            <i />
            All systems
            operational
          </div>

          <div className="operator">
            <span>OP</span>

            <div>
              <b>Operator</b>
              <small>
                Safety operator
              </small>
            </div>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>
              CONTROL ROOM /
              WEST INDIA
            </p>

            <h1>
              {active ===
              "Overview"
                ? `Good ${dayPart}.`
                : active}
            </h1>
          </div>

          <div className="top-actions">
            <span className="system-pill">
              <i />
              {systemLabel}
            </span>

            <button
              className="theme-toggle"
              onClick={() =>
                setDarkMode(
                  (current) =>
                    !current
                )
              }
              aria-label={
                darkMode
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {darkMode
                ? "☀"
                : "☾"}
            </button>

            <span className="profile">
              OP
            </span>
          </div>
        </header>

        {content}
      </section>
    </main>
  );
}

export default App;