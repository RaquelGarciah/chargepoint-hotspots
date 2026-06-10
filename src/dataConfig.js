// ============================================================================
//  CONFIGURACIÓN DE DATOS
//  Único punto a editar cuando mañana se regeneren las tablas oficiales.
//  Basta con dejar los CSV nuevos en /public/data/ y poner aquí sus nombres.
// ============================================================================

export const DATA_CONFIG = {
  // Carpeta servida estáticamente (relativa a la raíz del sitio).
  basePath: '/data/',

  // Tabla de HOTSPOTS (puntos candidatos). Es la tabla principal y autosuficiente.
  hotspotsFile: 'hotspots_odm_03_minSamples500_centroideMean.csv',

  // Tabla de RUTAS (líneas). Hoy trae nombre/cluster/tráfico; mañana incluirá geometría WKT.
  routesFile: 'rutas_cluster___minSamples2.csv',

  // POIs pre-descargados de OpenStreetMap (gasolineras + polígonos industriales).
  poisFile: 'pois.geojson',
}

// ----------------------------------------------------------------------------
//  COLORES de los POIs (decisión de cliente: gasolineras azul, polígonos púrpura).
// ----------------------------------------------------------------------------
export const POI_COLORS = {
  fuel: '#2563eb', // gasolineras (azul)
  industrial: '#8b5cf6', // polígonos industriales (púrpura)
}

// Color de la ruta principal según tema.
export const ROUTE_COLORS = {
  dark: '#f8fafc',
  light: '#0f172a',
}

// ----------------------------------------------------------------------------
//  BASEMAPS por tema (carreteras bien visibles, sin API key).
// ----------------------------------------------------------------------------
export const TILES = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    // Voyager: carreteras y autopistas muy claras sobre fondo claro.
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
}

// ----------------------------------------------------------------------------
//  NOMBRES DE COLUMNA esperados (centralizados por si cambian de nombre).
// ----------------------------------------------------------------------------
export const COLS = {
  route: 'nombre_ruta_semantica',
  cluster: 'cluster_fisico_id',
  hotspotId: 'hotspot_id',
  lat: 'latitude',
  lon: 'longitude',
  topOrigins: 'top_3_origenes',
  topDestinations: 'top_3_destinos',
  // Tráfico en la tabla de rutas
  routeTraffic: 'trafico_cluster',
  // Posibles nombres de la columna de geometría WKT en la tabla de rutas
  // (se probará el primero que exista).
  wktCandidates: ['geometry', 'wkt', 'WKT', 'geom', 'linestring', 'LINESTRING'],
}

// ----------------------------------------------------------------------------
//  MÉTRICAS visualizables.
//  weights = pesos del notebook para el opportunity_score (0.40 / 0.30 / 0.30).
// ----------------------------------------------------------------------------
export const METRICS = [
  {
    key: 'total_camiones',
    label: 'Tráfico de vehículos',
    short: 'Tráfico',
    unit: 'vehículos',
    description: 'Volumen de vehículos que pasan por el punto',
  },
  {
    key: 'avg_permanencia_min',
    label: 'Permanencia media',
    short: 'Permanencia',
    unit: 'min',
    description: 'Minutos medios de parada en el punto',
  },
  {
    key: 'avg_conduccion_horas',
    label: 'Conducción previa',
    short: 'Conducción',
    unit: 'h',
    description: 'Horas medias conducidas antes de llegar (regulación / descanso)',
  },
  {
    key: 'avg_conduccion_post_horas',
    label: 'Conducción posterior',
    short: 'Cond. post',
    unit: 'h',
    description: 'Horas medias conducidas después de salir del hotspot (siguiente etapa)',
  },
  {
    key: 'opportunity_score',
    label: 'Opportunity Score',
    short: 'Oportunidad',
    unit: '',
    description: 'Score combinado de negocio (tráfico + permanencia + regulación)',
  },
]

// Parámetros de saturación del opportunity_score (idénticos al notebook).
export const SCORE_PARAMS = {
  permanenciaSat: 45.0, // min
  conduccionSat: 4.5, // h
  wTrafico: 0.4,
  wPermanencia: 0.3,
  wRegulacion: 0.3,
}
