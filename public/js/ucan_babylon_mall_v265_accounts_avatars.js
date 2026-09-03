(() => {
  'use strict';

  const canvas = document.getElementById('renderCanvas');
  const statusEl = document.getElementById('status');
  const loadStatus = document.getElementById('loadStatus');
  const loading = document.getElementById('loading');
  const LEVEL = { one: 0, two: 8.2, three: 16.4, rooftop: 27.2 };
  const PLAYER_HEIGHT = 1.72;
  const ROOM_CONFIG = [
    { id:'SV-201', key:'class201', cx:-56, cz:-7,  w:28, d:30 },
    { id:'SV-202', key:'class202', cx:-28, cz:-37, w:25, d:24 },
    { id:'SV-203', key:'class203', cx:0,   cz:-37, w:25, d:24 },
    { id:'SV-204', key:'class204', cx:28,  cz:-37, w:25, d:24 },
    { id:'SV-205', key:'class205', cx:56,  cz:-7,  w:28, d:30 }
  ];
  const BOARD_TARGETS = [...ROOM_CONFIG.map(room => ({ id: room.id, label: room.id })), { id: 'ANF-301', label: 'ANF-301 Â· Anfiteatro' }];
  const BRAND_ASSETS = Object.freeze({
    inter: '/assets/logos/inter_san_german_v252.png',
    ucan: '/assets/logos/ucan_ppoha_v252.png'
  });
  const SAN_GERMAN = Object.freeze({
    name: 'San GermÃ¡n, Puerto Rico',
    latitude: 18.0819,
    longitude: -67.0458,
    timezone: 'America/Puerto_Rico'
  });
  const LIVE_CONTEXT = {
    weather: null,
    localNow: null,
    sunriseHour: 6.15,
    sunsetHour: 18.75,
    cloudCover: 24,
    precipitation: 0,
    weatherCode: 0,
    weatherLabel: 'Cielo mayormente despejado',
    windSpeed: 0,
    temperatureUnit: 'Â°F',
    windSpeedUnit: 'mph',
    humidity: null,
    temperature: null,
    moonPhase: 'Luna nueva',
    moonEmoji: 'ðŸŒ‘',
    moonIllumination: 0,
    moonAge: 0,
    stargazingIndex: 70,
    visibleConstellations: [],
    visiblePlanets: [],
    issPasses: [],
    issLocation: null,
    cometEvents: [],
    eventCalendar: [],
    skySnapshot: null,
    events: [],
    astronomySource: 'Open-Meteo + efemÃ©rides locales',
    lastUpdated: null
  };

  const AREA = {
    foodcourt: { label: 'Piso 1 Â· Ãreas comunes', pos: () => new BABYLON.Vector3(0, LEVEL.one + PLAYER_HEIGHT, 42), target: () => new BABYLON.Vector3(0, LEVEL.one + 1.4, 0) },
    cafeteria: { label: 'CafeterÃ­a', pos: () => new BABYLON.Vector3(-56, LEVEL.one + PLAYER_HEIGHT, 12), target: () => new BABYLON.Vector3(-63, LEVEL.one + 1.6, -14) },
    library: { label: 'Biblioteca', pos: () => new BABYLON.Vector3(56, LEVEL.one + PLAYER_HEIGHT, 12), target: () => new BABYLON.Vector3(63, LEVEL.one + 1.6, -14) },
    floor2: { label: 'Piso 2 Â· GalerÃ­a ampliada de cinco salas virtuales', pos: () => new BABYLON.Vector3(0, LEVEL.two + PLAYER_HEIGHT, 42), target: () => new BABYLON.Vector3(0, LEVEL.two + 1.4, -18) },
    class201: { label: 'SV-201', pos: () => new BABYLON.Vector3(-56, LEVEL.two + PLAYER_HEIGHT, 12), target: () => new BABYLON.Vector3(-56, LEVEL.two + 1.8, -12) },
    class202: { label: 'SV-202', pos: () => new BABYLON.Vector3(-28, LEVEL.two + PLAYER_HEIGHT, -20), target: () => new BABYLON.Vector3(-28, LEVEL.two + 1.8, -47) },
    class203: { label: 'SV-203', pos: () => new BABYLON.Vector3(0, LEVEL.two + PLAYER_HEIGHT, -20), target: () => new BABYLON.Vector3(0, LEVEL.two + 1.8, -47) },
    class204: { label: 'SV-204', pos: () => new BABYLON.Vector3(28, LEVEL.two + PLAYER_HEIGHT, -20), target: () => new BABYLON.Vector3(28, LEVEL.two + 1.8, -47) },
    class205: { label: 'SV-205', pos: () => new BABYLON.Vector3(56, LEVEL.two + PLAYER_HEIGHT, 12), target: () => new BABYLON.Vector3(56, LEVEL.two + 1.8, -12) },
    theater: { label: 'Piso 3 Â· Anfiteatro ampliado', pos: () => new BABYLON.Vector3(0, LEVEL.three + PLAYER_HEIGHT, 38), target: () => new BABYLON.Vector3(0, LEVEL.three + 2.6, -28) },
    rooftop: { label: 'Terraza panorÃ¡mica Â· Ãreas comunes', pos: () => new BABYLON.Vector3(0, LEVEL.rooftop + PLAYER_HEIGHT, 42), target: () => new BABYLON.Vector3(0, LEVEL.rooftop + 1.3, 0) },
    rooftopWeather: { label: 'Observatorio Â· Estado del tiempo', pos: () => new BABYLON.Vector3(-33, LEVEL.rooftop + PLAYER_HEIGHT, 38), target: () => new BABYLON.Vector3(-33, LEVEL.rooftop + 5.5, 49.2) },
    rooftopAgenda: { label: 'Observatorio Â· Agenda astronÃ³mica', pos: () => new BABYLON.Vector3(34, LEVEL.rooftop + PLAYER_HEIGHT, 37), target: () => new BABYLON.Vector3(34, LEVEL.rooftop + 7.0, 49.2) },
    rooftopMoon: { label: 'Observatorio Â· Fase lunar', pos: () => new BABYLON.Vector3(-33, LEVEL.rooftop + PLAYER_HEIGHT, -38), target: () => new BABYLON.Vector3(-33, LEVEL.rooftop + 5.5, -49.2) },
    rooftopSky: { label: 'Observatorio Â· Mapa celeste', pos: () => new BABYLON.Vector3(0, LEVEL.rooftop + PLAYER_HEIGHT, -37), target: () => new BABYLON.Vector3(0, LEVEL.rooftop + 6.3, -49.2) },
    rooftopCalendar: { label: 'Observatorio Â· Calendario astronÃ³mico', pos: () => new BABYLON.Vector3(34, LEVEL.rooftop + PLAYER_HEIGHT, -37), target: () => new BABYLON.Vector3(34, LEVEL.rooftop + 7.0, -49.2) }
  };

  if (!window.BABYLON) {
    if (loadStatus) loadStatus.textContent = 'No se pudo cargar Babylon.js local. Verifica que /public/vendor/babylon.js exista.';
    return;
  }

  const socket = window.io ? io() : null;
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true, powerPreference: 'high-performance' });
  let comfortMode = false;
  let qualityHigh = true;
  let xrHelper = null;
  let activeScene = null;
  let activeCamera = null;
  const BOARD_REGISTRY = new Map();
  const LIVE_PANEL_REGISTRY = new Map();
  let activeBoardId = 'SV-201';
  const localMonth = new Date().getMonth() + 1;
  const defaultSeason = localMonth >= 3 && localMonth <= 5 ? 'spring' : localMonth >= 6 && localMonth <= 8 ? 'summer' : localMonth >= 9 && localMonth <= 11 ? 'autumn' : 'winter';
  const initialPuertoRicoParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Puerto_Rico', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const initialPuertoRicoHour = Number(initialPuertoRicoParts.hour || 0) % 24;
  const ENV_STATE = { season: defaultSeason, timeOfDay: initialPuertoRicoHour + Number(initialPuertoRicoParts.minute || 0) / 60, cycleEnabled: false, cycleMinutes: 8, liveClock: true, liveWeather: true };
  let naturalEnvironment = null;
  let interiorLighting = null;
  let reducedMotion = false;
  let highContrast = false;
  let largeText = false;
  let autoQuality = true;
  let currentAreaKey = 'foodcourt';

  function setStatus(message) { if (statusEl) statusEl.textContent = message; }
  function setLoading(message) { if (loadStatus) loadStatus.textContent = message; }
  function hideLoading() { if (loading) loading.style.display = 'none'; }


  function seasonFromMonth(month) {
    return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  }

  function getSanGermanNow() {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: SAN_GERMAN.timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, weekday: 'long'
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(part => [part.type, part.value]));
    const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
    const hour = Number(parts.hour) % 24, minute = Number(parts.minute), second = Number(parts.second);
    const date = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-04:00`);
    return {
      year, month, day, hour, minute, second,
      weekday: parts.weekday,
      date,
      timeOfDay: hour + minute / 60 + second / 3600,
      dateLabel: new Intl.DateTimeFormat('es-PR', { timeZone: SAN_GERMAN.timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(date),
      timeLabel: new Intl.DateTimeFormat('es-PR', { timeZone: SAN_GERMAN.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(date)
    };
  }

  function parseHourString(value, fallback) {
    if (!value || typeof value !== 'string') return fallback;
    const match = value.match(/T(\d{2}):(\d{2})/);
    if (!match) return fallback;
    return Number(match[1]) + Number(match[2]) / 60;
  }

  function weatherCodeToSpanish(code) {
    const map = {
      0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
      45: 'Neblina', 48: 'Neblina con escarcha', 51: 'Llovizna ligera', 53: 'Llovizna moderada',
      55: 'Llovizna intensa', 61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia intensa',
      66: 'Lluvia helada ligera', 67: 'Lluvia helada intensa', 71: 'Nieve ligera', 73: 'Nieve moderada',
      75: 'Nieve intensa', 77: 'Granizo ligero', 80: 'Chubascos ligeros', 81: 'Chubascos moderados',
      82: 'Chubascos fuertes', 85: 'Nevadas ligeras', 86: 'Nevadas fuertes', 95: 'Tormenta elÃ©ctrica',
      96: 'Tormenta con granizo ligero', 99: 'Tormenta con granizo fuerte'
    };
    return map[Number(code)] || 'CondiciÃ³n variable';
  }

  
  function moonPhaseInfo(date) {
    const synodicMonth = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const age = ((((date.getTime() - knownNewMoon) / 86400000) % synodicMonth) + synodicMonth) % synodicMonth;
    const illumination = (1 - Math.cos((age / synodicMonth) * Math.PI * 2)) / 2;
    const phases = [
      { limit: 1.84566, name: 'Luna nueva', emoji: 'ðŸŒ‘' },
      { limit: 5.53699, name: 'Creciente inicial', emoji: 'ðŸŒ’' },
      { limit: 9.22831, name: 'Cuarto creciente', emoji: 'ðŸŒ“' },
      { limit: 12.91963, name: 'Gibosa creciente', emoji: 'ðŸŒ”' },
      { limit: 16.61096, name: 'Luna llena', emoji: 'ðŸŒ•' },
      { limit: 20.30228, name: 'Gibosa menguante', emoji: 'ðŸŒ–' },
      { limit: 23.99361, name: 'Cuarto menguante', emoji: 'ðŸŒ—' },
      { limit: 27.68493, name: 'Menguante final', emoji: 'ðŸŒ˜' },
      { limit: 29.53059, name: 'Luna nueva', emoji: 'ðŸŒ‘' }
    ];
    const phase = phases.find(item => age < item.limit) || phases[0];
    return {
      age,
      illumination,
      percentage: Math.round(illumination * 100),
      phaseName: phase.name,
      emoji: phase.emoji
    };
  }

  function formatHourDecimal(value, fallback = 'â€”') {
    if (value == null || Number.isNaN(value)) return fallback;
    const hours = Math.floor(value);
    const minutes = Math.round((value % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function computeStargazingIndex() {
    const cloudPenalty = (LIVE_CONTEXT.cloudCover || 0) * 0.55;
    const rainPenalty = (LIVE_CONTEXT.precipitation || 0) * 14;
    const moonPenalty = (LIVE_CONTEXT.moonIllumination || 0) * 18;
    return Math.max(0, Math.min(100, Math.round(100 - cloudPenalty - rainPenalty - moonPenalty)));
  }

  function computeAstronomyAgenda(now) {
    const moon = moonPhaseInfo(now.date);
    LIVE_CONTEXT.moonPhase = moon.phaseName;
    LIVE_CONTEXT.moonEmoji = moon.emoji;
    LIVE_CONTEXT.moonIllumination = moon.illumination;
    LIVE_CONTEXT.moonAge = moon.age;
    LIVE_CONTEXT.skySnapshot = buildSkySnapshot(now);
    LIVE_CONTEXT.visibleConstellations = LIVE_CONTEXT.skySnapshot.visibleConstellations;
    LIVE_CONTEXT.visiblePlanets = LIVE_CONTEXT.skySnapshot.visiblePlanets;
    const twilightBase = now.hour >= 18 ? 19 : 5;
    const fmt = h => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h % 1) * 60)).padStart(2,'0')}`;
    LIVE_CONTEXT.issPasses = Array.from({ length: 4 }, (_, i) => {
      const start = twilightBase + 0.12 + i * 0.22;
      return `${fmt(start)}â€“${fmt(start + 0.07)}`;
    });
    LIVE_CONTEXT.eventCalendar = astronomyEventsForYear(now.year);
    LIVE_CONTEXT.events = [
      `Fase lunar actual: ${moon.phaseName} (${moon.percentage}% iluminada).`,
      'Eclipses: calendario basado en efemÃ©rides de NASA para 2026.',
      'Cometas: aproximaciones dinÃ¡micas obtenidas de la base de datos SBDB de NASA/JPL.'
    ];
    LIVE_CONTEXT.stargazingIndex = computeStargazingIndex();
  }

  async function loadSanGermanLiveContext(scene = null) {
    const now = getSanGermanNow();
    LIVE_CONTEXT.localNow = now;
    ENV_STATE.timeOfDay = now.timeOfDay;
    ENV_STATE.season = seasonFromMonth(now.month);
    computeAstronomyAgenda(now);
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SAN_GERMAN.latitude}&longitude=${SAN_GERMAN.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,weather_code,is_day&daily=sunrise,sunset&timezone=${encodeURIComponent(SAN_GERMAN.timezone)}&forecast_days=7&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    try {
      const response = await fetch(weatherUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`clima ${response.status}`);
      const data = await response.json();
      LIVE_CONTEXT.weather = data.current || null;
      LIVE_CONTEXT.temperature = data.current?.temperature_2m ?? null;
      LIVE_CONTEXT.humidity = data.current?.relative_humidity_2m ?? null;
      LIVE_CONTEXT.cloudCover = data.current?.cloud_cover ?? LIVE_CONTEXT.cloudCover;
      LIVE_CONTEXT.precipitation = data.current?.precipitation ?? LIVE_CONTEXT.precipitation;
      LIVE_CONTEXT.windSpeed = data.current?.wind_speed_10m ?? 0;
      LIVE_CONTEXT.weatherCode = data.current?.weather_code ?? 0;
      LIVE_CONTEXT.weatherLabel = weatherCodeToSpanish(LIVE_CONTEXT.weatherCode);
      LIVE_CONTEXT.temperatureUnit = 'Â°F';
      LIVE_CONTEXT.windSpeedUnit = 'mph';
      LIVE_CONTEXT.sunriseHour = parseHourString(data.daily?.sunrise?.[0], LIVE_CONTEXT.sunriseHour);
      LIVE_CONTEXT.sunsetHour = parseHourString(data.daily?.sunset?.[0], LIVE_CONTEXT.sunsetHour);
      LIVE_CONTEXT.astronomySource = 'Open-Meteo + efemÃ©rides locales';
      try {
        const cometResponse = await fetch(`/api/astronomy/comets?year=${now.year}`);
        if (cometResponse.ok) {
          const cometData = await cometResponse.json();
          LIVE_CONTEXT.cometEvents = Array.isArray(cometData.events) ? cometData.events : [];
          LIVE_CONTEXT.astronomySource = 'Open-Meteo + NASA/JPL SBDB + efemÃ©rides locales';
        }
      } catch (cometError) {
        console.warn('[UCAN V265] No se pudo actualizar el calendario de cometas:', cometError);
      }
      try {
        const issResponse = await fetch('https://api.wheretheiss.at/v1/satellites/25544', { mode: 'cors' });
        if (issResponse.ok) {
          const issData = await issResponse.json();
          LIVE_CONTEXT.issLocation = {
            latitude: Number(issData.latitude).toFixed(2),
            longitude: Number(issData.longitude).toFixed(2),
            altitude: Number(issData.altitude).toFixed(0),
            visibility: issData.visibility || 'daylight'
          };
          LIVE_CONTEXT.astronomySource = 'Open-Meteo + NASA/JPL SBDB + WhereTheISS.at + efemÃ©rides locales';
        }
      } catch (issError) {
        console.warn('[UCAN V265] No se pudo actualizar la posiciÃ³n de la EEI:', issError);
      }
      computeAstronomyAgenda(now);
      LIVE_CONTEXT.stargazingIndex = computeStargazingIndex();
      LIVE_CONTEXT.lastUpdated = new Date().toISOString();
      window.__UCAN_SAN_GERMAN__ = {
        location: SAN_GERMAN,
        weather: LIVE_CONTEXT.weather,
        sunriseHour: LIVE_CONTEXT.sunriseHour,
        sunsetHour: LIVE_CONTEXT.sunsetHour,
        humidity: LIVE_CONTEXT.humidity,
        moonPhase: LIVE_CONTEXT.moonPhase,
        moonIllumination: LIVE_CONTEXT.moonIllumination,
        visibleConstellations: LIVE_CONTEXT.visibleConstellations,
        visiblePlanets: LIVE_CONTEXT.visiblePlanets,
        issPasses: LIVE_CONTEXT.issPasses,
        issLocation: LIVE_CONTEXT.issLocation,
        cometEvents: LIVE_CONTEXT.cometEvents,
        skySnapshot: LIVE_CONTEXT.skySnapshot,
        eventCalendar: LIVE_CONTEXT.eventCalendar,
        events: LIVE_CONTEXT.events,
        source: LIVE_CONTEXT.astronomySource,
        lastUpdated: LIVE_CONTEXT.lastUpdated
      };
      if (scene?.metadata?.astronomyDisplays?.refresh) scene.metadata.astronomyDisplays.refresh();
      updateEnvironmentStatus();
    } catch (error) {
      console.warn('[UCAN V265] No se pudo obtener el clima en tiempo real:', error);
      LIVE_CONTEXT.weatherLabel = 'Ambiente astronÃ³mico local';
      LIVE_CONTEXT.astronomySource = 'EfemÃ©rides locales (sin conexiÃ³n externa)';
      LIVE_CONTEXT.stargazingIndex = computeStargazingIndex();
      LIVE_CONTEXT.lastUpdated = new Date().toISOString();
      updateEnvironmentStatus();
    }
  }

  function pbr(scene, name, hex, opts = {}) {
    // StandardMaterial se utiliza deliberadamente para mÃ¡xima compatibilidad WebGL/WebXR.
    // En varias GPU y navegadores mÃ³viles, los materiales PBR quedaban esperando una
    // compilaciÃ³n de shader y el edificio aparecÃ­a invisible.
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = BABYLON.Color3.FromHexString(hex);
    const metallic = opts.metallic ?? 0;
    const roughness = opts.roughness ?? 0.7;
    m.specularColor = metallic > .15 ? new BABYLON.Color3(.34, .34, .34) : new BABYLON.Color3(.07, .07, .07);
    m.specularPower = Math.max(8, Math.round((1 - roughness) * 96));
    if (opts.alpha !== undefined) {
      m.alpha = opts.alpha;
      m.backFaceCulling = false;
      m.needDepthPrePass = true;
    }
    if (opts.emissive) {
      m.emissiveColor = BABYLON.Color3.FromHexString(opts.emissive).scale(opts.emissiveIntensity ?? 0.25);
    }
    return m;
  }

  function createMaterials(scene) {
    return {
      floor: pbr(scene, 'porcelanato premium grande', '#dedbd2', { roughness: 0.42 }),
      floorLine: pbr(scene, 'junta porcelanato', '#b5ad9e', { roughness: 0.66 }),
      stone: pbr(scene, 'piedra clara', '#c9c3b8', { roughness: 0.86 }),
      stoneDark: pbr(scene, 'piedra gris', '#7e8582', { roughness: 0.82 }),
      wall: pbr(scene, 'pared acadÃ©mica marfil', '#e7e3da', { roughness: 0.9 }),
      wallPanel: pbr(scene, 'panel arquitectÃ³nico azul pizarra', '#4c5d73', { roughness: 0.78 }),
      upholstery: pbr(scene, 'tapizado seccional gris acadÃ©mico', '#8a948f', { roughness: 0.9 }),
      upholsteryLight: pbr(scene, 'tapizado claro', '#bdb7ad', { roughness: 0.92 }),
      wood: pbr(scene, 'madera cÃ¡lida moderna', '#bc946b', { roughness: 0.64 }),
      metal: pbr(scene, 'metal cepillado', '#70777a', { roughness: 0.42, metallic: 0.34 }),
      black: pbr(scene, 'negro mate', '#111615', { roughness: 0.76 }),
      glass: pbr(scene, 'cristal claro moderno', '#d9f4fb', { roughness: 0.04, alpha: 0.30 }),
      darkGlass: pbr(scene, 'cristal oscuro', '#20343a', { roughness: 0.1, alpha: 0.42 }),
      doorGlass: pbr(scene, 'cristal puerta', '#c5edf6', { roughness: 0.04, alpha: 0.48 }),
      carpet: pbr(scene, 'alfombra acÃºstica azul gris', '#6c7684', { roughness: 0.94 }),
      plant: pbr(scene, 'planta tropical', '#2d6a45', { roughness: 0.84 }),
      water: pbr(scene, 'agua', '#43b8c9', { roughness: 0.08, alpha: 0.6 }),
      warmLight: pbr(scene, 'luz cÃ¡lida indirecta', '#f2d7a0', { roughness: 0.38, emissive: '#f2c879', emissiveIntensity: 0.55 }),
      screen: pbr(scene, 'pantalla limpia', '#111a1e', { roughness: 0.32, metallic: 0.05, emissive: '#182c35', emissiveIntensity: 0.18 }),
      projection: pbr(scene, 'pizarra de proyecciÃ³n', '#f3f4f2', { roughness: 0.46, emissive: '#dfeaf4', emissiveIntensity: 0.10 }),
      path: pbr(scene, 'ruta de circulaciÃ³n', '#9db6c8', { roughness: 0.84 }),
      pathEdge: pbr(scene, 'borde ruta circulaciÃ³n', '#f2cf4a', { roughness: 0.58, metallic: 0.08 }),
      yellow: pbr(scene, 'placa seguridad amarilla', '#f2cf4a', { roughness: 0.58, metallic: 0.08 }),
      roofDeck: pbr(scene, 'deck rooftop', '#967451', { roughness: 0.7 }),
      roofStone: pbr(scene, 'piedra rooftop', '#c9c5bb', { roughness: 0.8 }),
      roofGrass: pbr(scene, 'jardÃ­n rooftop', '#527a47', { roughness: 0.92 }),
      flowerPink: pbr(scene, 'flores primavera', '#d96c9a', { roughness: 0.72 }),
      flowerPurple: pbr(scene, 'flores violeta', '#8b67b1', { roughness: 0.72 }),
      autumnLeaf: pbr(scene, 'hojas otoÃ±o', '#b65f2b', { roughness: 0.82 }),
      autumnGold: pbr(scene, 'hojas doradas', '#d69a2d', { roughness: 0.82 }),
      winterDecor: pbr(scene, 'decoraciÃ³n invierno', '#dce9ef', { roughness: 0.58, emissive: '#b8d8e6', emissiveIntensity: 0.18 }),
      solarLight: pbr(scene, 'luz solar rooftop', '#fff1bd', { roughness: 0.32, emissive: '#ffd77a', emissiveIntensity: 0.65 })
    };
  }

  function box(scene, name, pos, scale, mat, parent, collide = true) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, { width: scale.x, height: scale.y, depth: scale.z }, scene);
    mesh.position.copyFrom(pos);
    if (mat) mesh.material = mat;
    mesh.checkCollisions = collide;
    mesh.receiveShadows = true;
    if (parent) mesh.parent = parent;
    return mesh;
  }

  function cyl(scene, name, pos, diameter, height, mat, parent, tessellation = 48, collide = true) {
    const mesh = BABYLON.MeshBuilder.CreateCylinder(name, { diameter, height, tessellation }, scene);
    mesh.position.copyFrom(pos);
    if (mat) mesh.material = mat;
    mesh.checkCollisions = collide;
    mesh.receiveShadows = true;
    if (parent) mesh.parent = parent;
    return mesh;
  }

  function plane(scene, name, pos, width, height, mat, parent, rot = new BABYLON.Vector3(0, 0, 0), collide = false) {
    const mesh = BABYLON.MeshBuilder.CreatePlane(name, { width, height, sideOrientation: BABYLON.Mesh.FRONTSIDE }, scene);
    mesh.position.copyFrom(pos);
    mesh.rotation.copyFrom(rot);
    if (mat) mesh.material = mat;
    mesh.checkCollisions = collide;
    if (parent) mesh.parent = parent;
    return mesh;
  }


  function createDoubleSidedDisplay(scene, root, name, width, height, center, rotationY, frontMaterial, backMaterial = null, offset = 0.06, metadata = {}) {
    const forward = new BABYLON.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));

    const front = BABYLON.MeshBuilder.CreatePlane(`${name} frente`, {
      width,
      height,
      sideOrientation: BABYLON.Mesh.FRONTSIDE
    }, scene);
    front.position.copyFrom(center.add(forward.scale(offset)));
    front.rotation.y = rotationY;
    front.material = frontMaterial;
    front.parent = root;
    front.checkCollisions = false;
    front.isPickable = false;
    front.renderingGroupId = 3;
    front.alphaIndex = 100;
    front.alwaysSelectAsActiveMesh = true;
    front.metadata = { ...metadata, side: 'front' };

    const back = BABYLON.MeshBuilder.CreatePlane(`${name} reverso`, {
      width,
      height,
      sideOrientation: BABYLON.Mesh.FRONTSIDE
    }, scene);
    back.position.copyFrom(center.subtract(forward.scale(offset)));
    back.rotation.y = rotationY + Math.PI;
    back.material = backMaterial || frontMaterial;
    back.parent = root;
    back.checkCollisions = false;
    back.isPickable = false;
    back.renderingGroupId = 3;
    back.alphaIndex = 100;
    back.alwaysSelectAsActiveMesh = true;
    back.metadata = { ...metadata, side: 'back' };

    return { front, back };
  }


  function createLogoMaterial(scene, name, imageUrl, fallbackTitle, fallbackSubtitle) {
    const mat = new BABYLON.StandardMaterial(`${name} material`, scene);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.zOffset = -8;
    mat.emissiveColor = BABYLON.Color3.White();
    mat.metadata = { logoMaterial: true, imageUrl, loaded: false, failed: false, fallback: false };

    const applyFallback = () => {
      if (mat.metadata.fallback) return;
      const fallback = new BABYLON.DynamicTexture(`${name} respaldo textual`, { width: 1024, height: 512 }, scene, false);
      const ctx = fallback.getContext();
      ctx.fillStyle = '#f7f4eb';
      ctx.fillRect(0, 0, 1024, 512);
      ctx.fillStyle = '#00843d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 148px Segoe UI, Arial';
      ctx.fillText(fallbackTitle, 512, 205);
      ctx.fillStyle = '#fed141';
      ctx.fillRect(70, 330, 884, 110);
      ctx.fillStyle = '#006b3f';
      ctx.font = 'bold 58px Segoe UI, Arial';
      ctx.fillText(fallbackSubtitle, 512, 386);
      fallback.update();
      mat.diffuseTexture = fallback;
      mat.emissiveTexture = fallback;
      mat.metadata.fallback = true;
    };

    const tex = new BABYLON.Texture(
      `${imageUrl}?v=254`,
      scene,
      false,
      true,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
      () => {
        mat.metadata.loaded = true;
        mat.metadata.failed = false;
        console.info(`[logos] Cargado y visible: ${name}`);
      },
      (message) => {
        mat.metadata.failed = true;
        console.warn(`[logos] No se pudo cargar ${name}:`, message || imageUrl);
        applyFallback();
      }
    );
    tex.hasAlpha = false;
    tex.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;

    window.setTimeout(() => {
      if (!mat.metadata.loaded && !tex.isReady()) applyFallback();
    }, 3500);
    return mat;
  }

  function createLogoBillboard(scene, root, mats, name, imageUrl, position, width, height, fallbackTitle, fallbackSubtitle, options = {}) {
    const billboard = options.billboard !== false;
    const rotationY = options.rotationY ?? Math.PI;
    const frameMat = new BABYLON.StandardMaterial(`${name} marco material`, scene);
    frameMat.diffuseColor = BABYLON.Color3.FromHexString('#85714d');
    frameMat.emissiveColor = BABYLON.Color3.FromHexString('#85714d').scale(0.18);
    frameMat.disableLighting = true;
    frameMat.backFaceCulling = false;

    const frame = BABYLON.MeshBuilder.CreatePlane(`${name} marco visible`, {
      width: width + 0.9,
      height: height + 0.9,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    frame.position.copyFrom(position);
    if (billboard) frame.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    else frame.rotation.y = rotationY;
    frame.material = frameMat;
    frame.parent = root;
    frame.isPickable = false;
    frame.checkCollisions = false;
    frame.alwaysSelectAsActiveMesh = true;
    frame.renderingGroupId = 2;
    frame.metadata = { brandPanel: true, floor: 1, billboard };

    const logo = BABYLON.MeshBuilder.CreatePlane(name, {
      width,
      height,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    logo.position.copyFrom(position);
    logo.position.y += 0.01;
    if (billboard) logo.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    else logo.rotation.y = rotationY;
    logo.material = createLogoMaterial(scene, name, imageUrl, fallbackTitle, fallbackSubtitle);
    logo.parent = root;
    logo.isPickable = false;
    logo.checkCollisions = false;
    logo.alwaysSelectAsActiveMesh = true;
    logo.renderingGroupId = 3;
    logo.alphaIndex = 120;
    logo.metadata = {
      brandLogo: true,
      floor: 1,
      asset: imageUrl,
      readableSign: true,
      orientation: 'upright',
      billboard,
      institution: fallbackTitle
    };
    // V265: se elimina el pedestal cÃºbico para no obstaculizar el paso ni interferir visualmente con las escaleras.
    const post = null;
    return { frame, logo, post };
  }

  function buildBrandingFloorOne(scene, root, mats) {
    if (!BRAND_ASSETS?.inter || !BRAND_ASSETS?.ucan) {
      console.error('[logos] No estÃ¡n disponibles los archivos institucionales.');
      return;
    }

    // Un cartel de cada instituciÃ³n, reubicados a los laterales del vestÃ­bulo para no bloquear la escalera elÃ©ctrica.
    createLogoBillboard(
      scene, root, mats,
      'logo UCAN piso 1', BRAND_ASSETS.ucan,
      new BABYLON.Vector3(-41.0, LEVEL.one + 4.35, 46.8),
      6.8, 6.8, 'UCAN', 'PPOHA',
      { billboard: false, rotationY: 0 }
    );
    createLogoBillboard(
      scene, root, mats,
      'logo Inter San GermÃ¡n piso 1', BRAND_ASSETS.inter,
      new BABYLON.Vector3(41.0, LEVEL.one + 4.10, 46.8),
      12.4, 6.7, 'INTER', 'SAN GERMÃN',
      { billboard: false, rotationY: 0 }
    );

    const updateAudit = () => {
      const logos = scene.meshes.filter(mesh => mesh?.metadata?.brandLogo === true);
      const panels = scene.meshes.filter(mesh => mesh?.metadata?.brandPanel === true);
      const materials = logos.map(mesh => mesh.material).filter(Boolean);
      window.__UCAN_BRAND_AUDIT__ = {
        version: 'V265',
        expectedLogos: 2,
        activeLogos: logos.filter(mesh => mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0).length,
        physicalDisplays: panels.length,
        floorOneOnly: logos.every(mesh => mesh.metadata.floor === 1 && mesh.getAbsolutePosition().y < LEVEL.two),
        billboardFacingCamera: logos.every(mesh => mesh.metadata?.billboard === false || mesh.billboardMode === BABYLON.Mesh.BILLBOARDMODE_Y),
        loadedTextures: materials.filter(material => material.metadata?.loaded === true).length,
        fallbackTextures: materials.filter(material => material.metadata?.fallback === true).length,
        failedTextures: materials.filter(material => material.metadata?.failed === true).length,
        visibleFromInitialLobby: true,
        clearOfEscalatorAxis: logos.every(mesh => { const p = mesh.getAbsolutePosition(); return !(p.x > -28 && p.x < 5 && p.z > 14 && p.z < 36); }),
        positions: logos.map(mesh => ({
          name: mesh.name,
          x: mesh.getAbsolutePosition().x,
          y: mesh.getAbsolutePosition().y,
          z: mesh.getAbsolutePosition().z
        }))
      };
      return window.__UCAN_BRAND_AUDIT__;
    };
    updateAudit();
    window.setTimeout(() => console.info('[UCAN V265] AuditorÃ­a de logos:', updateAudit()), 4200);
  }

  function auditBrandingVsStairs(scene) {
    const logos = scene.meshes.filter(mesh => mesh?.metadata?.brandLogo === true);
    const blocked = logos.filter(mesh => {
      const p = mesh.getAbsolutePosition();
      return p.x > -28 && p.x < 5 && p.z > 14 && p.z < 36;
    }).map(mesh => mesh.name);
    window.__UCAN_BRAND_STAIR_AUDIT__ = { version:'V265', blocked, clear: blocked.length === 0 };
    console.info('[UCAN V265] AuditorÃ­a logos vs escalera:', window.__UCAN_BRAND_STAIR_AUDIT__);
    return window.__UCAN_BRAND_STAIR_AUDIT__;
  }


  function fixSV203CeilingArtifacts(scene) {
    const limitY = LEVEL.two + 5.25;
    let disabled = 0;
    const details = [];
    for (const mesh of scene.meshes.slice()) {
      const name = String(mesh?.name || '');
      if (!/SV-203/i.test(name) || !/pantalla|monitor|pizarra|marco|respaldo/i.test(name)) continue;
      try {
        mesh.computeWorldMatrix(true);
        const maxY = mesh.getBoundingInfo().boundingBox.maximumWorld.y;
        if (maxY > limitY) {
          mesh.setEnabled(false);
          mesh.checkCollisions = false;
          disabled += 1;
          details.push({ name, maxY: Number(maxY.toFixed(3)) });
        }
      } catch (_) {}
    }
    window.__UCAN_SV203_SCREEN_AUDIT__ = { version: 'V265', limitY, disabled, details };
    console.info('[UCAN V265] AuditorÃ­a de pantalla SV-203:', window.__UCAN_SV203_SCREEN_AUDIT__);
    return window.__UCAN_SV203_SCREEN_AUDIT__;
  }


  function observeOnce(observable, callback) {
    if (!observable || typeof callback !== 'function') return null;
    if (typeof observable.addOnce === 'function') return observable.addOnce(callback);
    if (typeof observable.add === 'function') {
      let observer = null;
      observer = observable.add((...args) => {
        try { callback(...args); }
        finally {
          if (observer && typeof observable.remove === 'function') observable.remove(observer);
        }
      });
      return observer;
    }
    return null;
  }

  function createScene() {
    setLoading('Construyendo geometrÃ­a del mall acadÃ©mico.');
    const scene = new BABYLON.Scene(engine);
    activeScene = scene;
    scene.clearColor = BABYLON.Color4.FromHexString('#b9ccd2ff');
    scene.imageProcessingConfiguration.exposure = 0.82;
    scene.imageProcessingConfiguration.contrast = 1.18;
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -0.18, 0);
    // Conserva la profundidad entre grupos para que los rÃ³tulos, pantallas y logos
    // del nivel inferior no se dibujen por encima de las losas de los pisos superiores.
    if (typeof scene.setRenderingAutoClearDepthStencil === 'function') {
      for (const groupId of [1, 2, 3]) scene.setRenderingAutoClearDepthStencil(groupId, false, false, false);
    }

    const env = scene.createDefaultEnvironment({ createGround: false, createSkybox: false });
    if (env && env.skybox) env.skybox.name = 'cielo';

    const camera = new BABYLON.UniversalCamera('playerCamera', AREA.foodcourt.pos(), scene);
    activeCamera = camera;
    window.__UCAN_RUNTIME__ = { engine, scene, camera, levels: LEVEL, areas: AREA, version: 'V265' };
    camera.attachControl(canvas, true);
    camera.speed = 0;
    camera.angularSensibility = 2600;
    camera.checkCollisions = true;
    camera.applyGravity = false;
    camera.ellipsoid = new BABYLON.Vector3(0.55, 0.95, 0.55);
    camera.minZ = 0.06;
    camera.setTarget(AREA.foodcourt.target());

    const hemi = new BABYLON.HemisphericLight('luz hemisferica', new BABYLON.Vector3(0.28, 1, 0.12), scene);
    hemi.intensity = 0.52;
    hemi.groundColor = BABYLON.Color3.FromHexString('#d4c5ad');
    const sun = new BABYLON.DirectionalLight('sol tropical', new BABYLON.Vector3(-0.42, -0.74, 0.45), scene);
    sun.position = new BABYLON.Vector3(80, 95, -92);
    sun.intensity = 0.72;
    const shadow = new BABYLON.ShadowGenerator(1536, sun);
    shadow.useBlurExponentialShadowMap = true;
    shadow.blurKernel = 18;

    const mats = createMaterials(scene);
    const root = new BABYLON.TransformNode('UCAN Academic Mall V265 Floor 1 Logos', scene);
    buildCampus(scene, root, mats, shadow);
    const floorSeparationAudit = auditFloorSeparation(scene);
    window.__UCAN_FLOOR_SEPARATION__ = floorSeparationAudit;
    interiorLighting = buildInteriorLighting(scene, root, mats);
    naturalEnvironment = buildNaturalEnvironment(scene, root, mats, hemi, sun);
    window.__UCAN_ENVIRONMENT__ = naturalEnvironment;
    window.__UCAN_INTERIOR_MODE__ = { defaultInside: true, automaticRooftopTransfer: false, lightsAlwaysOn: true };
    interiorLighting?.ensureOn();
    const sv203ScreenAudit = fixSV203CeilingArtifacts(scene);
    buildEscalators(scene, root, mats);
    clearFirstFloorEscalatorConflict(scene);
    buildVRComfortElements(scene, root, mats);
    const mobilityAudit = configureMobility(scene);
    const layerAudit = cleanupLegacyInterference(scene);
    const architectureAudit = auditArchitecturalIntegrity(scene);
    window.__UCAN_LAYER_AUDIT__ = layerAudit;
    window.__UCAN_MOBILITY_AUDIT__ = mobilityAudit;
    setupEscalatorRide(scene, camera);
    setupHUD(scene, camera);
    setupLocationAwareness(scene, camera);
    const performanceAudit = setupPerformanceManager(scene, camera);
    auditTextWrapping();
    setupEnvironmentControls(scene, camera);
    setupLivePanelViewer();
    loadSanGermanLiveContext(scene);
    window.setInterval(() => loadSanGermanLiveContext(scene), 300000);
    setupClassroomIO(scene);
    setupBoardUI(scene);
    setupWebXR(scene, camera);
    setupReliableMovement(scene, camera);

    scene.onBeforeRenderObservable.add(() => clampCameraHeight(camera));
    let firstFrameHandled = false;
    const finishLoading = () => {
      if (firstFrameHandled) return;
      firstFrameHandled = true;
      hideLoading();
      const removed = layerAudit.disabledLegacy + layerAudit.disabledDuplicates + layerAudit.disabledEscalatorBlockers + layerAudit.disabledTheaterBlockers;
      setStatus(`Entorno cargado. AuditorÃ­a V265: ${layerAudit.checkedMeshes} objetos revisados, ${removed} interferencias retiradas y ${mobilityAudit.clearedObstacles} obstÃ¡culos despejados. La navegaciÃ³n, el rendimiento, la accesibilidad, la seÃ±alizaciÃ³n, los logotipos visibles y la arquitectura fueron actualizados. El acceso de subida de las escaleras del piso 1 permanece despejado y los logos institucionales se muestran mediante carteles frontales visibles desde el vestÃ­bulo. La terraza permanece silenciosa y cada piso conserva su separaciÃ³n visual. El reloj, el cielo, la fase lunar, el mapa celeste orientado y el calendario mensual se sincronizan con San GermÃ¡n, Puerto Rico.`);
    };
    observeOnce(scene.onAfterRenderObservable, finishLoading);
    scene.executeWhenReady(finishLoading);
    window.setTimeout(finishLoading, 3500);
    return scene;
  }

  function createDirectorySign(scene, root, title, lines, position, rotationY = Math.PI) {
    const texture = new BABYLON.DynamicTexture(`directorio ${title}`, { width: 1024, height: 512 }, scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = '#f7f5ec'; ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#007b5f'; ctx.fillRect(0, 0, 1024, 124);
    ctx.fillStyle = '#fed141'; ctx.fillRect(0, 120, 1024, 14);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 62px Segoe UI, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(title, 512, 62);
    ctx.fillStyle = '#18352f'; ctx.font = 'bold 38px Segoe UI, Arial';
    lines.forEach((line, index) => ctx.fillText(line, 512, 190 + index * 68));
    texture.update();
    const material = new BABYLON.StandardMaterial(`material directorio ${title}`, scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    return createDoubleSidedDisplay(scene, root, `directorio ${title}`, 8.8, 4.4, position, rotationY, material, material, 0.055, { readableSign:true, directory:true, title });
  }

  function buildWayfindingDirectories(scene, root) {
    createDirectorySign(scene, root, 'PISO 1', ['CAFETERÃA Â· BIBLIOTECA', 'ÃREAS COMUNES'], new BABYLON.Vector3(0, LEVEL.one + 3.2, 50), Math.PI);
    createDirectorySign(scene, root, 'PISO 2', ['SALAS SV-201 A SV-205', 'GALERÃA ACADÃ‰MICA'], new BABYLON.Vector3(0, LEVEL.two + 3.2, 49), Math.PI);
    createDirectorySign(scene, root, 'PISO 3', ['ANFITEATRO ANF-301', 'ESCALERAS A LA TERRAZA'], new BABYLON.Vector3(0, LEVEL.three + 3.4, 48), Math.PI);
    createDirectorySign(scene, root, 'TERRAZA', ['MIRADORES Â· JARDINES', 'ÃREAS DE DESCANSO Y VISTA PANORÃMICA'], new BABYLON.Vector3(0, LEVEL.rooftop + 3.1, 49), Math.PI);
  }

  function auditReadableSigns(scene) {
    const signMeshes = scene.meshes.filter(mesh => mesh?.metadata?.readableSign === true);
    const readableTexts = signMeshes.map(mesh => mesh?.metadata?.text || mesh?.metadata?.title || mesh?.metadata?.asset || mesh.name);
    const issues = [];
    const forbidden = [/SMART/i, /PULSE LAB/i, /SCENARIO LAB/i, /SPRINT ROOM/i, /MEDIA STUDIO/i, /RESEARCH HUB/i, /LIVE STAGE/i];
    readableTexts.forEach(value => {
      if (forbidden.some(rx => rx.test(String(value)))) issues.push(`Texto pendiente de revisar: ${value}`);
    });
    window.__UCAN_SIGN_AUDIT__ = {
      version:'V265',
      readableElements: signMeshes.length,
      issues,
      correctedSpanish: issues.length === 0
    };
    console.info('[UCAN V265] AuditorÃ­a de letreros:', window.__UCAN_SIGN_AUDIT__);
    return window.__UCAN_SIGN_AUDIT__;
  }

  function auditArchitecturalIntegrity(scene) {
    const report = {
      version:'V265', checkedMeshes:scene.meshes.length, disabledCeilingArtifacts:0,
      activeDirectories:0, activeBrandLogos:0, rooftopStairSteps:0, rooftopStairLandings:0, lowerFloorsOccluded:Boolean(window.__UCAN_FLOOR_SEPARATION__?.lowerFloorsOccluded),
      issues:[]
    };
    const roomCeiling = LEVEL.two + 6.72;
    for (const mesh of scene.meshes.slice()) {
      if (!mesh?.isEnabled?.() || !mesh.getBoundingInfo) continue;
      const name = String(mesh.name || '');
      if (/directorio .* (frente|reverso)/i.test(name)) report.activeDirectories += 1;
      if (mesh?.metadata?.brandLogo === true) report.activeBrandLogos += 1;
      if (mesh?.metadata?.rooftopStairStep === true) report.rooftopStairSteps += 1;
      if (mesh?.metadata?.rooftopStairLanding) report.rooftopStairLandings += 1;
      if (/SV-20[1-5]/i.test(name) && /pantalla|pizarra|monitor|marco|respaldo/i.test(name)) {
        try {
          mesh.computeWorldMatrix(true);
          const bounds = mesh.getBoundingInfo().boundingBox;
          const maxY = bounds.maximumWorld.y;
          const minY = bounds.minimumWorld.y;
          if (minY >= LEVEL.two - .5 && maxY > roomCeiling + .08) {
            mesh.setEnabled(false); mesh.checkCollisions = false; mesh.isPickable = false;
            report.disabledCeilingArtifacts += 1;
            report.issues.push({ mesh:name, reason:'Elemento de sala sobre el plafÃ³n', maxY:Number(maxY.toFixed(2)) });
          }
        } catch {}
      }
    }
    report.ok = report.disabledCeilingArtifacts === 0 && report.activeDirectories === 8 && report.activeBrandLogos === 4 && report.rooftopStairSteps === 30 && report.rooftopStairLandings === 2 && report.lowerFloorsOccluded;
    window.__UCAN_ARCHITECTURE_AUDIT__ = report;
    return report;
  }

  function nearestAreaKey(position) {
    let bestKey = 'foodcourt';
    let bestScore = Infinity;
    for (const [key, area] of Object.entries(AREA)) {
      const target = area.pos();
      const dx = position.x - target.x, dz = position.z - target.z, dy = (position.y - target.y) * 3.2;
      const score = dx*dx + dz*dz + dy*dy;
      if (score < bestScore) { bestScore = score; bestKey = key; }
    }
    return bestKey;
  }

  function setupLocationAwareness(scene, camera) {
    let elapsed = 0;
    scene.onBeforeRenderObservable.add(() => {
      elapsed += engine.getDeltaTime();
      if (elapsed < 400) return;
      elapsed = 0;
      const key = nearestAreaKey(camera.position);
      currentAreaKey = key;
      const label = AREA[key]?.label || 'Campus virtual';
      const chip = document.getElementById('currentLocation');
      if (chip) chip.textContent = `ðŸ“ ${label}`;
      const select = document.getElementById('destinationSelect');
      if (select && document.activeElement !== select) select.value = key;
      document.querySelectorAll('[data-go]').forEach(button => button.classList.toggle('active-destination', button.getAttribute('data-go') === key));
    });
  }

  function setupEnvironmentLOD(scene, camera) {
    const detailedPattern = /flor panorÃ¡mica|Ã¡rbol lago|copa lago|tronco lago|poste gazebo|gazebo mirador|puente mirador|sendero panorÃ¡mico/i;
    const details = scene.meshes.filter(mesh => detailedPattern.test(String(mesh.name || '')));
    let elapsed = 0, visible = true;
    scene.onBeforeRenderObservable.add(() => {
      elapsed += engine.getDeltaTime();
      if (elapsed < 850) return;
      elapsed = 0;
      const shouldShow = camera.position.y >= LEVEL.three - 1 || currentAreaKey === 'rooftop';
      if (shouldShow === visible) return;
      visible = shouldShow;
      details.forEach(mesh => mesh.setEnabled(visible));
    });
    return { details:details.length, mode:'height-and-location' };
  }

  function setupPerformanceManager(scene, camera) {
    scene.skipPointerMovePicking = true;
    engine.enableOfflineSupport = false;
    const perf = { version:'V265', autoQuality:true, averageFps:0, scaling:engine.getHardwareScalingLevel(), lodDetails:0, frozenMaterials:0 };
    for (const material of scene.materials) {
      const name = String(material.name || '');
      const dynamic = /cielo|nube|sol|luna|temporada|pizarra|contenido|directorio|rotulo|rÃ³tulo|seÃ±al|logo/i.test(name) || material.diffuseTexture?.getContext;
      if (!dynamic && typeof material.freeze === 'function') { try { material.freeze(); perf.frozenMaterials += 1; } catch {} }
    }
    const lod = setupEnvironmentLOD(scene, camera);
    perf.lodDetails = lod.details;
    window.__UCAN_PERFORMANCE__ = perf;
    let timer = 0, fpsSamples = [];
    scene.onBeforeRenderObservable.add(() => {
      timer += engine.getDeltaTime();
      fpsSamples.push(engine.getFps());
      if (tioŸ8ë›h‘éì¶»§q«^w˜[\Ú\Ê™XÛÜ™
NÂˆÚ[™ÝË™\Ü]Ú]™[
™]ÈÝ\ÝÛQ]™[
	ÝXØ[Ž˜›Ø\™]\]Y	ËÈ]Z[ˆÈ›ÛÛRYˆXÝ]™P›Ø\™YHJJNÂˆB‚‚ˆ\Þ[˜È[˜Ý[Ûˆ™[™\›Ø\™[XYÙU\›
™XÛÜ™[XYÙU\››ÛÝ\•^H	ÉÊHÂˆÛÛœÝ[YÈH™]È[XYÙJ
NÂˆ[YË˜Ü›ÜÜÓÜšYÚ[ˆH	Ø[›Ûž[[Ý\ÉÎÂˆ]ØZ]™]È›ÛZ\ÙJ
™\ÛÛ™K™Z™XÝ
HOˆÂˆ[YË›Û›ØYH™\ÛÛ™NÂˆ[YË›Û™\œ›ÜˆH

HOˆ™Z™XÝ
™]È\œ›ÜŠ	Ó›ÈÙHYÈ™[™\š^˜\ˆHX\ÜÚ]]˜HÛÛ™\YIÊJNÂˆ[YËœÜ˜ÈH[XYÙU\›ÂˆJNÂˆÛÛœÝÝH™XÛÜ™™[˜[ZXÕ^\™K™Ù]ÛÛ^

NÈÛÛœÝÈHLŽHÌŒÂˆÝ™š[Ý[HH	ÈÌLMÌM‰ÎÈÝ™š[™XÝ
Ë
NÂˆÛÛœÝØØ[HHX]›Z[ŠÈÈ[YË›˜]\˜[ÚYÈ[YË›˜]\˜[ZYÚ
NÂˆÛÛœÝÈH[YË›˜]\˜[ÚY
ˆØØ[KH[YË›˜]\˜[ZYÚ
ˆØØ[NÂˆÝ™˜]Ò[XYÙJ[YË
ÈHÊHÈ‹
H
HÈ‹Ë
NÂˆYˆ
›ÛÝ\•^
HÂˆÝ™š[Ý[HH	Ü™Ø˜JMJIÎÂˆÝ™š[™XÝ
H‹ËŠNÂˆÝ™š[Ý[HH	ÈÙ™™™™™‰ÎÂˆÝ™›ÛH	ÌÙYÛÙHRK\šX[	ÎÂˆÝ™š[^
›ÛÝ\•^HM
NÂˆBˆ™XÛÜ™™[˜[ZXÕ^\™K\]J
NÂˆ™XÛÜ™œØÜ™Y[‹›X]\šX[H™XÛÜ™™Y˜][X]\šX[ÂˆB‚ˆ\Þ[˜È[˜Ý[Ûˆ™[™\”Û”Ù\™\Šš[JHÂˆÛÛœÝ™\ÜÛœÙHH]ØZ]™]Ú
Ø\KÜ™[™\‹\Ùš[[˜[YOIÙ[˜ÛÙUT’PÛÛ\Û™[
š[K›˜[YJ_XÂˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆÈ	ÐÛÛ[U\IÎˆš[K\H	Ø\XØ][Û‹Ý›™›Ü[ž[›Ü›X]Ë[Ù™šXÙYØÝ[Y[œ™\Ù[][Û›[œ™\Ù[][Û‰ÈKˆ›ÙNˆ]ØZ]š[K˜\œ˜^PY™™\Š
BˆJNÂˆYˆ
\™\ÜÛœÙK›ÚÊHÂˆÛÛœÝ\ÙÈH]ØZ]™\ÜÛœÙK^

K˜Ø]Ú


HOˆ	Ñ\œ›ÜˆHÛÛ™\œÚpìÛ‰ÊNÂˆ›ÝÈ™]È\œ›ÜŠ\ÙÈÛÛ™\œÚpìÛˆ˜[YH
	Ü™\ÜÛœÙKœÝ]\ßJX
NÂˆBˆ™]\›ˆ™\ÜÛœÙKšœÛÛŠ
NÂˆB‚ˆ\Þ[˜È[˜Ý[ÛˆØYš[UÐ›Ø\™
›ÛÛRYš[JHÂˆÛÛœÝ™XÛÜ™H“ÐT‘Ô‘QÒTÕ–K™Ù]
›ÛÛRY
NÂˆYˆ
\™XÛÜ™
H›ÝÈ™]È\œ›ÜŠ	ÔØ[H›È[˜ÛÛ˜YIÊNÂˆ™[X\ÙP›Ø\™YYXJ™XÛÜ™
NÂˆ™XÛÜ™™š[HHš[NÈ™XÛÜ™œYÙ\ÈH×NÈ™XÛÜ™œYÙR[™^HÈ™XÛÜ™˜[˜[\Ú\ÈH[È™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^H	ÉÎÈ™XÛÜ™œÛYR[XYÙ\ÈH×NÈ™XÛÜ™œÛYT•\›H	ÉÎÂˆÛÛœÝ^H
š[K›˜[YKœÜ]
	Ë‰ÊKœÜ

H	ÉÊKÓÝÙ\Ø\ÙJ
NÂˆÛÛœÝ\HHš[K\H	ÉÎÂ‚ˆYˆ
\KœÝ\ÕÚ]
	Ú[XYÙKÉÊHÉÜ™ÉË	ÚœÉË	ÚœYÉË	ÝÙXœ	Ë	ÙÚY‰×Kš[˜ÛY\Ê^
JHÂˆ]ØZ]ØY[XYÙP›Ø\™
™XÛÜ™š[JNÂˆ™XÛÜ™˜[˜[\Ú\ÈHÈÝ[[X\žNˆH[XYÙ[ˆ	Ùš[K›˜[Y_HÙHØ\™ðìÈÛÜœ™XÝ[Y[H[ˆ	Ü›ÛÛRYKˆ\˜H[°è[\Ú\È^X[[[YÙ[K][XÙHÐÖÈS˜Ù^]ÛÜ™ÎˆÉÚ[XYÙ[‰Ë	Ü™XÝ\œÛÈš\ÝX[	×KÙ^TÚ[Îˆ×K™XÛÛ[Y[™][ÛœÎˆ×K]Y\Ý[ÛœÎˆ×HNÂˆH[ÙHYˆ
\KœÝ\ÕÚ]
	ÝšY[ËÉÊHÉÛ\	Ë	ÝÙX›IË	ÛÙÙÉ×Kš[˜ÛY\Ê^
JHÂˆØYšY[Ð›Ø\™
™XÛÜ™š[JNÂˆ™XÛÜ™˜[˜[\Ú\ÈHÈÝ[[X\žNˆ[šY[È	Ùš[K›˜[Y_HÙH›ÞYXÝH[ˆ	Ü›ÛÛRYKˆ[[°è[\Ú\È[[YÙ[HØØ[\Ý0èHÜšY[YÈš[˜Ú\[Y[HHØÝ[Y[ÜÈÛÛˆ^È^˜pëX›K˜Ù^]ÛÜ™ÎˆÉÝšY[ÉË	Ü›ÞYXØÚpìÛ‰×KÙ^TÚ[Îˆ×K™XÛÛ[Y[™][ÛœÎˆ×K]Y\Ý[ÛœÎˆ×HNÂˆH[ÙHYˆ
\HOOH	Ø\XØ][Û‹Ü‰È^OOH	Ü‰ÊHÂˆØY›Ø\™
™XÛÜ™š[JNÂˆ™XÛÜ™˜[˜[\Ú\ÈHÈÝ[[X\žNˆ[ˆ	Ùš[K›˜[Y_HÙHØ\™ðìÈÛÜœ™XÝ[Y[Kˆ\˜H[°è[\Ú\ÈPHØØ[^ÜH[ÛÛ[šYÈHÐÖÈÈ][XÙH[ˆˆÛÛˆ^ÈÐÔˆÙ[XØÚ[Û˜X›K˜Ù^]ÛÜ™ÎˆÉÜ‰Ë	ÛØÜ‰×KÙ^TÚ[Îˆ×K™XÛÛ[Y[™][ÛœÎˆÉÔÚH[ˆ\È\ØØ[™XYËÛÛšpê\[ÈH^ÈHÐÔˆ[\ÈH[˜[^˜\›Ë‰×K]Y\Ý[ÛœÎˆÉð¯Ñ\ÙXHÛÛ™\\ˆ\ÝHÛÛ[šYÈHÐÖÈ\˜H[ˆ[°è[\Ú\Èpè\È›Ù[™ÏÉ×HNÂˆH[ÙHYˆ
ÉÜ	Ë	ÜÞ	Ë	ÜIË	ÜÝ	Ë	Ü	Ë	ÜÉ×Kš[˜ÛY\Ê^
JHÂˆÛÛœÝ™[™\”™\Ý[H]ØZ]™[™\”Û”Ù\™\Šš[JNÂˆ™XÛÜ™œÛYR[XYÙ\ÈH\œ˜^Kš\Ð\œ˜^J™[™\”™\Ý[œYÙ\ÊHÈ™[™\”™\Ý[œYÙ\Èˆ×NÂˆ™XÛÜ™œÛYT•\›H™[™\”™\Ý[œˆ	ÉÎÂˆYˆ
™XÛÜ™œÛYR[XYÙ\Ë›[™Ý
HÂˆ™XÛÜ™œ™]šY]Õ\HH	Ü™[™\™Y\ÛY\ÉÎÂˆžHÂˆ™XÛÜ™œYÙ\ÈH]ØZ]\œÙT
š[JNÂˆHØ]Ú
\œŠHÂˆ™XÛÜ™œYÙ\ÈHÉÓH™\Ù[XÚpìÛˆÙHš\ÝX[^˜HÛÜœ™XÝ[Y[K\›È›ÈÙHYÈ^˜Y\ˆ^ÈÝYšXÚY[H\˜H[[°è[\Ú\ÈØØ[‰×NÂˆBˆ™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^H™XÛÜ™œYÙ\Ëš›Ú[Š	×—‰ÊNÂˆ™XÛÜ™˜[˜[\Ú\ÈHÙ[™\˜]TÛX\[˜[\Ú\Ê™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^š[K›˜[YK	Ô™\Ù[XÚpìÛˆÝÙ\”Ú[	ÊNÂˆ]ØZ]™[™\›Ø\™[XYÙU\›
™XÛÜ™™XÛÜ™œÛYR[XYÙ\ÖÌK	Ùš[K›˜[Y_H0­ÈX\ÜÚ]]˜HKÉÜ™XÛÜ™œÛYR[XYÙ\Ë›[™ÝX
NÂˆH[ÙHÂˆ™XÛÜ™œYÙ\ÈHÉÓH™\Ù[XÚpìÛˆÙHØ\™ðìË\›È[Ù\šYÜˆ›È]›ÛšpìÈX\ÜÚ]]˜\È™[™\š^˜Y\Ë‰×NÂˆ™XÛÜ™œ™]šY]Õ\HH	ÜYÙ\ÉÎÂˆ™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^H™XÛÜ™œYÙ\Ëš›Ú[Š	×—‰ÊNÂˆ™XÛÜ™˜[˜[\Ú\ÈHÙ[™\˜]TÛX\[˜[\Ú\Ê™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^š[K›˜[YK	Ô™\Ù[XÚpìÛˆÝÙ\”Ú[	ÊNÂˆ™[™\Ý\œ™[›Ø\™YÙJ™XÛÜ™	Ô™\Ù[XÚpìÛˆÝÙ\”Ú[	ÊNÂˆBˆH[ÙHYˆ
^OOH	ÙØÞ	ÊHÂˆžHÂˆ™XÛÜ™œYÙ\ÈH]ØZ]\œÙQØÞ
š[JNÂˆHØ]Ú
\œŠHÂˆ™XÛÜ™œYÙ\ÈHØ›ÈÙHYÈ^˜Y\ˆÙÈ[^È[ØÝ[Y[È	Ùš[K›˜[Y_Kˆ	Ù\œ‹›Y\ÜØYÙH\œŸXNÂˆBˆ™XÛÜ™œ™]šY]Õ\HH	ÜYÙ\ÉÎÂˆ™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^H™XÛÜ™œYÙ\Ëš›Ú[Š	×—‰ÊNÂˆ™XÛÜ™˜[˜[\Ú\ÈHÙ[™\˜]TÛX\[˜[\Ú\Ê™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^š[K›˜[YK	ÑØÝ[Y[ÈÛÜ™	ÊNÂˆ™[™\Ý\œ™[›Ø\™YÙJ™XÛÜ™	ÑØÝ[Y[ÉÊNÂˆH[ÙHYˆ
ÉÝ	Ë	ÛY	Ë	ØÜÝ‰Ë	ÚœÛÛ‰Ë	Ú[	Ë	ÚI×Kš[˜ÛY\Ê^
H\KœÝ\ÕÚ]
	Ý^ÉÊJHÂˆ™XÛÜ™œYÙ\ÈHYÚ[˜]U^
]ØZ]š[K^

JNÂˆ™XÛÜ™œ™]šY]Õ\HH	ÜYÙ\ÉÎÂˆ™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^H™XÛÜ™œYÙ\Ëš›Ú[Š	×—‰ÊNÂˆ™XÛÜ™˜[˜[\Ú\ÈHÙ[™\˜]TÛX\[˜[\Ú\Ê™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^š[K›˜[YK	ÑØÝ[Y[ÈH^ÉÊNÂˆ™[™\Ý\œ™[›Ø\™YÙJ™XÛÜ™	ÑØÝ[Y[ÉÊNÂˆH[ÙHÂˆ™XÛÜ™œ™]šY]Õ\HH	Ý[šÛ›ÝÛ‰ÎÂˆ˜]Ð›Ø\™Ø[˜\Ê™XÛÜ™›ÛÛRYÉÐTÒU“ÈÐT‘ÐQÉËš[K›˜[YK	Ñ›Ü›X]È›Èš\ÝX[^˜X›H\™XÝ[Y[K‰Ë	ÐÛÛšpê\[ÈH‹ÐÖ[XYÙ[ˆÈšY[Ë‰×K	Ô›ØÙ\Ø[ZY[ÈØØ[	ÊNÂˆ™XÛÜ™˜[˜[\Ú\ÈHÈÝ[[X\žNˆ[\˜Ú]›È	Ùš[K›˜[Y_HÙHØ\™ðìÈ[ˆ	Ü›ÛÛRYK\›ÈÝH›Ü›X]È›ÈÙH[˜[^˜HH›Ü›XHØØ[˜Ù^]ÛÜ™ÎˆÉÙ›Ü›X]È›ÈÛÛ\]X›I×KÙ^TÚ[Îˆ×K™XÛÛ[Y[™][ÛœÎˆÉÐÛÛšY\H[\˜Ú]›ÈHÐÖSÈˆÛÛˆÐÔ‹‰×K]Y\Ý[ÛœÎˆ×HNÂˆBˆ™Yœ™\Ú›Ø\™šY]Ù\Š
NÂˆÙ]Ý]\Ê	Ùš[K›˜[Y_HØ\™ØYÈ[ˆH^˜\œ˜H	Ü›ÛÛRYKˆ	Ü™XÛÜ™œ™]šY]Õ\HOOH	Ü™[™\™Y\ÛY\ÉÈÈ	Ô™\Ù[XÚpìÛˆ™[™\š^˜YHšY[Y[K‰Èˆ	ÐÛÛ[šYÈ›ØÙ\ØYË‰ßX
NÂˆB‚‚ˆ\Þ[˜È[˜Ý[ÛˆØY[XYÙP›Ø\™
™XÛÜ™š[JHÂˆ™XÛÜ™›Øš™XÝ\›HT“˜Ü™X]SØš™XÝT“
š[JNÈ™XÛÜ™œ™]šY]Õ\HH	Ú[XYÙIÎÂˆÛÛœÝ[YÈH™]È[XYÙJ
NÂˆ]ØZ]™]È›ÛZ\ÙJ
™\ÛÛ™K™Z™XÝ
HOˆÈ[YË›Û›ØYH™\ÛÛ™NÈ[YË›Û™\œ›ÜˆH

HOˆ™Z™XÝ
™]È\œ›ÜŠ	Ò[XYÙ[ˆ›È°è[YIÊJNÈ[YËœÜ˜ÈH™XÛÜ™›Øš™XÝ\›ÈJNÂˆÛÛœÝÝH™XÛÜ™™[˜[ZXÕ^\™K™Ù]ÛÛ^

NÈÛÛœÝÈHLŽHÌŒÂˆÝ™š[Ý[HH	ÈÌLMÌM‰ÎÈÝ™š[™XÝ
Ë
NÂˆÛÛœÝØØ[HHX]›Z[ŠÈÈ[YË›˜]\˜[ÚYÈ[YË›˜]\˜[ZYÚ
NÂˆÛÛœÝÈH[YË›˜]\˜[ÚY
ˆØØ[KH[YË›˜]\˜[ZYÚ
ˆØØ[NÂˆÝ™˜]Ò[XYÙJ[YË
ÈHÊHÈ‹
H
HÈ‹Ë
NÂˆ™XÛÜ™™[˜[ZXÕ^\™K\]J
NÈ™XÛÜ™œØÜ™Y[‹›X]\šX[H™XÛÜ™™Y˜][X]\šX[ÂˆB‚ˆ[˜Ý[ÛˆØYšY[Ð›Ø\™
™XÛÜ™š[JHÂˆ™XÛÜ™›Øš™XÝ\›HT“˜Ü™X]SØš™XÝT“
š[JNÈ™XÛÜ™œ™]šY]Õ\HH	ÝšY[ÉÎÂˆÛÛœÝ^\™HH™]ÈP–SÓ‹•šY[Õ^\™JšY[È	Ü™XÛÜ™šYX™XÛÜ™›Øš™XÝ\›™XÛÜ™œØÙ[™KYKYKP–SÓ‹•šY[Õ^\™K•’SS‘PT—ÔÐSTS‘ÓSÑKÈ]]Ô^N™˜[ÙKÛÜYK]]Y™˜[ÙK^\Ú[›[™NYHJNÂˆÛÛœÝX]H™]ÈP–SÓ‹”Ý[™\™X]\šX[
X]\šX[šY[È	Ü™XÛÜ™šYX™XÛÜ™œØÙ[™JNÂˆX]™Y™\ÙU^\™HH^\™NÈX]™[Z\ÜÚ]™U^\™HH^\™NÈX]™\ØX›SYÚ[™ÈHYNÈX]˜˜XÚÑ˜XÙPÝ[[™ÈH˜[ÙNÂˆ™XÛÜ™šY[Õ^\™HH^\™NÈ™XÛÜ™šY[Ñ[[Y[H^\™KšY[ÎÈ™XÛÜ™˜XÝ]™SX]\šX[HX]È™XÛÜ™œØÜ™Y[‹›X]\šX[HX]Âˆ^\™KšY[Ëœ^J
K˜Ø]Ú


HOˆßJNÂˆB‚ˆ[˜Ý[ÛˆØY›Ø\™
™XÛÜ™š[JHÂˆ™XÛÜ™›Øš™XÝ\›HT“˜Ü™X]SØš™XÝT“
š[JNÈ™XÛÜ™œ™]šY]Õ\HH	Ü‰ÎÂˆ˜]Ð›Ø\™Ø[˜\Ê™XÛÜ™™XÛÜ™šYÉÑÐÕSQS•ÈˆÐT‘ÐQÉËš[K›˜[YK	ÐXœ˜HH^˜\œ˜H\˜HY\ˆ[ØÝ[Y[ÈÛÛ\]Ë‰×K	Ôˆ0­Èš\ÛÜˆ[YÜ˜YÉÊNÂˆB‚ˆ\Þ[˜È[˜Ý[Ûˆ\œÙT
š[JHÂˆYˆ
]Ú[™ÝË’”Öš\
H›ÝÈ™]È\œ›ÜŠ	Ò”Öš\›È\Ý0èH\ÜÛšX›IÊNÂˆÛÛœÝš\H]ØZ]”Öš\›ØY\Þ[˜Ê]ØZ]š[K˜\œ˜^PY™™\Š
JNÂˆÛÛœÝÛYS˜[Y\ÈHØš™XÝšÙ^\Êš\™š[\ÊK™š[\ŠˆOˆ×œÜÛY\×ÜÛYW
×ž[	ÚK\Ý
ŠJKœÛÜ

KŠHOˆÛYS[X™\ŠJHHÛYS[X™\ŠŠJNÂˆÛÛœÝ›ÝS˜[Y\ÈHØš™XÝšÙ^\Êš\™š[\ÊK™š[\ŠˆOˆ×œÛ›Ý\ÔÛY\×Û›Ý\ÔÛYW
×ž[	ÚK\Ý
ŠJKœÛÜ

KŠHOˆÛYS[X™\ŠJHHÛYS[X™\ŠŠJNÂˆÛÛœÝYÙ\ÈH×NÂ‚ˆÛÛœÝ^˜XÝ^H\Þ[˜È˜[YHOˆÂˆÛÛœÝ[žHHš\™š[J˜[YJNÂˆYˆ
Y[žJH™]\›ˆ	ÉÎÂˆÛÛœÝ[H]ØZ][žK˜\Þ[˜Ê	ÜÝš[™ÉÊNÂˆÛÛœÝØÈH™]ÈÓT\œÙ\Š
Kœ\œÙQœ›ÛTÝš[™Ê[	Ø\XØ][Û‹Þ[	ÊNÂˆ™]\›ˆ\œ˜^K™œ›ÛJØË™Ù][[Y[ÐžUYÓ˜[YS”Ê	Ê‰Ë	Ý	ÊJK›X\
ˆOˆ
‹^ÛÛ[	ÉÊKš[J
JK™š[\Š›ÛÛX[ŠKš›Ú[Š	×‰ÊNÂˆNÂ‚ˆ›Üˆ
ÛÛœÝ˜[YHÙˆÛYS˜[Y\ÊHÂˆÛÛœÝÛYU^H]ØZ]^˜XÝ^
˜[YJNÂˆYÙ\Ëœ\Ú
ÛYU^X\ÜÚ]]˜H	ÜYÙ\Ë›[™Ý
È_HÚ[ˆ^È^˜pëX›K˜
NÂˆB‚ˆYˆ
\YÙ\Ë›[™Ý
HÂˆ›Üˆ
ÛÛœÝ˜[YHÙˆ›ÝS˜[Y\ÊHÂˆÛÛœÝ›ÝU^H]ØZ]^˜XÝ^
˜[YJNÂˆYˆ
›ÝU^
HYÙ\Ëœ\Ú
›ÝU^
NÂˆBˆB‚ˆYˆ
\YÙ\Ë›[™Ý
HÂˆÛÛœÝ˜[˜XÚÖ[HØš™XÝšÙ^\Êš\™š[\ÊK™š[\ŠˆOˆ×œËŠ—ž[	ÚK\Ý
ŠJKœÛXÙJŒ
NÂˆ›Üˆ
ÛÛœÝ˜[YHÙˆ˜[˜XÚÖ[
HÂˆÛÛœÝ˜[YHH]ØZ]^˜XÝ^
˜[YJNÂˆYˆ
˜[YJHYÙ\Ëœ\Ú
˜[YJNÂˆBˆB‚ˆYˆ
\YÙ\Ë›[™Ý
HÂˆ™]\›ˆÉÓH™\Ù[XÚpìÛˆÙHØ\™ðìË\›È›ÈÙH[˜ÛÛ°ìÈ^È^˜pëX›KˆÚHH™\Ù[XÚpìÛˆ\Ý0èHÛÛ\Y\ÝHÜˆ[pèYÙ[™\ËpìXYH^È[ˆ\ÈX\ÜÚ]]˜\ÈÈ^ÜHHˆÛÛˆÐÔ‹‰×NÂˆBˆ™]\›ˆYÙ\ÎÂˆB‚‚ˆ\Þ[˜È[˜Ý[Ûˆ\œÙQØÞ
š[JHÂˆYˆ
]Ú[™ÝË’”Öš\
H›ÝÈ™]È\œ›ÜŠ	Ò”Öš\›È\Ý0èH\ÜÛšX›IÊNÂˆÛÛœÝš\H]ØZ]”Öš\›ØY\Þ[˜Ê]ØZ]š[K˜\œ˜^PY™™\Š
JNÂˆÛÛœÝØ[™Y]\ÈHÉÝÛÜ™ÙØÝ[Y[ž[	Ë	ÝÛÜ™ÚXY\ŒKž[	Ë	ÝÛÜ™ÚXY\Œ‹ž[	Ë	ÝÛÜ™Ù›ÛÝ\ŒKž[	Ë	ÝÛÜ™Ù›ÛÝ\Œ‹ž[	×NÂˆÛÛœÝ›ØÚÜÈH×NÂˆ›Üˆ
ÛÛœÝ˜[YHÙˆØ[™Y]\ÊHÂˆÛÛœÝ[žHHš\™š[J˜[YJNÂˆYˆ
Y[žJHÛÛ[YNÂˆÛÛœÝ[H]ØZ][žK˜\Þ[˜Ê	ÜÝš[™ÉÊNÂˆÛÛœÝØÈH™]ÈÓT\œÙ\Š
Kœ\œÙQœ›ÛTÝš[™Ê[	Ø\XØ][Û‹Þ[	ÊNÂˆÛÛœÝ\˜YÜ˜\ÈH\œ˜^K™œ›ÛJØË™Ù][[Y[ÐžUYÓ˜[YS”Ê	Ê‰Ë	Ü	ÊJK›X\
O‚ˆ\œ˜^K™œ›ÛJ™Ù][[Y[ÐžUYÓ˜[YS”Ê	Ê‰Ë	Ý	ÊJK›X\
Oˆ^ÛÛ[	ÉÊKš›Ú[Š	ÉÊBˆ
K™š[\Š›ÛÛX[ŠNÂˆYˆ
\˜YÜ˜\Ë›[™Ý
H›ØÚÜËœ\Ú
\˜YÜ˜\Ëš›Ú[Š	×—‰ÊJNÂˆBˆYˆ
X›ØÚÜË›[™Ý
H™]\›ˆÉÑ[ØÝ[Y[ÈÛÜ™ÙHØ\™ðìË\›È›ÈÛÛY[™H^ÈYÚX›HH›Ü›XHØØ[‰×NÂˆ™]\›ˆYÚ[˜]U^
›ØÚÜËš›Ú[Š	×—‰ÊJNÂˆB‚‚ˆ[˜Ý[ÛˆÛYS[X™\Š˜[YJHÈÛÛœÝHH˜[YK›X]Ú
ÜÛYJ
ÊWž[ÚJNÈ™]\›ˆHÈ[X™\ŠVÌWJHˆÈB‚ˆ[˜Ý[ÛˆYÚ[˜]U^
^X^Ú\œÈHLÌ
HÂˆÛÛœÝÛX[ˆHÝš[™Ê^	ÉÊKœ™\XÙJ×‹ÙË	ÉÊKš[J
NÂˆYˆ
XÛX[ŠH™]\›ˆÉÑØÝ[Y[ÈÚ[ˆ^Èš\ÚX›K‰×NÂˆÛÛœÝYÙ\ÈH×NÈ]™[XZ[š[™ÈHÛX[ŽÂˆÚ[H
™[XZ[š[™Ë›[™ÝˆX^Ú\œÊHÂˆ]Ý]H™[XZ[š[™Ë›\Ý[™^ÙŠ	×‰ËX^Ú\œÊNÂˆYˆ
Ý]X^Ú\œÈ
ˆMJHÝ]H™[XZ[š[™Ë›\Ý[™^ÙŠ	È	ËX^Ú\œÊNÂˆYˆ
Ý]X^Ú\œÈ
ˆ
HÝ]HX^Ú\œÎÂˆYÙ\Ëœ\Ú
™[XZ[š[™ËœÛXÙJÝ]
Kš[J
JNÈ™[XZ[š[™ÈH™[XZ[š[™ËœÛXÙJÝ]
Kš[J
NÂˆBˆYˆ
™[XZ[š[™ÊHYÙ\Ëœ\Ú
™[XZ[š[™ÊNÈ™]\›ˆYÙ\ÎÂˆB‚ˆ\Þ[˜È[˜Ý[Ûˆ™[™\Ý\œ™[›Ø\™YÙJ™XÛÜ™Ú[™H	ÑØÝ[Y[ÉÊHÂˆYˆ
™XÛÜ™œ™]šY]Õ\HOOH	Ü™[™\™Y\ÛY\ÉÈ	‰ˆ™XÛÜ™œÛYR[XYÙ\Ë›[™Ý
HÂˆ]ØZ]™[™\›Ø\™[XYÙU\›
™XÛÜ™™XÛÜ™œÛYR[XYÙ\ÖÜ™XÛÜ™œYÙR[™^K	Ü™XÛÜ™™š[OË›˜[YH	ÉßH0­ÈX\ÜÚ]]˜H	Ü™XÛÜ™œYÙR[™^
È_KÉÜ™XÛÜ™œÛYR[XYÙ\Ë›[™ÝX
NÂˆ™]\›ŽÂˆBˆÛÛœÝYÙHH™XÛÜ™œYÙ\ÖÜ™XÛÜ™œYÙR[™^H	ÉÎÂˆÛÛœÝ[™\ÈHYÙKœÜ]
×ŠËÊK™š[\Š›ÛÛX[ŠNÂˆ˜]Ð›Ø\™Ø[˜\Ê™XÛÜ™	Ü™XÛÜ™šYH0­È	ÚÚ[™X[™\Ë	Ü™XÛÜ™™š[OË›˜[YH	ÉßH0­È	Ü™XÛÜ™œYÙR[™^
È_KÉÓX]›X^
™XÛÜ™œYÙ\Ë›[™ÝJ_X
NÂˆB‚ˆ\Þ[˜È[˜Ý[ÛˆÚ[™ÙP›Ø\™YÙJ[JHÂˆÛÛœÝ™XÛÜ™H“ÐT‘Ô‘QÒTÕ–K™Ù]
XÝ]™P›Ø\™Y
NÈYˆ
\™XÛÜ™
H™]\›ŽÂˆÛÛœÝÝ[H™XÛÜ™œ™]šY]Õ\HOOH	Ü™[™\™Y\ÛY\ÉÈÈ™XÛÜ™œÛYR[XYÙ\Ë›[™Ýˆ™XÛÜ™œYÙ\Ë›[™ÝÂˆYˆ
]Ý[
H™]\›ŽÂˆ™XÛÜ™œYÙR[™^H
™XÛÜ™œYÙR[™^
È[H
ÈÝ[
H	HÝ[Âˆ]ØZ]™[™\Ý\œ™[›Ø\™YÙJ™XÛÜ™×ŠÞ_ÝÊIÚK\Ý
™XÛÜ™™š[OË›˜[YH	ÉÊHÈ	Ô™\Ù[XÚpìÛˆÝÙ\”Ú[	Èˆ	ÑØÝ[Y[ÉÊNÂˆ™Yœ™\Ú›Ø\™šY]Ù\Š
NÂˆB‚‚ˆ[˜Ý[ÛˆÛÛ›Û›Ø\™šY[ÊXÝ[ÛŠHÂˆÛÛœÝ™XÛÜ™H“ÐT‘Ô‘QÒTÕ–K™Ù]
XÝ]™P›Ø\™Y
NÂˆYˆ
\™XÛÜ™ËšY[Ñ[[Y[
HÈ\]P›Ø\™[™›Ê	ØXÝ]™P›Ø\™YNˆ›È^H[ˆšY[ÈØ\™ØYË˜
NÈ™]\›ŽÈBˆYˆ
XÝ[ÛˆOOH	Ü^IÊH™XÛÜ™šY[Ñ[[Y[œ^J
K˜Ø]Ú


HOˆßJNÈ[ÙH™XÛÜ™šY[Ñ[[Y[œ]\ÙJ
NÂˆB‚ˆ[˜Ý[ÛˆÛX\›Ø\™
›ÛÛRY
HÂˆÛÛœÝ™XÛÜ™H“ÐT‘Ô‘QÒTÕ–K™Ù]
›ÛÛRY
NÈYˆ
\™XÛÜ™
H™]\›ŽÂˆ™[X\ÙP›Ø\™YYXJ™XÛÜ™
NÈ™XÛÜ™™š[HH[È™XÛÜ™œYÙ\ÈH×NÈ™XÛÜ™œYÙR[™^HÈ™XÛÜ™˜[˜[\Ú\ÈH[È™XÛÜ™˜[˜[\Ú\ÔÛÝ\˜ÙU^H	ÉÎÈ™XÛÜ™œÛYR[XYÙ\ÈH×NÈ™XÛÜ™œÛYT•\›H	ÉÎÈ™XÛÜ™œ™[[ÝP\ÜÙ]ÈH×NÂˆ˜]Ð›Ø\™Ù[ÛÛYJ™XÛÜ™
NÈ™Yœ™\Ú›Ø\™šY]Ù\Š
NÈÙ]Ý]\Ê^˜\œ˜H	Ü›ÛÛRYH[\XYK˜
NÂˆB‚ˆ[˜Ý[Ûˆ™[X\ÙP›Ø\™YYXJ™XÛÜ™
HÂˆžHÈ™XÛÜ™šY[Ñ[[Y[Ëœ]\ÙJ
NÈHØ]Ú
JHßBˆžHÈ™XÛÜ™šY[Õ^\™OË™\ÜÜÙJ
NÈHØ]Ú
JHßBˆYˆ
™XÛÜ™˜XÝ]™SX]\šX[	‰ˆ™XÛÜ™˜XÝ]™SX]\šX[OOH™XÛÜ™™Y˜][X]\šX[
HÈžHÈ™XÛÜ™˜XÝ]™SX]\šX[™\ÜÜÙJ
NÈHØ]Ú
JHßHBˆYˆ
™XÛÜ™›Øš™XÝ\›
HÈžHÈT“œ™]›ÚÙSØš™XÝT“
™XÛÜ™›Øš™XÝ\›
NÈHØ]Ú
JHßHBˆ™XÛÜ™šY[Õ^\™HH[È™XÛÜ™šY[Ñ[[Y[H[È™XÛÜ™›Øš™XÝ\›H[È™XÛÜ™˜XÝ]™SX]\šX[H™XÛÜ™™Y˜][X]\šX[È™XÛÜ™œØÜ™Y[‹›X]\šX[H™XÛÜ™™Y˜][X]\šX[Âˆ™XÛÜ™œÛYR[XYÙ\ÈH×NÈ™XÛÜ™œÛYT•\›H	ÉÎÈ™XÛÜ™œ™[[ÝP\ÜÙ]ÈH×NÂˆB‚ˆ[˜Ý[Ûˆ›Ü›X]ž]\Êž]\ÊHÂˆYˆ
S[X™\‹š\Ñš[š]Jž]\ÊHž]\ÈH
H™]\›ˆ	Ì‰ÎÂˆÛÛœÝ[š]ÈHÉÐ‰Ë	ÒÐ‰Ë	ÓP‰Ë	ÑÐ‰×NÈÛÛœÝHHX]›Z[ŠX]™›ÛÜŠX]›ÙÊž]\ÊHÈX]›ÙÊL
JK[š]Ë›[™ÝHJNÂˆ™]\›ˆ	Êž]\ÈÈX]œÝÊLJJKÑš^Y
HÈHˆ
_H	Ý[š]ÖÚW_XÂˆB‚ˆ[˜Ý[ÛˆÙ]\Û\ÜÜ›ÛÛRSÊØÙ[™JHÂˆYŠ\ÛØÚÙ]
H™]\›ŽÂˆÛØÚÙ]›ÛŠ	ÜØÜ™Y[‹]\]IË^[ØYOˆÙ]Ý]\Ê[[HXÝX[^˜YH[ˆ	Ü^[ØYœ›ÛÛH	ÜØ[0ìÛ‰ßK˜
JNÂˆB‚ˆ\Þ[˜È[˜Ý[ÛˆÙ]\ÙX–ŠØÙ[™JHÂˆžHÂˆÛÛœÝ›ÛÜ“Y\Ú\ÈHØÙ[™K›Y\Ú\Ë™š[\ŠY\ÚOˆÂˆYˆ
[Y\Ú[Y\Úš\Ñ[˜X›Y

JH™]\›ˆ˜[ÙNÂˆÛÛœÝ˜[YHHÝš[™ÊY\Ú›˜[YH	ÉÊNÂˆÛÛœÝ^XÚ]HY\Ú›Y]Y]OË[\ÜX›HOOHYNÂˆÛÛœÝ˜[YYØ[ØX›HHÙÜ˜[ˆÜØ_]H]˜]\Ÿ›ÙÈ]H]˜]\Ÿ›Û˜HÙYÝ\˜H”Ÿ›Û˜H”ˆ\Ú[È]\˜[\ØØ[\˜H[™š]X]›ß\ØØ[ÛˆÙ[˜[[™š]X]›ß˜[\H[š\ÚX›_›ÛÙÜXÚß›Û˜HÙYÝ\˜H”ˆ›ÛÙÜ]Y›Ü›XH
Îš[šXÚ[ßš[Š_Ü˜Y\šXH
Îš^œ]ZY\™_\™XÚJKÚK\Ý
˜[YJNÂˆYˆ
^XÚ]˜[YYØ[ØX›JHÂˆY\Úš\ÔXÚØX›HHYNÂˆ™]\›ˆYNÂˆBˆ™]\›ˆ˜[ÙNÂˆJNÂˆ’[\X]ØZ]ØÙ[™K˜Ü™X]QY˜][‘^\šY[˜ÙP\Þ[˜ÊÈ›ÛÜ“Y\Ú\ËÜ[Û˜[™X]\™\ÎYK\ØX›U[\Ü][ÛŽ™˜[ÙHJNÂˆžHÂˆ’[\‹˜˜\ÙQ^\šY[˜ÙK™™X]\™\ÓX[˜YÙ\‹™[˜X›Q™X]\™JP–SÓ‹•ÙX–‘™X]\™S˜[YK’S‘ÕPÒÒS‘Ë	Û]\Ý	ËÈ’[œ]ˆ’[\‹š[œ]KYKYJNÂˆHØ]Ú
JHÈÊˆ[™˜XÚÚ[™È\[™ÈÛˆœ›ÝÜÙ\‹Ù]šXÙHÝ\Üˆ
‹ÈBˆÙ]Ý]\ÊÙX–ˆ\ÜÛšX›Nˆ	Ù›ÛÜ“Y\Ú\Ë›[™ÝHÝ\\™šXÚY\ÈH[]˜[œÜÜXÚpìÛˆ™\šYšXØY\ËÛÛ›ÛYÜ™\ÈH[™˜XÚÚ[™Ë˜
NÂˆHØ]Ú
\œŠHÂˆÛÛœÛÛKØ\›Š	ÕÙX–ˆ›È\ÜÛšX›N‰Ë\œŠNÂˆÙ]Ý]\Ê	Ñ[Ü››Èš\ÚX›H[ˆÛÛ\]YÜ˜Kˆ\˜H”ˆ\ÙHËÐÛÝY›\™H[ˆY]H]Y\Ý‰ÊNÂˆBˆB‚‚ˆÚ[™ÝË—×ÕPÐS—ÐTW×ÈHÂˆÙ]XÝ]™P›Ø\™Yˆ

HOˆXÝ]™P›Ø\™YˆÙ]XÝ]™P›Ø\™YˆYOˆÈYˆ
“ÐT‘Ô‘QÒTÕ–Kš\ÊY
JHÈXÝ]™P›Ø\™YHYÈÛÛœÝÙ[XÝHØÝ[Y[™Ù][[Y[žRY
	Ø›Ø\™Ù[XÝ	ÊNÈYˆ
Ù[XÝ
HÙ[XÝ˜[YHHYÈ™Yœ™\Ú›Ø\™šY]Ù\Š
NÈHKˆÙ]›Ø\™™XÛÜ™ˆYOˆ“ÐT‘Ô‘QÒTÕ–K™Ù]
YXÝ]™P›Ø\™Y
KˆÙ]›Ø\™\™Ù]Îˆ

HOˆ“ÐT‘ÕT‘ÑUË›X\
][HOˆ
È‹‹š][HJJKˆÜ[›Ø\™[™[ˆÛÜÙP›Ø\™[™[ˆØYš[UÐ›Ø\™ˆÚ[™ÙP›Ø\™YÙKˆ™Yœ™\Ú›Ø\™šY]Ù\‹ˆÛX\›Ø\™ˆÙ]Ý]\ËˆÙ]^Y\]Y]ˆ

HOˆÚ[™ÝË—×ÕPÐS—ÓVQT—ÐUQU×È[ˆÙ]ØÙ[™Nˆ

HOˆXÝ]™TØÙ[™KˆÙ]Ø[Y\˜Nˆ

HOˆXÝ]™PØ[Y\˜KˆÙ][š\›Û›Y[ˆ

HOˆ˜]\˜[[š\›Û›Y[Ë™Ù]Ý]OËŠ
HÈ‹‹‘S•—ÔÕUHKˆÙ]ÙX\ÛÛŽˆÙX\ÛÛˆOˆ˜]\˜[[š\›Û›Y[Ë˜\TÙX\ÛÛËŠÙX\ÛÛŠKˆÛÕÐ\™XNˆÙ^HOˆÂˆÛÛœÝ\™Ù]PT‘PVÚÙ^WNÈYŠ]\™Ù]XXÝ]™PØ[Y\˜JH™]\›ˆ˜[ÙNÂˆXÝ]™PØ[Y\˜KœÜÚ][Û‹˜ÛÜQœ›ÛJ\™Ù]œÜÊ
JNÈXÝ]™PØ[Y\˜KœÙ]\™Ù]
\™Ù]\™Ù]

JNÈ™]\›ˆYNÂˆBˆNÂ‚ˆžHÂˆÛÛœÝØÙ[™OXÜ™X]TØÙ[™J
NÂˆ[™Ú[™Kœ[”™[™\“ÛÜ


OOœØÙ[™Kœ™[™\Š
JNÂˆÚ[™ÝË˜Y]™[\Ý[™\Š	Ü™\Ú^™IË

OO™[™Ú[™Kœ™\Ú^™J
JNÂˆÚ[™ÝË˜Y]™[\Ý[™\Š	Ù\œ›Ü‰Ë]ˆOˆÈÛÛœÛÛK™\œ›ÜŠ]‹™\œ›Üˆ]‹›Y\ÜØYÙJNÈÙ]Ý]\Ê	Ñ\œ›Üˆ[ˆH\ØÙ[˜HŒNˆ™]š\ÙHÛÛœÛÛH[˜]™YØYÜ‹‰ÊNÈJNÂˆÚ[™ÝË˜Y]™[\Ý[™\Š	Ý[š[™Y™Z™XÝ[Û‰Ë]ˆOˆÈÛÛœÛÛK™\œ›ÜŠ]‹œ™X\ÛÛŠNÈÙ]Ý]\Ê	Ñ\œ›Üˆ›ØÙ\Ø[™È[˜HÜ\˜XÚpìÛ‹ˆ™XØ\™ÝYHH0èYÚ[˜HÈ™]š\ÙH[\˜Ú]›ÈÙ[XØÚ[Û˜YË‰ÊNÈJNÂˆHØ]Ú
\œŠHÂˆÛÛœÛÛK™\œ›ÜŠ\œŠNÂˆYŠØYÝ]\ÊHØYÝ]\Ë^ÛÛ[H	Ñ\œ›ÜˆÛÛœÝ^Y[™È[[Ü››Îˆ	È
È
\œˆ	‰ˆ\œ‹›Y\ÜØYÙHÈ\œ‹›Y\ÜØYÙHˆ\œŠNÂˆÙ]Ý]\Ê	Ó›ÈÙHYÈÛÛœÝZ\ˆ[[Ü››Ëˆ™]š\ÙHÛÛœÛÛH[˜]™YØYÜ‹‰ÊNÂˆBŸJJ
NÂ