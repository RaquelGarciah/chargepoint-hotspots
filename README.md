# ⚡ Chargepoint Hotspots — Where to place EV chargers for truck fleets

> An interactive map that turns raw fleet-movement data into a clear, visual answer to a
> million-euro infrastructure question: **where should an energy company build electric
> truck-charging stations?**

Built with **React · Vite · Leaflet**, fed by a **PySpark + scikit-learn** geospatial
pipeline. Designed to be shown to a client and to *sell* a decision, not just plot dots.

## Demo

![Demo of the interactive hotspots map](docs/demo.gif)

▶️ **[Watch in HD (MP4)](docs/demo.mp4)**

---

## The problem

Electrifying long-haul trucking only works if chargers sit where trucks already **stop long
enough to charge** and where **traffic justifies the investment**. Picking those locations by
hand across a national road network is guesswork.

This project answers it with data. It:

1. **Discovers the main commercial corridors** that trucks actually drive (not the ones a map
   says they *could* drive), by clustering real journey node-sequences.
2. **Finds stop hotspots** along those corridors using spatial clustering of GPS pings.
3. **Scores every hotspot** for charging-station potential with a transparent, weighted
   business score.
4. **Presents it on an interactive map** a non-technical stakeholder can explore in seconds.

## What the app does

- 🗺️ **Light / dark basemaps** with clearly legible roads (CARTO Voyager / Dark Matter, no API key).
- 🎯 **Scope by route** (pick one semantic corridor) or **Global** (all aggregated hotspots).
- 🌡️ **Color + size each hotspot by a chosen metric** — `total_camiones`,
  `avg_permanencia_min`, `avg_conduccion_horas`, `opportunity_score`.
- 🎚️ **Combined mode** — weight sliders to build a custom score on the fly.
- 🔍 **Per-metric minimum filters** to hide noise and focus on the best candidates.
- 🛣️ **Route geometry** drawn from the corridor's `LINESTRING` (WKT); click it for traffic.
- ⛽ **Context layers** (toggle): nearby fuel stations and industrial estates pulled from
  OpenStreetMap — served locally, no runtime internet needed.
- 📊 **Live ranking** sidebar sorted by the active metric (click an entry to fly to it).
- 💬 **Rich popups** with all four metrics plus the top origins/destinations feeding the stop.

## How it works

### 1 · Data pipeline — [`charging_points.ipynb`](charging_points.ipynb)

A PySpark job (the version in this repo points at anonymized data-lake paths) that runs in
seven phases:

| Phase | What it does |
|-------|--------------|
| 1 — Journeys | Join semantic journeys with their routing node-sequences. |
| 2 — Route clustering | **NLP DBSCAN** (cosine distance over node-sequence "documents") groups journeys into the *physical* route variants actually driven. |
| 3 — Lines | Rebuild each corridor as a `LINESTRING` for mapping. |
| 4 — Labeling | Tag every truck journey with its discovered corridor; route noise drops out. |
| 5 — Hotspots | **Spatial DBSCAN** (haversine, traffic-weighted) finds stop clusters; the highest-traffic node becomes the epicentre. |
| 6 — KPIs & scoring | Dwell time, prior driving hours, traffic volume → normalized → **opportunity score**. |
| 7 — Export | Two tidy CSVs: route lines and scored hotspots. |

**Opportunity score** (transparent and tunable):

```
opportunity = 0.40 · traffic_norm + 0.30 · dwell_norm + 0.30 · regulation_norm
```

where dwell saturates at 45 min and prior-driving (mandatory-rest proxy) at 4.5 h — a long
stop after a long drive is the ideal charging window.

### 2 · Web app — [`src/`](src/)

A React SPA. Data is loaded **client-side** straight from the CSV/GeoJSON in
[`public/data/`](public/data/) — no backend required. Everything below is computed in the browser.

```
src/
├─ App.jsx              # Scroll-driven hero → dashboard shell (framer-motion)
├─ Dashboard.jsx        # State: scope, metric, weights, filters, layers
├─ dataConfig.js        # Single source of truth: file names, columns, metrics, colors
├─ hooks/useData.js     # CSV/GeoJSON loading + parsing (papaparse)
├─ utils/
│  ├─ metrics.js        # Normalization, combined score, chroma color scale + legend
│  └─ wkt.js            # WKT LINESTRING → Leaflet lat/lng parser
└─ components/          # MapView, ControlPanel, RankingList, HotspotPopup, Hero…
```

## Tech stack

| Layer | Tools |
|-------|-------|
| Frontend | React 18, Vite 5, React-Leaflet / Leaflet 1.9 |
| Visuals | framer-motion, chroma-js (color scales), Inter + Space Grotesk |
| Data parsing | papaparse |
| Pipeline | PySpark, scikit-learn (DBSCAN), pandas / numpy |
| Map data | OpenStreetMap, CARTO basemaps, Overpass API (for POIs) |

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

### Regenerating POIs (optional)

Fuel stations and industrial estates are pre-fetched into
[`public/data/pois.geojson`](public/data/). To rebuild them from OpenStreetMap (e.g. after
changing routes):

```bash
npm run pois         # scripts/fetch_pois.mjs — queries Overpass per bounding-box cell
```

The app itself never calls the network for POIs; it reads the committed GeoJSON.

## Updating the data

Swap in new pipeline outputs without touching app code:

1. Drop the new CSVs into [`public/data/`](public/data/).
2. If file names change, edit only [`src/dataConfig.js`](src/dataConfig.js)
   (`hotspotsFile`, `routesFile`).
3. Refresh the browser — no rebuild needed.

### Data schema

**Hotspots** — the primary, self-contained table (lat/lon + metrics):

| Column | Meaning |
|--------|---------|
| `nombre_ruta_semantica` | Semantic corridor name |
| `cluster_fisico_id` | Physical route-variant id |
| `hotspot_id` | Stop-cluster id |
| `latitude`, `longitude` | Epicentre coordinates |
| `total_camiones` | Distinct trucks passing through |
| `avg_permanencia_min` | Mean dwell time (min) |
| `avg_conduccion_horas` | Mean prior driving (h) — rest-regulation proxy |
| `opportunity_score` | Combined 0–1 business score |
| `top_3_origenes`, `top_3_destinos` | Dominant origins / destinations |

**Routes** — corridor geometry: `nombre_ruta_semantica`, `cluster_fisico_id`,
`trafico_cluster`, and a `geometry` `LINESTRING` (`lon lat`, flipped to `lat lon` for Leaflet).

> **Note on the data.** The CSVs included here are an **anonymized simulation** so the demo is
> fully runnable and self-contained. The notebook is sanitized — it shows the real methodology
> against generic data-lake paths, with no proprietary infrastructure or PII.

## Roadmap

- Deploy a live demo (Vercel / GitHub Pages).
- Charger-count sizing per hotspot from dwell + traffic.
- Isochrone / grid-capacity overlays.

## License

[MIT](LICENSE) © Raquel García
