// ============================================================================
//  PARSER WKT  ->  coordenadas Leaflet
//
//  IMPORTANTE sobre el orden de coordenadas:
//  El notebook (Fase 3) construye la geometría con
//      format_string('%.4f %.4f', lon, lat)
//  es decir, cada par es "lon lat" (orden WKT estándar).
//  Leaflet, en cambio, necesita [lat, lon]. Por eso aquí SE INVIERTE cada par.
// ============================================================================

/**
 * Parsea una geometría WKT (LINESTRING o MULTILINESTRING) y devuelve coordenadas
 * en formato Leaflet.
 *
 * @param {string} wkt
 * @returns {Array<[number, number]> | Array<Array<[number, number]>> | null}
 *   - LINESTRING        -> [[lat, lon], ...]
 *   - MULTILINESTRING   -> [[[lat, lon], ...], ...]
 *   - inválido / vacío  -> null
 */
export function parseWKT(wkt) {
  if (!wkt || typeof wkt !== 'string') return null
  const text = wkt.trim()
  if (!text) return null

  const upper = text.toUpperCase()

  if (upper.startsWith('MULTILINESTRING')) {
    // MULTILINESTRING((lon lat, ...), (lon lat, ...))
    const inner = stripType(text, 'MULTILINESTRING')
    const groups = splitGroups(inner)
    const lines = groups.map(parseCoordList).filter((l) => l && l.length >= 2)
    return lines.length ? lines : null
  }

  if (upper.startsWith('LINESTRING')) {
    const inner = stripType(text, 'LINESTRING')
    const coords = parseCoordList(inner)
    return coords && coords.length >= 2 ? coords : null
  }

  return null
}

// Quita "TYPE(" del principio y ")" del final.
function stripType(text, type) {
  let s = text.trim()
  s = s.slice(type.length).trim() // quita el nombre del tipo
  // quita el primer "(" y el último ")"
  if (s.startsWith('(')) s = s.slice(1)
  if (s.endsWith(')')) s = s.slice(0, -1)
  return s.trim()
}

// Para MULTILINESTRING: separa los grupos "(...)", "(...)".
function splitGroups(inner) {
  const groups = []
  let depth = 0
  let current = ''
  for (const ch of inner) {
    if (ch === '(') {
      depth++
      if (depth === 1) {
        current = ''
        continue
      }
    }
    if (ch === ')') {
      if (depth === 1) {
        groups.push(current)
        depth--
        continue
      }
      depth--
    }
    if (depth >= 1) current += ch
  }
  return groups
}

// "lon lat, lon lat, ..." -> [[lat, lon], ...]  (¡invierte a lat,lon!)
function parseCoordList(inner) {
  if (!inner) return null
  return inner
    .split(',')
    .map((pair) => {
      const nums = pair.trim().split(/\s+/).map(Number)
      const [lon, lat] = nums
      if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon]
      return null
    })
    .filter(Boolean)
}
