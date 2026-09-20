import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import html2canvas from "html2canvas";
import "leaflet/dist/leaflet.css";

const detections = [
  {
    id: "AL-2841",
    name: "Narmada Refinery - Unit 04",
    position: [22.47, 70.07],
    tone: "#ff6653",
  },
  {
    id: "AL-2840",
    name: "Mundra Energy Terminal",
    position: [22.74, 69.72],
    tone: "#ffbb4a",
  },
  {
    id: "AL-2839",
    name: "Kutch district",
    position: [23.25, 69.67],
    tone: "#48d09e",
  },
  {
    id: "TH-105",
    name: "Persistent thermal source",
    position: [22.31, 70.8],
    tone: "#ffbb4a",
  },
  {
    id: "TH-106",
    name: "Persistent thermal source",
    position: [23.02, 72.57],
    tone: "#48d09e",
  },
];

// National FIRMS-style view used when the map first opens. The focused alerts
// above remain interactive; these points provide the India-wide thermal picture.
const indiaThermalField = [
  [34.1, 74.8, "#ffbb4a"], [33.6, 75.7, "#ff6653"], [32.7, 76.2, "#46c9f0"],
  [31.4, 75.6, "#ffbb4a"], [30.8, 76.8, "#46c9f0"], [29.6, 77.3, "#ff6653"],
  [28.8, 77.1, "#ffbb4a"], [28.4, 76.9, "#46c9f0"], [27.5, 75.9, "#ff6653"],
  [26.9, 75.8, "#ffbb4a"], [26.3, 73.1, "#ff6653"], [25.5, 74.6, "#ffbb4a"],
  [25.7, 82.1, "#46c9f0"], [25.3, 83.0, "#ffbb4a"], [24.7, 84.4, "#ff6653"],
  [24.2, 86.1, "#46c9f0"], [23.7, 85.3, "#ffbb4a"], [23.2, 77.4, "#ff6653"],
  [22.8, 75.8, "#ffbb4a"], [22.4, 73.2, "#46c9f0"], [21.4, 79.1, "#ff6653"],
  [21.1, 78.4, "#ffbb4a"], [20.6, 78.9, "#ffbb4a"], [20.2, 73.0, "#46c9f0"],
  [19.9, 75.3, "#ff6653"], [19.4, 76.8, "#ffbb4a"], [19.0, 73.1, "#ffbb4a"],
  [18.5, 77.2, "#ff6653"], [18.0, 78.5, "#46c9f0"], [17.5, 80.7, "#ffbb4a"],
  [16.8, 80.4, "#ff6653"], [16.2, 75.8, "#ffbb4a"], [15.7, 74.9, "#46c9f0"],
  [15.2, 76.4, "#ff6653"], [14.6, 78.0, "#ffbb4a"], [14.1, 79.8, "#ff6653"],
  [13.4, 78.6, "#ffbb4a"], [12.8, 77.8, "#46c9f0"], [12.2, 79.7, "#ff6653"],
  [11.5, 76.9, "#ffbb4a"], [10.9, 78.3, "#ff6653"], [10.4, 76.9, "#ffbb4a"],
  [9.8, 77.4, "#ff6653"], [8.9, 77.2, "#ffbb4a"], [7.5, 80.7, "#ff6653"],
  [7.0, 81.6, "#ffbb4a"], [6.4, 80.1, "#ff6653"], [22.6, 88.3, "#ff6653"],
  [23.1, 88.8, "#ffbb4a"], [24.0, 91.8, "#46c9f0"], [26.1, 91.7, "#ffbb4a"],
  [27.0, 94.2, "#ff6653"], [25.8, 93.9, "#46c9f0"], [23.4, 92.2, "#ffbb4a"],
];

const thermalLocationNames = [
  "Srinagar", "Kargil", "Manali", "Ludhiana", "Chandigarh", "Delhi NCR",
  "Jaipur", "Alwar", "Jodhpur", "Ajmer", "Udaipur", "Kota", "Varanasi",
  "Patna", "Gaya", "Dhanbad", "Ranchi", "Indore", "Bhopal", "Vadodara",
  "Nagpur", "Wardha", "Chandrapur", "Surat", "Aurangabad", "Nanded", "Mumbai",
  "Hyderabad", "Warangal", "Vijayawada", "Hubballi", "Goa", "Ballari", "Kurnool",
  "Nellore", "Bengaluru", "Chennai", "Coimbatore", "Salem", "Madurai", "Tirunelveli",
  "Kochi", "Thiruvananthapuram", "Colombo", "Kandy", "Galle", "Kolkata", "Durgapur",
  "Shillong", "Guwahati", "Itanagar", "Kohima", "Aizawl", "Agartala",
];

