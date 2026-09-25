# SIH / PS-162 frontend implementation map

## Files modified
- `src/App.js`
  - Routes Overview/Live map to the new map-first intelligence page.
  - Polls `/v1/firms` every 60 seconds for successive client-side diffs.
  - Intro now runs once per browser session and unlocks Web Audio on Enter/Skip.
- `src/App.css`
  - Adds the token-like visual layer, map-first responsive layout, marker states, fusion card, filters, layers, replay, verification modal, alarm panel, dark/light and reduced-motion rules.
- `src/components/MissionPages.js`
  - Removes the unrouted `DataSourcesPage`.
  - Removes the fake unlabelled model-quality metrics card from Analytics.
- `src/data/thermal.js`
  - Shared taxonomy, demo signals, FIRMS normalization helpers and inline SVG marker definitions.
- `src/components/IntelligenceMapPage.js`
  - Main PS-162 experience: filters, class markers, fusion card, source list, baseline mini-chart, facility candidates, Level 0–5 evidence, Verify loop, layers, temporal replay, incident inspector, live inference, change detection, exports and footer identity.
- `src/utils/alarm.js`
  - Web Audio alarm generator; High/Critical only, mute-aware and reduced-motion aware.

## Files created
- `src/components/IntelligenceMapPage.js`
- `src/data/thermal.js`
- `src/utils/alarm.js`
- `public/intro-poster.svg`

## Optional assets
- Put `public/intro.mp4` in the project to use the supplied intro video.
- Replace `public/intro-poster.svg` with the official Tech Taxila poster/logo asset if you have it.

## Backend expectations
The UI works with the current `/v1/firms` response and falls back to clearly demo-labelled enrichment when backend classification fields do not exist. The following future backend fields can be consumed without redesigning the UI:
`classification`, `priority`, `signal_strength`, `baseline_multiple`, `sentinel2`, `osm`, `weather`, `exposure`, `facility`, `facility_match`, `corroborated`, `state`, `history`.

## Verification
Run:
`npm install`
`npm start`

The environment used for this modification did not have dependencies installed; an `npm ci` attempt exceeded the available execution window, so a full React compile could not be completed here.
