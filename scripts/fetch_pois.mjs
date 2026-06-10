// ============================================================================
//  PRE-DESCARGA DE POIs DESDE OPENSTREETMAP (Overpass)
//
//  Genera public/data/pois.geojson con:
//    - Gasolineras  (amenity=fuel)            -> puntos
//    - Polígonos industriales (landuse=industrial) -> polígonos sombreados
//
//  Estrategia robusta: se teselа la región de las rutas en celdas y se hace
//  UNA consulta por celda (bounding-box, eficiente — el filtro `around` con
//  muchos puntos agota el timeout de Overpass). Después se asigna cada POI a
//  sus rutas por proximidad (properties.routes=[...]) para que la app filtre.
//
//  Importante: overpass-api.de devuelve 406 sin User-Agent propio (ver HEADERS).
//
//  Uso:  node scripts/fetch_pois.mjs   (se ejecuta una sola vez)
// ============================================================================
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Papa from 'papaparse'
import { parseWKT } from '../src/utils/wkt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ROUTES_CSV = path.join(ROOT, 'public/data/rutas_cluster___minSamples2.csv')
const OUT = path.join(ROOT, 'public/data/pois.geojson')

const BUFFER_M = 1500 // radio del corredor para gasolineras
const BUFFER_IND_M = 2500 // radio para centroides de polígonos industriales
const MAX_PTS_ROUTE = 60 // muestreo por ruta para asignación/teselado
const TILE = 1.2 // tamaño de celda en grados (~110 km)
const PAD = 0.05 // margen del bbox

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'ev-hotspots-demo/1.0 (contacto: raquelgarciah04@gmail.com)',
  Accept: 'application/json',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function haversine(aLat, aLon, bLat, bLon) {
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

function sample(points, max) {
  const seen = new Set()
  const out = []
  for (const [lat, lon] of points) {
    const k = `${lat.toFixed(3)},${lon.toFixed(3)}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push([lat, lon])
  }
  if (out.length <= max) return out
  const step = Math.ceil(out.length / max)
  return out.filter((_, i) => i % step === 0)
}

function bboxQuery(s, w, n, e) {
  const b = `${s},${w},${n},${e}`
  return `[out:json][timeout:120];
( node[amenity=fuel](${b});
  way[amenity=fuel](${b});
) -> .f;
( way[landuse=industrial](${b});
) -> .i;
.f out geom tags;
.i out geom tags;`
}

async function runOverpass(query, attempts = 10) {
  let lastErr
  for (let a = 0; a < attempts; a++) {
    const url = ENDPOINTS[a % ENDPOINTS.length]
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: HEADERS,
        body: 'data=' + encodeURIComponent(query),
      })
      if (res.ok) {
        const json = await res.json()
        if (json && Array.isArray(json.elements)) {
          if (json.remark && /timed out|error/i.test(json.remark)) {
            lastErr = new Error('remark: ' + json.remark)
          } else {
            return json
          }
        } else lastErr = new Error('respuesta sin elements')
      } else {
        const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10)
        const wait = Math.max(retryAfter * 1000, 10000 + a * 6000)
        lastErr = new Error(`HTTP ${res.status} en ${url}`)
        process.stdout.write(`[${res.status}, espera ${Math.round(wait / 1000)}s] `)
        await sleep(wait)
        continue
      }
    } catch (e) {
      lastErr = e
    }
    await sleep(8000)
  }
  throw lastErr
}

function centroid(geom) {
  let lat = 0
  let lon = 0
  for (const g of geom) {
    lat += g.lat
    lon += g.lon
  }
  return [lat / geom.length, lon / geom.length]
}

function routesNear(lat, lon, routeSamples, buffer) {
  const hits = []
  for (const [name, pts] of routeSamples) {
    for (const [rlat, rlon] of pts) {
      if (haversine(lat, lon, rlat, rlon) <= buffer) {
        hits.push(name)
        break
      }
    }
  }
  return hits
}

async function main() {
  const rows = Papa.parse(fs.readFileSync(ROUTES_CSV, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  }).data

  const byRoute = new Map()
  for (const r of rows) {
    const name = r.nombre_ruta_semantica
    // El notebook ha cambiado el nombre de la columna WKT en distintas
    // versiones (geometry / WKT / wkt). Probamos todos por compatibilidad.
    const wkt = r.geometry || r.WKT || r.wkt || r.geom
    const coords = parseWKT(wkt)
    if (!name || !coords) continue
    if (!byRoute.has(name)) byRoute.set(name, [])
    for (const c of coords) byRoute.get(name).push(c)
  }

  const routeSamples = []
  const allPts = []
  for (const [name, pts] of byRoute) {
    const s = sample(pts, MAX_PTS_ROUTE)
    routeSamples.push([name, s])
    allPts.push(...s)
  }

  // Bbox global + teselado; sólo celdas que contienen puntos de ruta.
  const lats = allPts.map((p) => p[0])
  const lons = allPts.map((p) => p[1])
  const minLat = Math.min(...lats) - PAD
  const maxLat = Math.max(...lats) + PAD
  const minLon = Math.min(...lons) - PAD
  const maxLon = Math.max(...lons) + PAD

  const tiles = []
  for (let s = minLat; s < maxLat; s += TILE) {
    for (let w = minLon; w < maxLon; w += TILE) {
      const n = Math.min(s + TILE, maxLat)
      const e = Math.min(w + TILE, maxLon)
      const hasPt = allPts.some(
        ([la, lo]) => la >= s && la <= n && lo >= w && lo <= e,
      )
      if (hasPt) tiles.push([s, w, n, e])
    }
  }
  console.log(
    `Rutas: ${routeSamples.length} · bbox [${minLat.toFixed(2)},${minLon.toFixed(2)} → ${maxLat.toFixed(2)},${maxLon.toFixed(2)}] · celdas: ${tiles.length}`,
  )

  const fuelEl = new Map()
  const indEl = new Map()
  for (let i = 0; i < tiles.length; i++) {
    const [s, w, n, e] = tiles[i]
    process.stdout.write(`  celda ${i + 1}/${tiles.length}… `)
    const data = await runOverpass(bboxQuery(s, w, n, e))
    let nf = 0
    let ni = 0
    for (const el of data.elements) {
      const key = `${el.type}/${el.id}`
      if (el.tags?.amenity === 'fuel' && !fuelEl.has(key)) {
        fuelEl.set(key, el)
        nf++
      } else if (el.tags?.landuse === 'industrial' && !indEl.has(key)) {
        indEl.set(key, el)
        ni++
      }
    }
    console.log(`+${nf} fuel, +${ni} ind (acum: ${fuelEl.size}/${indEl.size})`)
    await sleep(5000)
  }

  // Construcción + asignación de rutas por proximidad.
  const features = []
  let fAssigned = 0
  for (const el of fuelEl.values()) {
    const t = el.tags || {}
    // Nombre de empresa: marca primero (Repsol, Cepsa/Moeve, BP…), luego nombre.
    const name = t.brand || t.name || t.operator || 'Gasolinera'

    let geometry
    let clat
    let clon
    if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
      // Estación mapeada como área (incluye explanada/parking) -> polígono.
      const ring = el.geometry.map((g) => [g.lon, g.lat])
      const [f] = ring
      const l = ring[ring.length - 1]
      if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f)
      ;[clat, clon] = centroid(el.geometry)
      geometry = { type: 'Polygon', coordinates: [ring] }
    } else {
      // Estación mapeada como punto.
      clat = el.lat ?? el.center?.lat
      clon = el.lon ?? el.center?.lon
      if (clat == null || clon == null) continue
      geometry = { type: 'Point', coordinates: [clon, clat] }
    }

    const routes = routesNear(clat, clon, routeSamples, BUFFER_M)
    if (!routes.length) continue
    fAssigned++
    features.push({
      type: 'Feature',
      geometry,
      properties: {
        kind: 'fuel',
        osm: `${el.type}/${el.id}`,
        name,
        brand: t.brand || null,
        center: [clon, clat], // siempre disponible para el marcador
        routes,
      },
    })
  }

  let iAssigned = 0
  for (const el of indEl.values()) {
    if (!el.geometry || el.geometry.length < 3) continue
    const [clat, clon] = centroid(el.geometry)
    const routes = routesNear(clat, clon, routeSamples, BUFFER_IND_M)
    if (!routes.length) continue
    iAssigned++
    const ring = el.geometry.map((g) => [g.lon, g.lat])
    const [f] = ring
    const l = ring[ring.length - 1]
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f)
    const t = el.tags || {}
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        kind: 'industrial',
        osm: `${el.type}/${el.id}`,
        name: t.name || 'Polígono industrial',
        routes,
      },
    })
  }

  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }))
  console.log(`\nGuardado ${OUT}`)
  console.log(
    `Cerca de rutas: ${fAssigned} gasolineras, ${iAssigned} polígonos industriales (${features.length} features)`,
  )
}

main().catch((e) => {
  console.error('Fallo:', e)
  process.exit(1)
})