function SatelliteMap({
  selected,
  setSelected,
  firmsData = [],
  scanning = true,
  showLayers = true,
  range = "Live",
  onToggleLayers,
  onRangeChange,
  onMinimize,
  onScanAlert,
}) {
  const mapNode = useRef(null);
  const mapShellRef = useRef(null);
  const mapRef = useRef(null);
  const imageryLayerRef = useRef(null);
const streetLayerRef = useRef(null);
const firmsLayerRef = useRef(null);

  const measureActiveRef = useRef(false);
  const measureStartRef = useRef(null);
  const initialView = useRef(true);
  const [scanAlert, setScanAlert] = useState(null);
  const [viewMode, setViewMode] = useState("satellite");
  const [measureActive, setMeasureActive] = useState(false);
  const [mapFeedback, setMapFeedback] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const notify = (message) => {
    setMapFeedback(message);
  };

  const handleLocation = () => {
    if (!navigator.geolocation) {
      notify("Location is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current?.flyTo([coords.latitude, coords.longitude], 8, { duration: 0.8 });
        notify("Map centered on your location");
      },
      () => notify("Location permission was not granted"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleShare = async () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const shareUrl = `${window.location.href}#map=${center.lat.toFixed(3)},${center.lng.toFixed(3)},${map.getZoom()}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Pyrewatch map view", url: shareUrl });
        notify("Map view shared");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      notify("Map view link copied");
    } catch {
      notify("Map view ready to share");
    }
  };

  const handleCapture = async () => {
    if (!mapShellRef.current || isCapturing) return;
    setIsCapturing(true);
    notify("Preparing map image...");
    try {
      const canvas = await html2canvas(mapShellRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#304d43",
        logging: false,
        ignoreElements: (element) =>
          element.classList.contains("map-toolbar") ||
          element.classList.contains("map-feedback") ||
          element.classList.contains("map-help"),
      });
      const link = document.createElement("a");
      link.download = `pyrewatch-map-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      notify("Map image downloaded");
    } catch {
      notify("Could not capture the map image");
    } finally {
      setIsCapturing(false);
    }
  };

  const selectDetection = (detection, id = detection.id, label = "Satellite detection") => {
    setSelected([
      id,
      detection.tone === "#ff6653" ? "Critical" : "Watch",
      detection.name,
      label,
      "now",
      detection.tone === "#ff6653" ? "94" : detection.tone === "#48d09e" ? "81" : "72",
      detection.tone === "#ff6653" ? "coral" : detection.tone === "#ffbb4a" ? "amber" : "mint",
    ]);
  };

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined;
    const map = L.map(mapNode.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      wheelDebounceTime: 20,
      wheelPxPerZoomLevel: 45,
      zoomDelta: 0.5,
      zoomSnap: 0.25,
      zoomAnimation: true,
      fadeAnimation: true,
      inertia: true,
      inertiaDeceleration: 2200,
    }).setView([21.2, 79.2], 4.35);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    imageryLayerRef.current = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, crossOrigin: true, attribution: "Tiles © Esri" },
    ).addTo(map);
    streetLayerRef.current = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, crossOrigin: true, attribution: "© OpenStreetMap contributors" },
    );
    // Geographic reference labels: countries, states, and cities across India.
    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, crossOrigin: true, pane: "overlayPane", zIndex: 320 },
    ).addTo(map);
    detections.forEach((detection) => {
      const marker = L.marker(detection.position, {
        icon: L.divIcon({
          className: "thermal-marker-wrap",
          html: `<span class="thermal-marker" style="--marker-color:${detection.tone}"><b></b><i></i></span>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        }),
      }).addTo(map);
      marker.bindTooltip(
        `<b>${detection.name}</b><small>${detection.id}</small>`,
        {
          permanent: false,
          direction: "top",
          className: "thermal-label",
          offset: [0, -8],
        },
      );
      marker.on("click", () => selectDetection(detection));
    });
    indiaThermalField.forEach(([lat, lng, tone], index) => {
      const fieldDetection = {
        id: `TH-${String(index + 1).padStart(3, "0")}`,
        name: thermalLocationNames[index] || `Thermal signal ${index + 1}`,
        position: [lat, lng],
        tone,
      };
      const marker = L.marker([lat, lng], {
        interactive: true,
        icon: L.divIcon({
          className: "thermal-marker-wrap thermal-field-wrap",
          html: `<span class="thermal-marker thermal-field-marker" style="--marker-color:${tone}"><b></b><i></i></span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(map).bindTooltip(fieldDetection.name, {
        permanent: false,
        direction: "top",
        className: "thermal-label thermal-field-label",
        offset: [0, -8],
      });
      marker.on("click", () => selectDetection(fieldDetection, fieldDetection.id, "Regional thermal signal"));
    });
    map.on("click", (event) => {
      if (measureActiveRef.current) {
        if (!measureStartRef.current) {
          measureStartRef.current = event.latlng;
          notify("Select a second point to measure");
          return;
        }
        const distance = measureStartRef.current.distanceTo(event.latlng);
        measureStartRef.current = null;
        measureActiveRef.current = false;
        setMeasureActive(false);
        notify(`Measured distance: ${(distance / 1000).toFixed(2)} km`);
        return;
      }
      const latitude = event.latlng.lat.toFixed(3);
      const longitude = event.latlng.lng.toFixed(3);
      setSelected([
        "MAP-POINT",
        "Watch",
        "Map location selected",
        `${latitude}°, ${longitude}°`,
        "now",
        "48",
        "amber",
      ]);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      imageryLayerRef.current = null;
      streetLayerRef.current = null;
    };
  }, [setSelected]);


  useEffect(() => {
  const map = mapRef.current;

  if (!map) return;

  // Remove previous FIRMS markers
  if (firmsLayerRef.current) {
    firmsLayerRef.current.clearLayers();
  }

  const firmsLayer = L.layerGroup();

  firmsData.forEach((fire, index) => {
    const latitude = Number(fire.latitude);
    const longitude = Number(fire.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const frp = Number(fire.frp) || 0;

    // Choose marker intensity based on Fire Radiative Power
    let markerColor = "#ffbb4a";

    if (frp >= 50) {
      markerColor = "#ff6653";
    } else if (frp < 10) {
      markerColor = "#48d09e";
    }

    const marker = L.circleMarker(
      [latitude, longitude],
      {
        radius: 7,
        color: markerColor,
        weight: 2,
        fillColor: markerColor,
        fillOpacity: 0.8,
      }
    );

    marker.bindTooltip(
      `
        <b>NASA FIRMS Fire Detection</b>
        <small>
          FIRMS-${String(index + 1).padStart(4, "0")}<br/>
          Latitude: ${latitude.toFixed(4)}<br/>
          Longitude: ${longitude.toFixed(4)}<br/>
          FRP: ${frp.toFixed(2)} MW<br/>
          Confidence: ${fire.confidence || "N/A"}<br/>
          Date: ${fire.acq_date || "N/A"}<br/>
          Time: ${fire.acq_time || "N/A"}<br/>
          Satellite: ${fire.satellite || "N/A"}
        </small>
      `,
      {
        direction: "top",
        className: "thermal-label",
        offset: [0, -5],
      }
    );

    marker.on("click", () => {
      const severity = frp >= 50 ? "Critical" : "Watch";

      setSelected([
        `FIRMS-${String(index + 1).padStart(4, "0")}`,
        severity,
        "NASA FIRMS thermal detection",
        `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`,
        fire.acq_time || "now",
        String(Math.round(frp)),
        frp >= 50 ? "coral" : "amber",
      ]);
    });

    marker.addTo(firmsLayer);
  });

  firmsLayer.addTo(map);
  firmsLayerRef.current = firmsLayer;

  return () => {
    firmsLayer.remove();
    if (firmsLayerRef.current === firmsLayer) {
      firmsLayerRef.current = null;
    }
  };
}, [firmsData, setSelected]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (initialView.current) {
      initialView.current = false;
      return;
    }
    const matched = detections.find(
      (detection) => detection.id === selected[0],
    );
    if (matched)
      mapRef.current.flyTo(matched.position, 9, {
        duration: 0.45,
        easeLinearity: 0.2,
      });
  }, [selected]);

  useEffect(() => {
    if (!scanning) return undefined;
    const timer = window.setTimeout(() => {
      const detected = detections[1];
      const queuedAlert = [
        "SC-2842",
        "Watch",
        "Scan change detected",
        detected.name,
        "72",
        "amber",
      ];
      setScanAlert({
        id: queuedAlert[0],
        name: detected.name,
        tone: detected.tone,
      });
      setSelected(queuedAlert);
      onScanAlert?.(queuedAlert);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [scanning, setSelected, onScanAlert]);

  return (
    <div ref={mapShellRef} className={"satellite-map-shell " + (scanning ? "is-scanning " : "") + (showLayers ? "" : "layers-hidden") }>
      <div
        ref={mapNode}
        className="satellite-map"
        aria-label="Live satellite map with thermal detections"
      />
      <div className="map-action-controls" aria-label="Map actions">
        <button
          type="button"
          title="Reset map view"
          aria-label="Reset map view"
          onClick={() => mapRef.current?.setView([21.2, 79.2], 4.35)}
        >
          ⌂
        </button>
        <button
          type="button"
          title="Focus selected signal"
          aria-label="Focus selected signal"
          onClick={() => {
            const matched = detections.find((detection) => detection.id === selected[0]);
            if (matched) mapRef.current?.flyTo(matched.position, 9, { duration: 0.45 });
          }}
        >
          ◎
        </button>
      </div>
      <div className="map-toolbar" aria-label="Map tools">
        <button
          type="button"
          className={measureActive ? "is-active" : ""}
          onClick={() => {
            const nextActive = !measureActive;
            measureActiveRef.current = nextActive;
            measureStartRef.current = null;
            setMeasureActive(nextActive);
            notify(nextActive ? "Click two points to measure distance" : "Measurement cancelled");
          }}
        >
          <b>⌁</b><span>Measure</span>
        </button>
        <button type="button" onClick={handleLocation}><b>●</b><span>Location</span></button>
        <button type="button" className={showLayers ? "is-active" : ""} onClick={onToggleLayers}><b>▣</b><span>Layers</span></button>
        <button type="button" onClick={() => onRangeChange?.(range === "Live" ? "24h" : range === "24h" ? "7d" : "Live")}><b>☷</b><span>Timeline</span></button>
        <button type="button" onClick={handleCapture} disabled={isCapturing}><b>▣</b><span>{isCapturing ? "Saving" : "Capture"}</span></button>
        <button type="button" onClick={handleShare}><b>↗</b><span>Share</span></button>
        <button type="button" onClick={() => setShowHelp((visible) => !visible)}><b>?</b><span>Help</span></button>
        <button type="button" onClick={() => setViewMode((mode) => mode === "satellite" ? "street" : "satellite")}><b>□</b><span>{viewMode === "satellite" ? "Street" : "Satellite"}</span></button>
        <button type="button" onClick={onMinimize} aria-label="Minimize map"><b>×</b><span>Close</span></button>
      </div>
      {mapFeedback && <div className="map-feedback" role="status">{mapFeedback}</div>}
      {showHelp && (
        <div className="map-help" role="dialog" aria-label="Map help">
          <button type="button" onClick={() => setShowHelp(false)} aria-label="Close map help">×</button>
          <strong>Map controls</strong>
          <span>Click a hotspot to inspect it. Measure uses two map clicks.</span>
          <span>Timeline cycles through live, 24-hour, and 7-day activity.</span>
        </div>
      )}
      <div className="scan-overlay" aria-hidden="true">
        <div className="scan-radar">
          <div className="scan-radar-sweep" />
          <div className="scan-radar-rings">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="scan-radar-target" />
        </div>
        <div className="scan-beam" />
        <div className="scan-readout">VIIRS / SCANNING SECTOR 07</div>
        {scanAlert && (
          <div className="scan-alert" role="status">
            <span style={{ background: scanAlert.tone }} />
            <div>
              <b>CHANGE DETECTED</b>
              <small>{scanAlert.name}</small>
            </div>
            <button onClick={() => setScanAlert(null)} aria-label="Dismiss scan alert">×</button>
          </div>
        )}
        <span className="scan-corner top-left" />
        <span className="scan-corner top-right" />
        <span className="scan-corner bottom-left" />
        <span className="scan-corner bottom-right" />
      </div>
    </div>
  );
}

export default SatelliteMap;
