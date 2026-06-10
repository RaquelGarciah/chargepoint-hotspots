// ============================================================================
//  CARGA Y PREPARACIÓN DE DATOS
//  - Lee los dos CSV en runtime (fetch) -> reemplazables sin recompilar.
//  - Agrega los hotspots por punto físico DENTRO de cada ruta.
//  - Extrae la geometría de ruta (WKT) si la columna existe.
// ============================================================================
import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import { DATA_CONFIG, COLS } from '../dataConfig.js'
import { parseWKT } from '../utils/wkt.js'
import { computeOpportunity } from '../utils/metrics.js'

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject,
    })
  })
}

function fetchJson(url) {
  return fetch(url).then((r) => (r.ok ? r.json() : null))
}

// Detecta cuál de los nombres candidatos de columna WKT está presente.
function detectWktColumn(rows) {
  if (!rows || !rows.length) return null
  const keys = Object.keys(rows[0])
  return COLS.wktCandidates.find((c) => keys.includes(c)) || null
}

// Parsea "Murcia - Covera (3 camiones, 100.0%) | Madrid (1 camiones, 25%)"
// en [{ place, count }]. Ignora el % original: se recalcula al agregar.
function parseTopEntries(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)\s*\((\d+(?:[.,]\d+)?)\s*camiones?/i)
      if (m) return { place: m[1].trim(), count: Number(String(m[2]).replace(',', '.')) || 0 }
      return { place: s, count: 0 }
    })
}

// Suma los counts de un Map<place, count> y devuelve el top-N con su % sobre
// `total` (el total de camiones del hotspot agregado).
function topShares(map, total, n = 3) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([place, count]) => ({
      place,
      count,
      pct: total > 0 ? (count / total) * 100 : null,
    }))
}

// ----------------------------------------------------------------------------
// BUCKETIZACIÓN DE POIs POR PROXIMIDAD (auto-actualiza con las rutas del CSV)
// ----------------------------------------------------------------------------
// Mismos buffers que scripts/fetch_pois.mjs para mantener coherencia con la
// asignación que hace ese script al regenerar pois.geojson.
const POI_BUFFER_FUEL_M = 1500
const POI_BUFFER_IND_M = 2500
const POI_MAX_PTS_PER_ROUTE = 60 // muestreo para acotar el coste de proximidad

