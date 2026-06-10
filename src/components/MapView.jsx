// Mapa: basemap por tema, ruta principal resaltada (clic = tráfico),
// gasolineras y polígonos industriales, y hotspots por métrica.
import { useEffect, useRef, useMemo, memo } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Polygon,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import HotspotPopup from './HotspotPopup.jsx'
import { radiusFor } from '../utils/metrics.js'
import { TILES, POI_COLORS, ROUTE_COLORS } from '../dataConfig.js'

const SPAIN_CENTER = [39.7, -0.4]

// Convierte coords GeoJSON ([lon,lat]) a Leaflet ([lat,lon]).
const toLatLng = ([lon, lat]) => [lat, lon]
const ringToLatLng = (ring) => ring.map(toLatLng)

// Centro de un POI ([lat,lon]) para colocar su marcador.
const centerOf = (f) => {
  const c = f.properties?.center
  if (c) return toLatLng(c)
  if (f.geometry.type === 'Point') return toLatLng(f.geometry.coordinates)
  return null
}

// Capas de POIs memoizadas: sólo se redibujan si cambian los POIs/tema,
// no al cambiar de métrica o seleccionar un hotspot (cientos de polígonos).
const POILayers = memo(function POILayers({ fuel, industrial }) {
  const fuelAreas = fuel.filter((f) => f.geometry.type === 'Polygon')
  return (
    <>
      {/* Polígonos industriales (púrpura sombreado) */}
      {industrial.map((f, i) => (
        <Polygon
          key={`ind-${f.properties.osm || i}`}
          positions={f.geometry.coordinates.map(ringToLatLng)}
          pathOptions={{
            color: POI_COLORS.industrial,
            weight: 1,
            opacity: 0.85,
            fillColor: POI_COLORS.industrial,
            fillOpacity: 0.22,
          }}
        >
          <Tooltip sticky>{f.properties.name}</Tooltip>
        </Polygon>
      ))}

      {/* Áreas de gasolinera (explanada/parking) sombreadas en azul */}
      {fuelAreas.map((f, i) => (
        <Polygon
          key={`fuel-area-${f.properties.osm || i}`}
          positions={f.geometry.coordinates.map(ringToLatLng)}
          pathOptions={{
            color: POI_COLORS.fuel,
            weight: 1,
            opacity: 0.9,
            fillColor: POI_COLORS.fuel,
            fillOpacity: 0.28,
          }}
        >
          <Tooltip sticky>{f.properties.name}</Tooltip>
        </Polygon>
      ))}

      {/* Marcador en cada gasolinera (visible a cualquier zoom) */}
      {fuel.map((f, i) => {
        const c = centerOf(f)
        if (!c) return null
        return (
          <CircleMarker
            key={`fuel-${f.properties.osm || i}`}
            center={c}
            radius={4.5}
            pathOptions={{
              color: '#ffffff',
              weight: 1,
              opacity: 0.9,
              fillColor: POI_COLORS.fuel,
              fillOpacity: 0.95,
            }}
          >
            <Tooltip>{f.properties.name}</Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
})

// Controla encuadre (al cambiar de ámbito) y vuelo a un hotspot.
function MapController({ points, geometry, pois, selectedId, fitKey }) {
  const map = useMap()

  // El mapa se monta bajo el pliegue (debajo del hero): recalcular tamaño.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250)
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [map])

  useEffect(() => {
    const latlngs = []
    points.forEach((p) => latlngs.push([p.latitude, p.longitude]))
    geometry?.forEach((g) => g.coords.forEach((c) => latlngs.push(c)))
    pois?.fuel?.forEach((f) => {
      const c = centerOf(f)
      if (c) latlngs.push(c)
    })
    pois?.industrial?.forEach((f) =>
      f.geometry.coordinates[0]?.forEach((c) => latlngs.push(toLatLng(c))),
    )
    if (latlngs.length === 0) return
    map.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60], maxZoom: 11 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  useEffect(() => {
    if (!selectedId) return
    const p = points.find((x) => x.hotspot_id === selectedId)
    if (p)
      map.flyTo([p.latitude, p.longitude], Math.max(map.getZoom(), 11), {
        duration: 0.8,
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return null
}

export default function MapView({
  points,
  geometry,
  routeMeta,
  routeName,
  pois,
  showFuel,
  showIndustrial,
  topN,
  selectedId,
  onSelect,
  ranges,
  theme,
  fitKey,
}) {
  const markerRefs = useRef({})
  const tiles = TILES[theme] || TILES.dark
  const routeColor = ROUTE_COLORS[theme] || ROUTE_COLORS.dark
  const hotspotStroke = theme === 'light' ? '#0f172a' : '#0b1220'

  useEffect(() => {
    if (!selectedId) return
    const m = markerRefs.current[selectedId]
    if (m) {
      const t = setTimeout(() => m.openPopup(), 350)
      return () => clearTimeout(t)
    }
  }, [selectedId, points])

  const fuel = useMemo(
    () => (showFuel ? pois?.fuel || [] : []),
    [showFuel, pois],
  )
  const industrial = useMemo(
    () => (showIndustrial ? pois?.industrial || [] : []),
    [showIndustrial, pois],
  )

  return (
    <MapContainer
      center={SPAIN_CENTER}
      zoom={7}
      zoomControl={false}
      className="map"
      preferCanvas
    >
      <TileLayer
        key={theme}
        url={tiles.url}
        attribution={tiles.attribution}
        subdomains="abcd"
        maxZoom={19}
      />

      {/* Polígonos industriales (púrpura) + gasolineras (azul), memoizados */}
      <POILayers fuel={fuel} industrial={industrial} />

      {/* Líneas de ruta: variantes secundarias tenues */}
      {geometry
        ?.filter((g) => !g.isMain)
        .map((g, i) => (
          <Polyline
            key={`var-${i}`}
            positions={g.coords}
            pathOptions={{
              color: routeColor,
              weight: 1.5,
              opacity: 0.25,
              dashArray: '2 6',
            }}
          />
        ))}

      {/* Ruta principal: casing + línea sólida con popup de tráfico */}
      {geometry
        ?.filter((g) => g.isMain)
        .map((g, i) => (
          <Polyline
            key={`main-casing-${i}`}
            positions={g.coords}
            pathOptions={{
              color: routeColor,
              weight: 9,
              opacity: 0.18,
              lineCap: 'round',
            }}
            interactive={false}
          />
        ))}
      {geometry
        ?.filter((g) => g.isMain)
        .map((g, i) => (
          <Polyline
            key={`main-${i}`}
            positions={g.coords}
            pathOptions={{
              color: routeColor,
              weight: 4,
              opacity: 0.95,
              lineCap: 'round',
            }}
          >
            {routeMeta && (
              <Popup>
                <div className="route-popup">
                  <div className="route-popup-title">Ruta principal</div>
                  <div className="route-popup-name">{routeName}</div>
                  <div className="route-popup-stats">
                    <div>
                      <span className="rp-val">{routeMeta.totalTraffic}</span>
                      <span className="rp-lbl">vehículos (ruta)</span>
                    </div>
                    <div>
                      <span className="rp-val">{routeMeta.mainTraffic}</span>
                      <span className="rp-lbl">en la principal</span>
                    </div>
                    <div>
                      <span className="rp-val">{routeMeta.nVariants}</span>
                      <span className="rp-lbl">variantes</span>
                    </div>
                  </div>
                </div>
              </Popup>
            )}
          </Polyline>
        ))}

      {/* Halo Top-N */}
      {points
        .filter((p) => p.rank <= topN)
        .map((p) => (
          <CircleMarker
            key={`halo-${p.hotspot_id}`}
            center={[p.latitude, p.longitude]}
            radius={radiusFor(p.norm) + 7}
            pathOptions={{
              color: theme === 'light' ? '#0f172a' : '#ffffff',
              weight: 1.5,
              opacity: 0.85,
              fillColor: theme === 'light' ? '#0f172a' : '#ffffff',
              fillOpacity: 0.05,
            }}
            interactive={false}
          />
        ))}

      {/* Hotspots */}
      {points.map((p) => {
        const isSelected = p.hotspot_id === selectedId
        return (
          <CircleMarker
            key={p.hotspot_id}
            center={[p.latitude, p.longitude]}
            radius={radiusFor(p.norm)}
            ref={(el) => {
              if (el) markerRefs.current[p.hotspot_id] = el
            }}
            pathOptions={{
              color: isSelected
                ? theme === 'light'
                  ? '#0f172a'
                  : '#ffffff'
                : hotspotStroke,
              weight: isSelected ? 2.5 : 1.2,
              opacity: 1,
              fillColor: p.color,
              fillOpacity: 0.85,
            }}
            eventHandlers={{ click: () => onSelect(p.hotspot_id) }}
          >
            <Popup>
              <HotspotPopup point={p} ranges={ranges} />
            </Popup>
          </CircleMarker>
        )
      })}

      <MapController
        points={points}
        geometry={geometry}
        pois={{ fuel, industrial }}
        selectedId={selectedId}
        fitKey={fitKey}
      />
    </MapContainer>
  )
}
