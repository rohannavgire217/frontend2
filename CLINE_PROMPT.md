# Cline / Ollama implementation prompt — Pyrewatch

You are editing the EXISTING Pyrewatch React repository. Do not rebuild the project from scratch and do not remove working features. Work directly in the current repo and make the smallest coherent set of changes needed to deliver a reliable, demo-ready thermal intelligence classification dashboard.

## Primary objective
Fix the current classification problem where many/all FIRMS detections become `Unknown`. The system must first use known industrial places and spatial evidence, then fuse thermal/context signals, then produce a practical classification. `Unknown` must remain a legitimate output only when evidence is genuinely insufficient.

## Required classification flow
FIRMS detection
→ normalize coordinates/FRP/time/context
→ spatial nearest-facility association
→ 1.5 km thermal clustering
→ facility-type evidence
→ thermal severity / baseline deviation
→ land-cover or vegetation context when available
→ Sentinel/SWIR corroboration when available
→ classification + confidence + tier + reason
→ map marker + fusion card + inspector

Never classify using FRP alone when a known facility association exists.

## Facility context
Create/maintain a local prototype reference registry with at least these categories:
- thermal power
- gas power
- refinery
- steel/furnace
- LNG/gas terminal

Every matched detection should expose:
- facility name
- facility type
- distance in km
- association strength
- classification reason
- cluster id / cluster size

A facility proximity match is evidence, not proof of exact facility attribution.

## Classification rules
- Refinery/LNG near-source + strong abnormal thermal deviation => Industrial fire.
- Refinery/LNG near-source without strong abnormal deviation => Gas flare.
- Thermal/gas power/steel near-source with persistent expected behavior => Persistent thermal source.
- Known industrial source + strong abnormal deviation => Industrial fire.
- Vegetation/agriculture context without industrial association => Wildfire / vegetation fire.
- Only use Unknown when there is not enough spatial/context/corroborating evidence.
- Keep confidence explainable; do not invent ML probabilities.
- Preserve backend-provided classification if it is explicitly valid.

## UI requirements
- Keep the existing Pyrewatch visual language.
- Remove Tech Taxila / SIH / PS branding from the operational dashboard.
- Use only Pyrewatch branding.
- Add a small circular PW logo near Pyrewatch with a subtle continuously rotating orbit/ring animation.
- Do not use a generic dot as the logo.
- Add distinct filled visual identities for thermal classes.
- Show facility reference markers on the map when the Facilities layer is enabled.
- Show classification result clearly in the Fusion Card and Incident Inspector.
- Show why the system classified it.
- Show facility distance and association strength.
- Fix alignment/overflow issues and preserve responsive behavior.
- Temporal replay must have a visible close/done control and must not trap the user.

## Alarm
Add a real bundled audible alarm file under `public/` and trigger it for High/Critical changes. Keep a Web Audio fallback for browsers that block file playback. Respect mute and reduced-motion settings.

## Reliability
- Do not fabricate live satellite observations.
- Preserve existing backend/demo fallback behavior.
- Do not claim exact facility attribution from a VIIRS pixel.
- Do not introduce fake API results.
- Keep exports working.
- Keep field verification loop working.
- Avoid breaking existing pages/navigation.

## Verification before finishing
1. Inspect all affected files before editing.
2. Search for all existing `Unknown` classification logic and remove FRP-only fallback behavior.
3. Check JSX syntax and imports.
4. Run the project build if dependencies are available.
5. If build cannot run because dependencies/network are unavailable, perform static syntax/import checks and report that limitation rather than claiming a successful build.
6. Verify the final ZIP contains all source changes and the alarm asset.

Do not stop after explaining what should be changed. Implement the changes in the repository, verify them, and leave the repo in a runnable state.