function haversineM(aLat, aLon, bLat, bLon) {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const la1 = (aLat * Math.PI) / 180
  const la2 = (bLat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Centroide aproximado de un feature GeoJSON. GeoJSON usa [lon,lat]; devolvemos [lat,lon].
function featureCentroid(f) {
  const g = f.geometry
  if (!g) return null
  if (g.type === 'Point') return [g.coordinates[1], g.coordinates[0]]
  let ring
  if (g.type === 'Polygon') ring = g.coordinates[0]
  else if (g.type === 'MultiPolygon') ring = g.coordinates[0]?.[0]
  if (!ring || !ring.length) return null
  let lat = 0
  let lon = 0
  for (const [lo, la] of ring) {
    lat += la
    lon += lo
  }
  return [lat / ring.length, lon / ring.length]
}

// Muestrea puntos de una ruta: dedup por celdas de 3 decimales (~100 m) y stride.
function sampleRoutePoints(variants, max) {
  const seen = new Set()
  const out = []
  for (const v of variants || []) {
    const isMulti = Array.isArray(v.coords?.[0]?.[0])
    const segs = isMulti ? v.coords : [v.coords]
    for (const seg of segs) {
      for (const [la, lo] of seg || []) {
        const k = la.toFixed(3) + ',' + lo.toFixed(3)
        if (seen.has(k)) continue
        seen.add(k)
        out.push([la, lo])
      }
    }
  }
  if (out.length <= max) return out
  const step = Math.ceil(out.length / max)
  return out.filter((_, i) => i % step === 0)
}

// Bucketiza POIs reasignando properties.routes IGNORÁNDOLO: usa las geometrías
// actuales de las rutas. Así, regenerar rutas_cluster___minSamples2.csv basta
// para que la app re-asigne los POIs a las nuevas rutas sin tocar pois.geojson.
// Sólo hay que regenerar pois.geojson (npm run pois) si las rutas nuevas caen
// fuera del bbox que ya descargó scripts/fetch_pois.mjs.
function bucketPoisByRoute(poisGeo, routeGeometry) {
  const poisByRoute = {}
  const allPois = { fuel: [], industrial: [] }
  if (!poisGeo || !Array.isArray(poisGeo.features)) {
    return { poisByRoute, allPois }
  }

  // Index de rutas con bbox para prefiltro rápido (descartar POIs lejanos sin haversine).
  const routes = []
  for (const [name, variants] of Object.entries(routeGeometry || {})) {
    const pts = sampleRoutePoints(variants, POI_MAX_PTS_PER_ROUTE)
    if (!pts.length) continue
    let minLat = Infinity
    let maxLat = -Infinity
    let minLon = Infinity
    let maxLon = -Infinity
    for (const [la, lo] of pts) {
      if (la < minLat) minLat = la
      if (la > maxLat) maxLat = la
      if (lo < minLon) minLon = lo
      if (lo > maxLon) maxLon = lo
    }
    routes.push({ name, pts, minLat, maxLat, minLon, maxLon })
    poisByRoute[name] = { fuel: [], industrial: [] }
  }

  // ~1° lat ≈ 111 km. Padding generoso para el prefiltro bbox (no afecta a la decisión final).
  const degBufFuel = POI_BUFFER_FUEL_M / 111000 + 0.005
  const degBufInd = POI_BUFFER_IND_M / 111000 + 0.005

  const t0 = performance.now ? performance.now() : Date.now()
  for (const f of poisGeo.features) {
    const kind = f.properties?.kind
    if (kind === 'fuel') allPois.fuel.push(f)
    else if (kind === 'industrial') allPois.industrial.push(f)
    else continue

    if (!routes.length) continue
    const c = featureCentroid(f)
    if (!c) continue
    const [lat, lon] = c
    const buf = kind === 'industrial' ? POI_BUFFER_IND_M : POI_BUFFER_FUEL_M
    const degBuf = kind === 'industrial' ? degBufInd : degBufFuel

    for (const r of routes) {
      if (lat < r.minLat - degBuf || lat > r.maxLat + degBuf) continue
      if (lon < r.minLon - degBuf || lon > r.maxLon + degBuf) continue
      for (const [rlat, rlon] of r.pts) {
        if (haversineM(lat, lon, rlat, rlon) <= buf) {
          if (kind === 'fuel') poisByRoute[r.name].fuel.push(f)
          else poisByRoute[r.name].industrial.push(f)
          break
        }
      }
    }
  }
  const ms = (performance.now ? performance.now() : Date.now()) - t0

  // Si alguna ruta queda sin POIs cercanos, lo más probable es que esté fuera
  // del bbox del último fetch a Overpass — avisamos para que se ejecute npm run pois.
  if (routes.length) {
    const empty = routes
      .map((r) => r.name)
      .filter((n) => !poisByRoute[n].fuel.length && !poisByRoute[n].industrial.length)
    console.info(
      `[POIs] ${poisGeo.features.length} features re-asignadas a ${routes.length} rutas en ${ms.toFixed(0)}ms`,
    )
    if (empty.length) {
      console.warn(
        `[POIs] ${empty.length} ruta(s) sin POIs cercanos — probable bbox antiguo. ` +
          `Si añadiste rutas en zonas nuevas, ejecuta:  npm run pois\n` +
          empty.map((n) => '  · ' + n).join('\n'),
      )
    }
  }

  return { poisByRoute, allPois }
}

// Agrega las filas de UNA ruta por punto físico (hotspot_id).
function aggregateRoute(rows) {
  const byHotspot = new Map()

  for (const r of rows) {
    const id = r[COLS.hotspotId]
    if (id == null) continue
    const traffic = Number(r.total_camiones) || 0

    if (!byHotspot.has(id)) {
      byHotspot.set(id, {
        hotspot_id: id,
        latitude: Number(r[COLS.lat]),
        longitude: Number(r[COLS.lon]),
        total_camiones: 0,
        _permWeighted: 0,
        _condWeighted: 0,
        _condPostWeighted: 0,
        _weight: 0,
        clusters: new Set(),
        // Acumulan camiones por lugar SUMANDO todas las rutas/clusters que
        // pasan por este punto físico (clave para la vista global).
        _origins: new Map(),
        _destinations: new Map(),
      })
    }

    const agg = byHotspot.get(id)
    agg.total_camiones += traffic
    agg._permWeighted += (Number(r.avg_permanencia_min) || 0) * traffic
    agg._condWeighted += (Number(r.avg_conduccion_horas) || 0) * traffic
    agg._condPostWeighted += (Number(r.avg_conduccion_post_horas) || 0) * traffic
    agg._weight += traffic
    if (r[COLS.cluster] != null) agg.clusters.add(r[COLS.cluster])

    // Agregamos orígenes/destinos sumando los camiones de cada lugar.
    for (const e of parseTopEntries(r[COLS.topOrigins])) {
      agg._origins.set(e.place, (agg._origins.get(e.place) || 0) + e.count)
    }
    for (const e of parseTopEntries(r[COLS.topDestinations])) {
      agg._destinations.set(e.place, (agg._destinations.get(e.place) || 0) + e.count)
    }
  }

  const points = [...byHotspot.values()].map((a) => {
    const w = a._weight || 1
    return {
      hotspot_id: a.hotspot_id,
      latitude: a.latitude,
      longitude: a.longitude,
      total_camiones: a.total_camiones,
      avg_permanencia_min: a._permWeighted / w,
      avg_conduccion_horas: a._condWeighted / w,
      avg_conduccion_post_horas: a._condPostWeighted / w,
      n_clusters: a.clusters.size,
      // Top orígenes/destinos agregados sobre TODAS las rutas de este punto,
      // con su % respecto al total de camiones del hotspot.
      top_origins: topShares(a._origins, a.total_camiones),
      top_destinations: topShares(a._destinations, a.total_camiones),
    }
  })

  // opportunity_score recalculado (pesos del notebook) con el rango de tráfico
  // de los puntos de ESTA ruta.
  const traffics = points.map((p) => p.total_camiones)
  const tMin = Math.min(...traffics)
  const tMax = Math.max(...traffics)
  for (const p of points) {
    p.opportunity_score = computeOpportunity(p, tMin, tMax)
  }

  return points
}

export function useData() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    routes: [],
    hotspotsByRoute: {},
    globalHotspots: [],
    routeGeometry: {},
    routeMeta: {},
    poisByRoute: {},
    allPois: { fuel: [], industrial: [] },
    hasPois: false,
    hasGeometry: false,
    stats: null,
  })

  useEffect(() => {
    let cancelled = false
    const { basePath, hotspotsFile, routesFile, poisFile } = DATA_CONFIG

    Promise.all([
      fetchCsv(basePath + hotspotsFile),
      fetchCsv(basePath + routesFile).catch(() => []), // rutas es opcional
      fetchJson(basePath + poisFile).catch(() => null), // POIs son opcionales
    ])
      .then(([hotspotRows, routeRows, poisGeo]) => {
        if (cancelled) return

        // --- Hotspots agrupados por ruta ---
        const grouped = new Map()
        for (const r of hotspotRows) {
          const route = r[COLS.route]
          if (!route) continue
          if (!grouped.has(route)) grouped.set(route, [])
          grouped.get(route).push(r)
        }

        const hotspotsByRoute = {}
        for (const [route, rows] of grouped) {
          hotspotsByRoute[route] = aggregateRoute(rows)
        }

        // Agregación GLOBAL (todas las rutas) por punto físico.
        const globalHotspots = aggregateRoute(hotspotRows)

        const routes = [...grouped.keys()].sort((a, b) =>
          a.localeCompare(b, 'es'),
        )

        // --- Geometría de ruta (WKT) + metadatos (principal / total) ---
        const wktCol = detectWktColumn(routeRows)
        const routeGeometry = {}
        const routeMeta = {}
        if (wktCol) {
          for (const r of routeRows) {
            const route = r[COLS.route]
            if (!route) continue
            const coords = parseWKT(r[wktCol])
            if (!coords) continue
            if (!routeGeometry[route]) routeGeometry[route] = []
            routeGeometry[route].push({
              cluster: r[COLS.cluster],
              traffic: Number(r[COLS.routeTraffic]) || 0,
              coords,
            })
          }
          for (const [route, variants] of Object.entries(routeGeometry)) {
            let mainIndex = 0
            let mainTraffic = -1
            let totalTraffic = 0
            variants.forEach((v, i) => {
              totalTraffic += v.traffic
              if (v.traffic > mainTraffic) {
                mainTraffic = v.traffic
                mainIndex = i
              }
            })
            variants.forEach((v, i) => (v.isMain = i === mainIndex))
            routeMeta[route] = {
              mainIndex,
              mainTraffic,
              totalTraffic,
              nVariants: variants.length,
            }
          }
        }

        // --- POIs: re-bucketización en cliente por proximidad a las rutas ---
        // Ignoramos `properties.routes` pre-asignado (puede quedarse obsoleto
        // si los nombres de ruta cambian entre regeneraciones del notebook).
        // Recalculamos contra las geometrías actuales: con regenerar el CSV de
        // rutas basta para que los POIs se reasignen automáticamente.
        const { poisByRoute, allPois } = bucketPoisByRoute(poisGeo, routeGeometry)

        const totalHotspots = new Set(
          hotspotRows.map((r) => r[COLS.hotspotId]),
        ).size

        setState({
          loading: false,
          error: null,
          routes,
          hotspotsByRoute,
          globalHotspots,
          routeGeometry,
          routeMeta,
          poisByRoute,
          allPois,
          hasPois: Boolean(poisGeo?.features?.length),
          hasGeometry: Boolean(wktCol),
          wktColumn: wktCol,
          stats: {
            nRoutes: routes.length,
            nHotspotRows: hotspotRows.length,
            nPhysicalHotspots: totalHotspots,
          },
        })
      })
      .catch((err) => {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err.message || String(err) }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
