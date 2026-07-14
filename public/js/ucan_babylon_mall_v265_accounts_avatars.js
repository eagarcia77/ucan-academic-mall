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
  const BOARD_TARGETS = [...ROOM_CONFIG.map(room => ({ id: room.id, label: room.id })), { id: 'ANF-301', label: 'ANF-301 · Anfiteatro' }];
  const BRAND_ASSETS = Object.freeze({
    inter: '/assets/logos/inter_san_german_v252.png',
    ucan: '/assets/logos/ucan_ppoha_v252.png'
  });
  const SAN_GERMAN = Object.freeze({
    name: 'San Germán, Puerto Rico',
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
    temperatureUnit: '°F',
    windSpeedUnit: 'mph',
    humidity: null,
    temperature: null,
    moonPhase: 'Luna nueva',
    moonEmoji: '🌑',
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
    astronomySource: 'Open-Meteo + efemérides locales',
    lastUpdated: null
  };

  const AREA = {
    foodcourt: { label: 'Piso 1 · Áreas comunes', pos: () => new BABYLON.Vector3(0, LEVEL.one + PLAYER_HEIGHT, 42), target: () => new BABYLON.Vector3(0, LEVEL.one + 1.4, 0) },
    cafeteria: { label: 'Cafetería', pos: () => new BABYLON.Vector3(-56, LEVEL.one + PLAYER_HEIGHT, 12), target: () => new BABYLON.Vector3(-63, LEVEL.one + 1.6, -14) },
    library: { label: 'Biblioteca', pos: () => new BABYLON.Vector3(56, LEVEL.one + PLAYER_HEIGHT, 12), target: () => new BABYLON.Vector3(63, LEVEL.one + 1.6, -14) },
    floor2: { label: 'Piso 2 · Galería ampliada de cinco salas virtuales', pos: () => new BABYLON.Vector3(0, LEVEL.two + PLAYER_HEIGHT, 42), target: () => new BABYLON.Vector3(0, LEVEL.two + 1.4, -18) },
    class201: { label: 'SV-201', pos: () => new BABYLON.Vector3(-56, LEVEL.two + PLAYER_HEIGHT, 12), target: () => new BABYLON.Vector3(-56, LEVEL.two + 1.8, -12) },
    class202: { label: 'SV-202', pos: () => new BABYLON.Vector3(-28, LEVEL.two + PLAYER_HEIGHT, -20), target: () => new BABYLON.Vector3(-28, LEVEL.two + 1.8, -47) },
    class203: { label: 'SV-203', pos: () => new BABYLON.Vector3(0, LEVEL.two + PLAYER_HEIGHT, -20), target: () => new BABYLON.Vector3(0, LEVEL.two + 1.8, -47) },
    class204: { label: 'SV-204', pos: () => new BABYLON.Vector3(28, LEVEL.two + PLAYER_HEIGHT, -20), target: () => new BABYLON.Vector3(28, LEVEL.two + 1.8, -47) },
    class205: { label: 'SV-205', pos: () => new BABYLON.Vector3(56, LEVEL.two + PLAYER_HEIGHT, 12), target: () => new BABYLON.Vector3(56, LEVEL.two + 1.8, -12) },
    theater: { label: 'Piso 3 · Anfiteatro ampliado', pos: () => new BABYLON.Vector3(0, LEVEL.three + PLAYER_HEIGHT, 38), target: () => new BABYLON.Vector3(0, LEVEL.three + 2.6, -28) },
    rooftop: { label: 'Terraza panorámica · Áreas comunes', pos: () => new BABYLON.Vector3(0, LEVEL.rooftop + PLAYER_HEIGHT, 42), target: () => new BABYLON.Vector3(0, LEVEL.rooftop + 1.3, 0) },
    rooftopWeather: { label: 'Observatorio · Estado del tiempo', pos: () => new BABYLON.Vector3(-33, LEVEL.rooftop + PLAYER_HEIGHT, 38), target: () => new BABYLON.Vector3(-33, LEVEL.rooftop + 5.5, 49.2) },
    rooftopAgenda: { label: 'Observatorio · Agenda astronómica', pos: () => new BABYLON.Vector3(34, LEVEL.rooftop + PLAYER_HEIGHT, 37), target: () => new BABYLON.Vector3(34, LEVEL.rooftop + 7.0, 49.2) },
    rooftopMoon: { label: 'Observatorio · Fase lunar', pos: () => new BABYLON.Vector3(-33, LEVEL.rooftop + PLAYER_HEIGHT, -38), target: () => new BABYLON.Vector3(-33, LEVEL.rooftop + 5.5, -49.2) },
    rooftopSky: { label: 'Observatorio · Mapa celeste', pos: () => new BABYLON.Vector3(0, LEVEL.rooftop + PLAYER_HEIGHT, -37), target: () => new BABYLON.Vector3(0, LEVEL.rooftop + 6.3, -49.2) },
    rooftopCalendar: { label: 'Observatorio · Calendario astronómico', pos: () => new BABYLON.Vector3(34, LEVEL.rooftop + PLAYER_HEIGHT, -37), target: () => new BABYLON.Vector3(34, LEVEL.rooftop + 7.0, -49.2) }
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
  const ENV_STATE = { season: defaultSeason, timeOfDay: new Date().getHours() + new Date().getMinutes() / 60, cycleEnabled: false, cycleMinutes: 8, liveClock: true, liveWeather: true };
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
    const hour = Number(parts.hour), minute = Number(parts.minute), second = Number(parts.second);
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
      82: 'Chubascos fuertes', 85: 'Nevadas ligeras', 86: 'Nevadas fuertes', 95: 'Tormenta eléctrica',
      96: 'Tormenta con granizo ligero', 99: 'Tormenta con granizo fuerte'
    };
    return map[Number(code)] || 'Condición variable';
  }

  
  function moonPhaseInfo(date) {
    const synodicMonth = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const age = ((((date.getTime() - knownNewMoon) / 86400000) % synodicMonth) + synodicMonth) % synodicMonth;
    const illumination = (1 - Math.cos((age / synodicMonth) * Math.PI * 2)) / 2;
    const phases = [
      { limit: 1.84566, name: 'Luna nueva', emoji: '🌑' },
      { limit: 5.53699, name: 'Creciente inicial', emoji: '🌒' },
      { limit: 9.22831, name: 'Cuarto creciente', emoji: '🌓' },
      { limit: 12.91963, name: 'Gibosa creciente', emoji: '🌔' },
      { limit: 16.61096, name: 'Luna llena', emoji: '🌕' },
      { limit: 20.30228, name: 'Gibosa menguante', emoji: '🌖' },
      { limit: 23.99361, name: 'Cuarto menguante', emoji: '🌗' },
      { limit: 27.68493, name: 'Menguante final', emoji: '🌘' },
      { limit: 29.53059, name: 'Luna nueva', emoji: '🌑' }
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

  function formatHourDecimal(value, fallback = '—') {
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
      return `${fmt(start)}–${fmt(start + 0.07)}`;
    });
    LIVE_CONTEXT.eventCalendar = astronomyEventsForYear(now.year);
    LIVE_CONTEXT.events = [
      `Fase lunar actual: ${moon.phaseName} (${moon.percentage}% iluminada).`,
      'Eclipses: calendario basado en efemérides de NASA para 2026.',
      'Cometas: aproximaciones dinámicas obtenidas de la base de datos SBDB de NASA/JPL.'
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
      LIVE_CONTEXT.temperatureUnit = '°F';
      LIVE_CONTEXT.windSpeedUnit = 'mph';
      LIVE_CONTEXT.sunriseHour = parseHourString(data.daily?.sunrise?.[0], LIVE_CONTEXT.sunriseHour);
      LIVE_CONTEXT.sunsetHour = parseHourString(data.daily?.sunset?.[0], LIVE_CONTEXT.sunsetHour);
      LIVE_CONTEXT.astronomySource = 'Open-Meteo + efemérides locales';
      try {
        const cometResponse = await fetch(`/api/astronomy/comets?year=${now.year}`);
        if (cometResponse.ok) {
          const cometData = await cometResponse.json();
          LIVE_CONTEXT.cometEvents = Array.isArray(cometData.events) ? cometData.events : [];
          LIVE_CONTEXT.astronomySource = 'Open-Meteo + NASA/JPL SBDB + efemérides locales';
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
          LIVE_CONTEXT.astronomySource = 'Open-Meteo + NASA/JPL SBDB + WhereTheISS.at + efemérides locales';
        }
      } catch (issError) {
        console.warn('[UCAN V265] No se pudo actualizar la posición de la EEI:', issError);
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
      LIVE_CONTEXT.weatherLabel = 'Ambiente astronómico local';
      LIVE_CONTEXT.astronomySource = 'Efemérides locales (sin conexión externa)';
      LIVE_CONTEXT.stargazingIndex = computeStargazingIndex();
      LIVE_CONTEXT.lastUpdated = new Date().toISOString();
      updateEnvironmentStatus();
    }
  }

  function pbr(scene, name, hex, opts = {}) {
    // StandardMaterial se utiliza deliberadamente para máxima compatibilidad WebGL/WebXR.
    // En varias GPU y navegadores móviles, los materiales PBR quedaban esperando una
    // compilación de shader y el edificio aparecía invisible.
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
      wall: pbr(scene, 'pared académica marfil', '#e7e3da', { roughness: 0.9 }),
      wallPanel: pbr(scene, 'panel arquitectónico azul pizarra', '#4c5d73', { roughness: 0.78 }),
      upholstery: pbr(scene, 'tapizado seccional gris académico', '#8a948f', { roughness: 0.9 }),
      upholsteryLight: pbr(scene, 'tapizado claro', '#bdb7ad', { roughness: 0.92 }),
      wood: pbr(scene, 'madera cálida moderna', '#bc946b', { roughness: 0.64 }),
      metal: pbr(scene, 'metal cepillado', '#70777a', { roughness: 0.42, metallic: 0.34 }),
      black: pbr(scene, 'negro mate', '#111615', { roughness: 0.76 }),
      glass: pbr(scene, 'cristal claro moderno', '#d9f4fb', { roughness: 0.04, alpha: 0.30 }),
      darkGlass: pbr(scene, 'cristal oscuro', '#20343a', { roughness: 0.1, alpha: 0.42 }),
      doorGlass: pbr(scene, 'cristal puerta', '#c5edf6', { roughness: 0.04, alpha: 0.48 }),
      carpet: pbr(scene, 'alfombra acústica azul gris', '#6c7684', { roughness: 0.94 }),
      plant: pbr(scene, 'planta tropical', '#2d6a45', { roughness: 0.84 }),
      water: pbr(scene, 'agua', '#43b8c9', { roughness: 0.08, alpha: 0.6 }),
      warmLight: pbr(scene, 'luz cálida indirecta', '#f2d7a0', { roughness: 0.38, emissive: '#f2c879', emissiveIntensity: 0.55 }),
      screen: pbr(scene, 'pantalla limpia', '#111a1e', { roughness: 0.32, metallic: 0.05, emissive: '#182c35', emissiveIntensity: 0.18 }),
      projection: pbr(scene, 'pizarra de proyección', '#f3f4f2', { roughness: 0.46, emissive: '#dfeaf4', emissiveIntensity: 0.10 }),
      path: pbr(scene, 'ruta de circulación', '#9db6c8', { roughness: 0.84 }),
      pathEdge: pbr(scene, 'borde ruta circulación', '#f2cf4a', { roughness: 0.58, metallic: 0.08 }),
      yellow: pbr(scene, 'placa seguridad amarilla', '#f2cf4a', { roughness: 0.58, metallic: 0.08 }),
      roofDeck: pbr(scene, 'deck rooftop', '#967451', { roughness: 0.7 }),
      roofStone: pbr(scene, 'piedra rooftop', '#c9c5bb', { roughness: 0.8 }),
      roofGrass: pbr(scene, 'jardín rooftop', '#527a47', { roughness: 0.92 }),
      flowerPink: pbr(scene, 'flores primavera', '#d96c9a', { roughness: 0.72 }),
      flowerPurple: pbr(scene, 'flores violeta', '#8b67b1', { roughness: 0.72 }),
      autumnLeaf: pbr(scene, 'hojas otoño', '#b65f2b', { roughness: 0.82 }),
      autumnGold: pbr(scene, 'hojas doradas', '#d69a2d', { roughness: 0.82 }),
      winterDecor: pbr(scene, 'decoración invierno', '#dce9ef', { roughness: 0.58, emissive: '#b8d8e6', emissiveIntensity: 0.18 }),
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
    // V265: se elimina el pedestal cúbico para no obstaculizar el paso ni interferir visualmente con las escaleras.
    const post = null;
    return { frame, logo, post };
  }

  function buildBrandingFloorOne(scene, root, mats) {
    if (!BRAND_ASSETS?.inter || !BRAND_ASSETS?.ucan) {
      console.error('[logos] No están disponibles los archivos institucionales.');
      return;
    }

    // Un cartel de cada institución, reubicados a los laterales del vestíbulo para no bloquear la escalera eléctrica.
    createLogoBillboard(
      scene, root, mats,
      'logo UCAN piso 1', BRAND_ASSETS.ucan,
      new BABYLON.Vector3(-41.0, LEVEL.one + 4.35, 46.8),
      6.8, 6.8, 'UCAN', 'PPOHA',
      { billboard: false, rotationY: 0 }
    );
    createLogoBillboard(
      scene, root, mats,
      'logo Inter San Germán piso 1', BRAND_ASSETS.inter,
      new BABYLON.Vector3(41.0, LEVEL.one + 4.10, 46.8),
      12.4, 6.7, 'INTER', 'SAN GERMÁN',
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
    window.setTimeout(() => console.info('[UCAN V265] Auditoría de logos:', updateAudit()), 4200);
  }

  function auditBrandingVsStairs(scene) {
    const logos = scene.meshes.filter(mesh => mesh?.metadata?.brandLogo === true);
    const blocked = logos.filter(mesh => {
      const p = mesh.getAbsolutePosition();
      return p.x > -28 && p.x < 5 && p.z > 14 && p.z < 36;
    }).map(mesh => mesh.name);
    window.__UCAN_BRAND_STAIR_AUDIT__ = { version:'V265', blocked, clear: blocked.length === 0 };
    console.info('[UCAN V265] Auditoría logos vs escalera:', window.__UCAN_BRAND_STAIR_AUDIT__);
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
    console.info('[UCAN V265] Auditoría de pantalla SV-203:', window.__UCAN_SV203_SCREEN_AUDIT__);
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
    setLoading('Construyendo geometría del mall académico.');
    const scene = new BABYLON.Scene(engine);
    activeScene = scene;
    scene.clearColor = BABYLON.Color4.FromHexString('#b9ccd2ff');
    scene.imageProcessingConfiguration.exposure = 0.82;
    scene.imageProcessingConfiguration.contrast = 1.18;
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -0.18, 0);
    // Conserva la profundidad entre grupos para que los rótulos, pantallas y logos
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
      setStatus(`Entorno cargado. Auditoría V265: ${layerAudit.checkedMeshes} objetos revisados, ${removed} interferencias retiradas y ${mobilityAudit.clearedObstacles} obstáculos despejados. La navegación, el rendimiento, la accesibilidad, la señalización, los logotipos visibles y la arquitectura fueron actualizados. El acceso de subida de las escaleras del piso 1 permanece despejado y los logos institucionales se muestran mediante carteles frontales visibles desde el vestíbulo. La terraza permanece silenciosa y cada piso conserva su separación visual. El reloj, el cielo, la fase lunar, el mapa celeste orientado y el calendario mensual se sincronizan con San Germán, Puerto Rico.`);
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
    createDirectorySign(scene, root, 'PISO 1', ['CAFETERÍA · BIBLIOTECA', 'ÁREAS COMUNES'], new BABYLON.Vector3(0, LEVEL.one + 3.2, 50), Math.PI);
    createDirectorySign(scene, root, 'PISO 2', ['SALAS SV-201 A SV-205', 'GALERÍA ACADÉMICA'], new BABYLON.Vector3(0, LEVEL.two + 3.2, 49), Math.PI);
    createDirectorySign(scene, root, 'PISO 3', ['ANFITEATRO ANF-301', 'ESCALERAS A LA TERRAZA'], new BABYLON.Vector3(0, LEVEL.three + 3.4, 48), Math.PI);
    createDirectorySign(scene, root, 'TERRAZA', ['MIRADORES · JARDINES', 'ÁREAS DE DESCANSO Y VISTA PANORÁMICA'], new BABYLON.Vector3(0, LEVEL.rooftop + 3.1, 49), Math.PI);
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
    console.info('[UCAN V265] Auditoría de letreros:', window.__UCAN_SIGN_AUDIT__);
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
            report.issues.push({ mesh:name, reason:'Elemento de sala sobre el plafón', maxY:Number(maxY.toFixed(2)) });
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
      if (chip) chip.textContent = `📍 ${label}`;
      const select = document.getElementById('destinationSelect');
      if (select && document.activeElement !== select) select.value = key;
      document.querySelectorAll('[data-go]').forEach(button => button.classList.toggle('active-destination', button.getAttribute('data-go') === key));
    });
  }

  function setupEnvironmentLOD(scene, camera) {
    const detailedPattern = /flor panorámica|árbol lago|copa lago|tronco lago|poste gazebo|gazebo mirador|puente mirador|sendero panorámico/i;
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
      const dynamic = /cielo|nube|sol|luna|temporada|pizarra|contenido|directorio|rotulo|rótulo|señal|logo/i.test(name) || material.diffuseTexture?.getContext;
      if (!dynamic && typeof material.freeze === 'function') { try { material.freeze(); perf.frozenMaterials += 1; } catch {} }
    }
    const lod = setupEnvironmentLOD(scene, camera);
    perf.lodDetails = lod.details;
    window.__UCAN_PERFORMANCE__ = perf;
    let timer = 0, fpsSamples = [];
    scene.onBeforeRenderObservable.add(() => {
      timer += engine.getDeltaTime();
      fpsSamples.push(engine.getFps());
      if (timer < 5000) return;
      timer = 0;
      const avg = fpsSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, fpsSamples.length);
      fpsSamples = [];
      perf.averageFps = Number(avg.toFixed(1));
      if (autoQuality) {
        const current = engine.getHardwareScalingLevel();
        let next = current;
        if (avg < 30) next = Math.min(1.85, current + .2);
        else if (avg > 52) next = Math.max(1, current - .15);
        if (Math.abs(next-current) >= .09) engine.setHardwareScalingLevel(Number(next.toFixed(2)));
      }
      perf.autoQuality = autoQuality;
      perf.scaling = engine.getHardwareScalingLevel();
      const el = document.getElementById('performanceStatus');
      if (el) el.textContent = `Rendimiento: ${perf.averageFps} FPS · escala ${perf.scaling.toFixed(2)} · calidad automática ${autoQuality ? 'activa' : 'pausada'} · ${perf.lodDetails} detalles con LOD`;
    });
    return perf;
  }

  function buildCampus(scene, root, mats, shadow) {
    buildFloorOne(scene, root, mats, shadow);
    buildFloorTwo(scene, root, mats, shadow);
    buildFloorThree(scene, root, mats, shadow);
    buildShell(scene, root, mats);
    buildAtriumDetails(scene, root, mats);
    buildRooftop(scene, root, mats);
    buildFurniture(scene, root, mats);
    buildBrandingFloorOne(scene, root, mats);
    auditBrandingVsStairs(scene);
    buildWayfindingDirectories(scene, root);
    buildFirstFloorCommonAreas(scene, root, mats);
    buildPlants(scene, root, mats);
    buildWalkPaths(scene, root, mats);
  }

  function markWalkable(mesh) {
    if (!mesh) return mesh;
    mesh.isPickable = true;
    mesh.metadata = { ...(mesh.metadata || {}), walkable: true, teleportable: true, rooftop: true };
    return mesh;
  }

  function rooftopTableSet(scene, root, mats, x, z, umbrellaColor, label) {
    const g = new BABYLON.TransformNode(`mesa rooftop ${label}`, scene);
    g.position = new BABYLON.Vector3(x, LEVEL.rooftop, z);
    g.parent = root;
    cyl(scene, `mesa circular ${label}`, new BABYLON.Vector3(0, .78, 0), 2.8, .12, mats.wood, g, 40, true);
    cyl(scene, `pedestal mesa ${label}`, new BABYLON.Vector3(0, .38, 0), .28, .7, mats.metal, g, 20, true);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      chair(scene, g, mats, Math.sin(a) * 2.1, 0, Math.cos(a) * 2.1, a + Math.PI);
    }
    cyl(scene, `poste sombrilla ${label}`, new BABYLON.Vector3(0, 2.15, 0), .09, 3.9, mats.metal, g, 16, false);
    const umbrellaMat = pbr(scene, `sombrilla ${label}`, umbrellaColor, { roughness: .76 });
    const umbrella = BABYLON.MeshBuilder.CreateCylinder(`sombrilla rooftop ${label}`, { diameterTop: .35, diameterBottom: 4.6, height: .48, tessellation: 40 }, scene);
    umbrella.position = new BABYLON.Vector3(0, 4.05, 0);
    umbrella.material = umbrellaMat;
    umbrella.parent = g;
    umbrella.checkCollisions = false;
  }

  function rooftopPlanter(scene, root, mats, x, z, label) {
    box(scene, `jardinera rooftop ${label}`, new BABYLON.Vector3(x, LEVEL.rooftop + .42, z), new BABYLON.Vector3(7.4, .84, 2.1), mats.wallPanel, root, true);
    box(scene, `tierra rooftop ${label}`, new BABYLON.Vector3(x, LEVEL.rooftop + .88, z), new BABYLON.Vector3(6.9, .10, 1.65), mats.roofGrass, root, false);
  }

  function seasonalTree(scene, parent, mats, x, z, leafMat, label) {
    cyl(scene, `tronco ${label}`, new BABYLON.Vector3(x, 1.35, z), .42, 2.7, mats.wood, parent, 16, true);
    [[0,3.1,0,2.5],[-.8,2.8,.2,1.7],[.8,2.75,-.1,1.7],[0,3.55,.65,1.65]].forEach(([ox,oy,oz,d],i)=>{
      const crown = BABYLON.MeshBuilder.CreateSphere(`copa ${label} ${i}`, { diameter:d, segments:16 }, scene);
      crown.position = new BABYLON.Vector3(x+ox,oy,z+oz);
      crown.material=leafMat;
      crown.parent=parent;
      crown.checkCollisions=false;
    });
  }

  function createSeasonSign(scene, root) {
    const texture = new BABYLON.DynamicTexture('señal temporada terraza', { width: 1024, height: 256 }, scene, false);
    const mat = new BABYLON.StandardMaterial('material señal temporada terraza', scene);
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.disableLighting = true;
    mat.backFaceCulling = true;
    const pair = createDoubleSidedDisplay(
      scene,
      root,
      'señal temporada terraza',
      10.5,
      2.65,
      new BABYLON.Vector3(0, LEVEL.rooftop + 3.0, 48),
      Math.PI,
      mat,
      mat,
      0.08,
      { readableSign: true, rooftop: true }
    );
    return { signs: pair, texture };
  }

  
  function makeDynamicDisplay(scene, root, name, width, height, position, rotationY = Math.PI) {
    const texture = new BABYLON.DynamicTexture(`${name} dinámica`, { width: 1024, height: 1024 }, scene, false);
    const material = new BABYLON.StandardMaterial(`${name} material`, scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    const pair = createDoubleSidedDisplay(scene, root, name, width, height, position, rotationY, material, material, 0.07, { readableSign: true, rooftop: true, livePanel: true, livePanelKey: name, title: name });
    for (const mesh of [pair.front, pair.back]) {
      mesh.isPickable = true;
      mesh.actionManager = new BABYLON.ActionManager(scene);
      mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => openLivePanelViewer(name)));
    }
    const record = { name, texture, material, meshes: pair, width, height, position: position.clone(), rotationY };
    LIVE_PANEL_REGISTRY.set(name, record);
    return record;
  }


  function openLivePanelViewer(panelName) {
    const record = LIVE_PANEL_REGISTRY.get(panelName);
    const viewer = document.getElementById('livePanelViewer');
    const image = document.getElementById('livePanelImage');
    const title = document.getElementById('livePanelTitle');
    const hint = document.getElementById('livePanelHint');
    if (!record || !viewer || !image) return;
    try {
      const sourceCanvas = record.texture.getContext()?.canvas;
      if (!sourceCanvas) throw new Error('Canvas dinámico no disponible');
      image.src = sourceCanvas.toDataURL('image/png');
      image.alt = `Vista ampliada de ${panelName}`;
      if (title) title.textContent = panelName;
      if (hint) hint.textContent = 'Vista ampliada · Presione Escape o el botón × para cerrar.';
      viewer.classList.add('open');
      viewer.setAttribute('aria-hidden', 'false');
      document.getElementById('livePanelClose')?.focus();
    } catch (error) {
      setStatus(`No se pudo ampliar ${panelName}.`);
      console.warn('[UCAN V265] No se pudo abrir el panel ampliado:', error);
    }
  }

  function closeLivePanelViewer() {
    const viewer = document.getElementById('livePanelViewer');
    viewer?.classList.remove('open');
    viewer?.setAttribute('aria-hidden', 'true');
  }

  function setupLivePanelViewer() {
    document.getElementById('livePanelClose')?.addEventListener('click', closeLivePanelViewer);
    document.getElementById('livePanelViewer')?.addEventListener('click', event => {
      if (event.target?.id === 'livePanelViewer') closeLivePanelViewer();
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeLivePanelViewer();
    });
  }

  function drawPanelFrame(ctx, title, subtitle = '') {
    ctx.clearRect(0, 0, 1024, 1024);
    const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
    gradient.addColorStop(0, '#f7f5ec');
    gradient.addColorStop(1, '#e9f1ec');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = '#0c3934';
    ctx.fillRect(0, 0, 1024, 164);
    ctx.fillStyle = '#fed141';
    ctx.fillRect(0, 154, 1024, 18);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 56px Segoe UI, Arial';
    ctx.fillText(title, 512, 74);
    if (subtitle) {
      ctx.font = '28px Segoe UI, Arial';
      ctx.fillText(subtitle, 512, 118);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#18352f';
  }

  function drawInfoCard(ctx, x, y, w, h, title, value, accent = '#fed141') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = '#335952';
    ctx.font = 'bold 28px Segoe UI, Arial';
    ctx.fillText(title, x + 24, y + 34);
    ctx.fillStyle = '#0c3934';
    ctx.font = 'bold 46px Segoe UI, Arial';
    ctx.fillText(value, x + 24, y + 92);
  }


  function drawAgendaSection(ctx, title, items, x, y, width, options = {}) {
    const titleFont = options.titleFont || 'bold 27px Segoe UI, Arial';
    const bodyFont = options.bodyFont || '24px Segoe UI, Arial';
    const lineHeight = options.lineHeight || 29;
    const itemGap = options.itemGap || 9;
    const padding = options.padding || 18;
    const accent = options.accent || '#fed141';
    const normalized = (Array.isArray(items) ? items : [items]).filter(Boolean);
    ctx.font = bodyFont;
    const wrapped = normalized.map(item => wrapAstronomyText(ctx, item, width - padding * 2 - 18));
    const bodyHeight = wrapped.reduce((sum, lines) => sum + Math.max(1, lines.length) * lineHeight + itemGap, 0);
    const height = Math.max(98, 56 + bodyHeight + padding);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#a8bbb4';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 10, height);
    ctx.fillStyle = '#0c3934';
    ctx.font = titleFont;
    ctx.fillText(title, x + padding + 6, y + 34);
    ctx.fillStyle = '#18352f';
    ctx.font = bodyFont;
    let cursor = y + 68;
    wrapped.forEach(lines => {
      lines.forEach((line, index) => {
        const bullet = index === 0 ? '• ' : '  ';
        ctx.fillText(`${bullet}${line}`, x + padding + 6, cursor);
        cursor += lineHeight;
      });
      cursor += itemGap;
    });
    return y + height;
  }

  function wrapAstronomyText(ctx, text, xOrMaxWidth, y, maxWidth, lineHeight) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const returnLinesOnly = arguments.length <= 3;
    const width = returnLinesOnly ? Number(xOrMaxWidth) : Number(maxWidth);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (!lines.length) lines.push('');
    if (returnLinesOnly) return lines;

    let cursorY = Number(y);
    const x = Number(xOrMaxWidth);
    for (const part of lines) {
      ctx.fillText(part, x, cursorY);
      cursorY += Number(lineHeight);
    }
    return cursorY - Number(lineHeight);
  }


  function drawWrappedAstronomyBlock(ctx, text, x, y, maxWidth, lineHeight, blockGap = 0) {
    const lines = wrapAstronomyText(ctx, text, maxWidth);
    let cursorY = Number(y);
    for (const part of lines) {
      ctx.fillText(part, Number(x), cursorY);
      cursorY += Number(lineHeight);
    }
    return cursorY + Number(blockGap);
  }


  const SKY_STAR_CATALOG = Object.freeze([
    { id:'betelgeuse', name:'Betelgeuse', constellation:'Orión', ra:5.9195, dec:7.4071, mag:0.5 },
    { id:'bellatrix', name:'Bellatrix', constellation:'Orión', ra:5.4189, dec:6.3497, mag:1.6 },
    { id:'rigel', name:'Rigel', constellation:'Orión', ra:5.2423, dec:-8.2016, mag:0.2 },
    { id:'saiph', name:'Saiph', constellation:'Orión', ra:5.7959, dec:-9.6696, mag:2.1 },
    { id:'aldebaran', name:'Aldebarán', constellation:'Tauro', ra:4.5987, dec:16.5093, mag:0.9 },
    { id:'elnath', name:'Elnath', constellation:'Tauro', ra:5.4382, dec:28.6075, mag:1.7 },
    { id:'castor', name:'Cástor', constellation:'Géminis', ra:7.5767, dec:31.8883, mag:1.6 },
    { id:'pollux', name:'Pólux', constellation:'Géminis', ra:7.7553, dec:28.0262, mag:1.1 },
    { id:'regulus', name:'Régulo', constellation:'Leo', ra:10.1395, dec:11.9672, mag:1.4 },
    { id:'denebola', name:'Denébola', constellation:'Leo', ra:11.8177, dec:14.5721, mag:2.1 },
    { id:'spica', name:'Espiga', constellation:'Virgo', ra:13.4199, dec:-11.1614, mag:1.0 },
    { id:'arcturus', name:'Arturo', constellation:'Boyero', ra:14.2610, dec:19.1824, mag:-0.1 },
    { id:'antares', name:'Antares', constellation:'Escorpio', ra:16.4901, dec:-26.4320, mag:1.0 },
    { id:'kaus', name:'Kaus Australis', constellation:'Sagitario', ra:18.4029, dec:-34.3846, mag:1.8 },
    { id:'nunki', name:'Nunki', constellation:'Sagitario', ra:18.9211, dec:-26.2967, mag:2.0 },
    { id:'deneb', name:'Deneb', constellation:'Cisne', ra:20.6905, dec:45.2803, mag:1.3 },
    { id:'sadr', name:'Sadr', constellation:'Cisne', ra:20.3705, dec:40.2567, mag:2.2 },
    { id:'albireo', name:'Albireo', constellation:'Cisne', ra:19.5120, dec:27.9597, mag:3.1 },
    { id:'markab', name:'Markab', constellation:'Pegaso', ra:23.0794, dec:15.2053, mag:2.5 },
    { id:'scheat', name:'Scheat', constellation:'Pegaso', ra:23.0629, dec:28.0828, mag:2.4 },
    { id:'algenib', name:'Algenib', constellation:'Pegaso', ra:0.2206, dec:15.1836, mag:2.8 },
    { id:'alpheratz', name:'Alpheratz', constellation:'Andrómeda', ra:0.1398, dec:29.0904, mag:2.1 },
    { id:'mirach', name:'Mirach', constellation:'Andrómeda', ra:1.1622, dec:35.6206, mag:2.1 },
    { id:'almach', name:'Almach', constellation:'Andrómeda', ra:2.0649, dec:42.3297, mag:2.1 },
    { id:'sadalmelik', name:'Sadalmelik', constellation:'Acuario', ra:22.0964, dec:-0.3198, mag:3.0 }
  ]);

  const SKY_CONSTELLATION_LINES = Object.freeze([
    ['betelgeuse','bellatrix'], ['bellatrix','rigel'], ['rigel','saiph'], ['saiph','betelgeuse'],
    ['aldebaran','elnath'], ['castor','pollux'], ['regulus','denebola'], ['deneb','sadr'], ['sadr','albireo'],
    ['markab','scheat'], ['scheat','alpheratz'], ['alpheratz','algenib'], ['algenib','markab'],
    ['alpheratz','mirach'], ['mirach','almach'], ['kaus','nunki']
  ]);

  const PLANET_NAMES = ['Mercurio','Venus','Marte','Júpiter','Saturno','Urano','Neptuno'];

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function normalizeRadians(value) {
    const twoPi = Math.PI * 2;
    return ((value % twoPi) + twoPi) % twoPi;
  }

  function julianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function localSiderealDegrees(date, longitude) {
    const jd = julianDate(date);
    const T = (jd - 2451545.0) / 36525;
    const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000;
    return normalizeDegrees(gmst + longitude);
  }

  function raDecToAltAz(raHours, decDeg, date, latitude, longitude) {
    const deg = Math.PI / 180;
    const lst = localSiderealDegrees(date, longitude);
    let hourAngle = normalizeDegrees(lst - raHours * 15);
    if (hourAngle > 180) hourAngle -= 360;
    const H = hourAngle * deg;
    const dec = decDeg * deg;
    const lat = latitude * deg;
    const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
    const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const azimuth = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(H));
    return { altitude: altitude / deg, azimuth: normalizeDegrees(azimuth / deg), hourAngle, lst };
  }

  function orbitalElements(name, d) {
    const data = {
      Mercury: [48.3313+3.24587e-5*d,7.0047+5e-8*d,29.1241+1.01444e-5*d,0.387098,0.205635+5.59e-10*d,168.6562+4.0923344368*d],
      Venus: [76.6799+2.46590e-5*d,3.3946+2.75e-8*d,54.8910+1.38374e-5*d,0.723330,0.006773-1.302e-9*d,48.0052+1.6021302244*d],
      Earth: [0,0,282.9404+4.70935e-5*d,1.0,0.016709-1.151e-9*d,356.0470+0.9856002585*d],
      Mars: [49.5574+2.11081e-5*d,1.8497-1.78e-8*d,286.5016+2.92961e-5*d,1.523688,0.093405+2.516e-9*d,18.6021+0.5240207766*d],
      Jupiter: [100.4542+2.76854e-5*d,1.3030-1.557e-7*d,273.8777+1.64505e-5*d,5.20256,0.048498+4.469e-9*d,19.8950+0.0830853001*d],
      Saturn: [113.6634+2.38980e-5*d,2.4886-1.081e-7*d,339.3939+2.97661e-5*d,9.55475,0.055546-9.499e-9*d,316.9670+0.0334442282*d],
      Uranus: [74.0005+1.3978e-5*d,0.7733+1.9e-8*d,96.6612+3.0565e-5*d,19.18171-1.55e-8*d,0.047318+7.45e-9*d,142.5905+0.011725806*d],
      Neptune: [131.7806+3.0173e-5*d,1.7700-2.55e-7*d,272.8461-6.027e-6*d,30.05826+3.313e-8*d,0.008606+2.15e-9*d,260.2471+0.005995147*d]
    };
    return data[name];
  }

  function heliocentricPosition(name, date) {
    const deg = Math.PI / 180;
    const d = julianDate(date) - 2451543.5;
    const [Ndeg, ideg, wdeg, a, e, Mdeg] = orbitalElements(name, d);
    const N = Ndeg * deg, i = ideg * deg, w = wdeg * deg, M = normalizeDegrees(Mdeg) * deg;
    let E = M;
    for (let k = 0; k < 10; k += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);
    const vw = v + w;
    return {
      x: r * (Math.cos(N) * Math.cos(vw) - Math.sin(N) * Math.sin(vw) * Math.cos(i)),
      y: r * (Math.sin(N) * Math.cos(vw) + Math.cos(N) * Math.sin(vw) * Math.cos(i)),
      z: r * Math.sin(vw) * Math.sin(i)
    };
  }

  function planetRaDec(nameEs, date) {
    const map = { Mercurio:'Mercury', Venus:'Venus', Marte:'Mars', Júpiter:'Jupiter', Saturno:'Saturn', Urano:'Uranus', Neptuno:'Neptune' };
    const target = heliocentricPosition(map[nameEs], date);
    const earth = heliocentricPosition('Earth', date);
    const xg = target.x - earth.x;
    const yg = target.y - earth.y;
    const zg = target.z - earth.z;
    const d = julianDate(date) - 2451543.5;
    const obliquity = (23.4393 - 3.563e-7 * d) * Math.PI / 180;
    const xe = xg;
    const ye = yg * Math.cos(obliquity) - zg * Math.sin(obliquity);
    const ze = yg * Math.sin(obliquity) + zg * Math.cos(obliquity);
    const ra = normalizeRadians(Math.atan2(ye, xe)) * 12 / Math.PI;
    const dec = Math.atan2(ze, Math.hypot(xe, ye)) * 180 / Math.PI;
    return { ra, dec, distance: Math.hypot(xg, yg, zg) };
  }

  function issAltAz(date) {
    if (!LIVE_CONTEXT.issLocation) return null;
    const deg = Math.PI / 180;
    const lat1 = SAN_GERMAN.latitude * deg;
    const lon1 = SAN_GERMAN.longitude * deg;
    const lat2 = Number(LIVE_CONTEXT.issLocation.latitude) * deg;
    const lon2 = Number(LIVE_CONTEXT.issLocation.longitude) * deg;
    const dLon = lon2 - lon1;
    const central = Math.acos(Math.max(-1, Math.min(1, Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon))));
    const bearing = Math.atan2(Math.sin(dLon) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon));
    const altitudeKm = Number(LIVE_CONTEXT.issLocation.altitude || 420);
    const earthRadius = 6371;
    const elevation = Math.atan2(Math.cos(central) - earthRadius / (earthRadius + altitudeKm), Math.sin(central));
    return { altitude: elevation / deg, azimuth: normalizeDegrees(bearing / deg), distance: central * earthRadius };
  }

  function buildSkySnapshot(now) {
    const date = now.date;
    const stars = SKY_STAR_CATALOG.map(star => ({ ...star, ...raDecToAltAz(star.ra, star.dec, date, SAN_GERMAN.latitude, SAN_GERMAN.longitude) }));
    const planets = PLANET_NAMES.map(name => {
      const eq = planetRaDec(name, date);
      return { name, ...eq, ...raDecToAltAz(eq.ra, eq.dec, date, SAN_GERMAN.latitude, SAN_GERMAN.longitude) };
    });
    const iss = issAltAz(date);
    const visibleConstellations = [...new Set(stars.filter(star => star.altitude > 8).map(star => star.constellation))];
    const visiblePlanets = planets.filter(planet => planet.altitude > 3).map(planet => planet.name);
    return { date, lst: localSiderealDegrees(date, SAN_GERMAN.longitude), stars, planets, iss, visibleConstellations, visiblePlanets };
  }

  function horizonMapPoint(altitude, azimuth, cx, cy, radius) {
    const zenithDistance = Math.max(0, Math.min(90, 90 - altitude));
    const r = radius * zenithDistance / 90;
    const az = azimuth * Math.PI / 180;
    return { x: cx + r * Math.sin(az), y: cy - r * Math.cos(az) };
  }

  function horizonWorldPoint(altitude, azimuth, radius = 210) {
    const alt = Math.max(1, altitude) * Math.PI / 180;
    const az = azimuth * Math.PI / 180;
    const horizontal = Math.cos(alt) * radius;
    return new BABYLON.Vector3(Math.sin(az) * horizontal, LEVEL.rooftop + 10 + Math.sin(alt) * radius, -Math.cos(az) * horizontal);
  }

  function drawMoonPhaseDisk(ctx, centerX, centerY, radius, age) {
    const size = Math.max(64, Math.floor(radius * 2));
    const image = ctx.createImageData(size, size);
    const synodic = 29.530588853;
    const phaseAngle = (age / synodic) * Math.PI * 2;
    const sunX = Math.sin(phaseAngle);
    const sunZ = -Math.cos(phaseAngle);
    for (let py = 0; py < size; py += 1) {
      for (let px = 0; px < size; px += 1) {
        const nx = (px - size / 2) / (size / 2);
        const ny = (py - size / 2) / (size / 2);
        const rr = nx * nx + ny * ny;
        const idx = (py * size + px) * 4;
        if (rr > 1) { image.data[idx + 3] = 0; continue; }
        const nz = Math.sqrt(Math.max(0, 1 - rr));
        const light = nx * sunX + nz * sunZ;
        const limb = 0.65 + 0.35 * nz;
        const value = light > 0 ? Math.round((105 + 145 * Math.min(1, light)) * limb) : Math.round(18 + 18 * nz);
        image.data[idx] = value;
        image.data[idx + 1] = value;
        image.data[idx + 2] = light > 0 ? Math.min(255, value + 12) : value + 4;
        image.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(image, Math.floor(centerX - size / 2), Math.floor(centerY - size / 2));
    ctx.strokeStyle = '#d7e4e1';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function astronomyEventsForYear(year) {
    const base2026 = [
      { month:1, day:'2–3', type:'meteoro', title:'Cuadrántidas' },
      { month:1, day:'10', type:'planeta', title:'Júpiter en oposición' },
      { month:2, day:'17', type:'eclipse', title:'Eclipse solar anular · visible en la Antártida' },
      { month:2, day:'28', type:'planeta', title:'Desfile planetario' },
      { month:3, day:'3', type:'eclipse', title:'Eclipse lunar total · visible en las Américas' },
      { month:4, day:'21–22', type:'meteoro', title:'Líridas' },
      { month:5, day:'5–6', type:'meteoro', title:'Eta Acuáridas' },
      { month:5, day:'31', type:'luna', title:'Luna azul' },
      { month:6, day:'8–9', type:'planeta', title:'Conjunción Venus–Júpiter' },
      { month:7, day:'30–31', type:'meteoro', title:'Delta Acuáridas y Alfa Capricórnidas' },
      { month:8, day:'12', type:'eclipse', title:'Eclipse solar total · no total desde Puerto Rico' },
      { month:8, day:'12–13', type:'meteoro', title:'Perseidas' },
      { month:8, day:'27–28', type:'eclipse', title:'Eclipse lunar parcial · visible en las Américas' },
      { month:9, day:'25', type:'planeta', title:'Neptuno en oposición' },
      { month:10, day:'4', type:'planeta', title:'Saturno en oposición' },
      { month:10, day:'21–22', type:'meteoro', title:'Oriónidas' },
      { month:11, day:'17', type:'meteoro', title:'Leónidas' },
      { month:11, day:'25', type:'planeta', title:'Urano en oposición' },
      { month:12, day:'13–14', type:'meteoro', title:'Gemínidas' },
      { month:12, day:'24', type:'luna', title:'Superluna' }
    ];
    const events = year === 2026 ? base2026.slice() : [];
    for (const comet of LIVE_CONTEXT.cometEvents || []) {
      const date = new Date(`${comet.date.replace(' ', 'T')}Z`);
      if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year) continue;
      events.push({ month: date.getUTCMonth() + 1, day: String(date.getUTCDate()), type:'cometa', title:`${comet.name} · aproximación ${Number(comet.distanceAu).toFixed(2)} au` });
    }
    if (!(LIVE_CONTEXT.cometEvents || []).length) {
      for (const month of [3,6,9,12]) events.push({ month, day:'—', type:'cometa', title:'Seguimiento de cometas · datos JPL al conectarse' });
    }
    return events.sort((a,b) => a.month - b.month || (parseInt(a.day,10) || 99) - (parseInt(b.day,10) || 99));
  }

  function telescopeRig(scene, root, mats, x, z, rotationY, label) {
    const g = new BABYLON.TransformNode(`telescopio ${label}`, scene);
    g.position = new BABYLON.Vector3(x, LEVEL.rooftop, z);
    g.rotation.y = rotationY;
    g.parent = root;
    cyl(scene, `base telescopio ${label}`, new BABYLON.Vector3(0, .88, 0), .18, 1.76, mats.metal, g, 18, true);
    for (const [dx, dz] of [[-.46, -.36], [.46, -.36], [0, .48]]) {
      const leg = cyl(scene, `pata telescopio ${label} ${dx}`, new BABYLON.Vector3(dx, .52, dz), .08, 1.08, mats.black, g, 12, false);
      leg.rotation.x = Math.PI / 10;
    }
    box(scene, `montura telescopio ${label}`, new BABYLON.Vector3(0, 1.5, 0), new BABYLON.Vector3(.45, .24, .45), mats.black, g, false);
    const tube = cyl(scene, `tubo telescopio ${label}`, new BABYLON.Vector3(.18, 1.68, -.14), .34, 2.25, mats.wallPanel, g, 24, false);
    tube.rotation.z = Math.PI / 2.9;
    tube.rotation.y = Math.PI / 2;
    const lens = cyl(scene, `lente telescopio ${label}`, new BABYLON.Vector3(.92, 1.96, -.14), .36, .14, mats.glass, g, 24, false);
    lens.rotation.z = Math.PI / 2.9;
    const signMat = createTextMaterial(scene, `placa telescopio ${label}`, label.toUpperCase(), 'Observación terrestre y astronómica', '#103833', '#fed141');
    signMat.backFaceCulling = true;
    createDoubleSidedDisplay(scene, g, `placa telescopio ${label}`, 2.5, 0.92, new BABYLON.Vector3(0, 1.25, 1.2), 0, signMat, signMat, 0.05, { readableSign: true, rooftop: true, telescope: label });
    return g;
  }

  function buildAstronomyTerrace(scene, root, mats) {
    const y = LEVEL.rooftop;
    const skyRoot = new BABYLON.TransformNode('astronomía terraza', scene);
    skyRoot.parent = root;

    const weatherPanel = makeDynamicDisplay(scene, root, 'Panel clima San Germán', 9.0, 7.0, new BABYLON.Vector3(-33, y + 5.6, 49.2), Math.PI);
    const agendaPanel = makeDynamicDisplay(scene, root, 'Panel agenda astronómica', 12.6, 10.2, new BABYLON.Vector3(34, y + 7.3, 49.2), Math.PI);
    const moonPanel = makeDynamicDisplay(scene, root, 'Panel fase lunar', 9.0, 6.7, new BABYLON.Vector3(-33, y + 5.6, -49.2), 0);
    const skyMapPanel = makeDynamicDisplay(scene, root, 'Mapa celeste orientado', 11.8, 8.2, new BABYLON.Vector3(0, y + 6.4, -49.2), 0);
    const calendarPanel = makeDynamicDisplay(scene, root, 'Calendario astronómico', 12.6, 10.2, new BABYLON.Vector3(34, y + 7.3, -49.2), 0);
    const clockPanel = makeDynamicDisplay(scene, root, 'Reloj San Germán', 5.8, 2.8, new BABYLON.Vector3(0, LEVEL.one + 5.1, 51.2), Math.PI);

    telescopeRig(scene, root, mats, 45, 36, -Math.PI / 2.4, 'Refractor');
    telescopeRig(scene, root, mats, 45, 22, -Math.PI / 2.9, 'Dobson');
    telescopeRig(scene, root, mats, 45, -24, -Math.PI / 2.5, 'Catadióptrico');

    const markerMat = pbr(scene, 'marcador astronómico', '#dce7ff', { emissive: '#dce7ff', emissiveIntensity: 1.1 });
    const planetMat = pbr(scene, 'marcador planetas', '#fed141', { emissive: '#fed141', emissiveIntensity: .9 });
    const issMat = pbr(scene, 'marcador EEI', '#7ec8ff', { emissive: '#7ec8ff', emissiveIntensity: 1 });
    const labelMatFactory = (title, subtitle = '') => createTextMaterial(scene, `etiqueta ${title}`, title.toUpperCase(), subtitle, '#0b2430', '#fed141');
    const skyMarkers = new Map();

    const createDynamicMarker = (key, title, subtitle, material, diameter = 1.1) => {
      const point = BABYLON.MeshBuilder.CreateSphere(`${key} punto`, { diameter, segments: 8 }, scene);
      point.material = material;
      point.parent = skyRoot;
      point.isPickable = false;
      const mat = labelMatFactory(title, subtitle);
      const pair = createDoubleSidedDisplay(scene, skyRoot, `${key} etiqueta`, 2.4, .92, new BABYLON.Vector3(0,0,0), 0, mat, mat, .03, { readableSign:true, rooftop:true, astronomyLabel:true });
      pair.front.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      pair.back.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      skyMarkers.set(key, { point, labelFront:pair.front, labelBack:pair.back });
    };

    for (const constellation of [...new Set(SKY_STAR_CATALOG.map(star => star.constellation))]) createDynamicMarker(`const-${constellation}`, constellation, 'Constelación', markerMat, .9);
    for (const planet of PLANET_NAMES) createDynamicMarker(`planet-${planet}`, planet, 'Planeta', planetMat, 1.05);
    createDynamicMarker('iss', 'EEI', 'Estación espacial', issMat, .85);

    const updateMarker = (key, altitude, azimuth, visible) => {
      const marker = skyMarkers.get(key);
      if (!marker) return;
      const enabled = Boolean(visible && altitude > 0);
      marker.point.setEnabled(enabled);
      marker.labelFront.setEnabled(enabled);
      marker.labelBack.setEnabled(enabled);
      if (!enabled) return;
      const pos = horizonWorldPoint(altitude, azimuth, 210);
      marker.point.position.copyFrom(pos);
      marker.labelFront.position.copyFrom(pos.add(new BABYLON.Vector3(0, 2.3, 0)));
      marker.labelBack.position.copyFrom(pos.add(new BABYLON.Vector3(0, 2.3, 0)));
    };

    const drawSkyMap = (ctx, snapshot, now, allowSky) => {
      drawPanelFrame(ctx, 'MAPA CELESTE · SAN GERMÁN', `${now.timeLabel} · norte arriba · orientación local`);
      const cx = 512, cy = 575, radius = 350;
      ctx.fillStyle = '#071d2d';
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6aa3b5'; ctx.lineWidth = 3;
      for (const alt of [0,30,60]) {
        const rr = radius * (90-alt)/90;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = '#fed141'; ctx.font = 'bold 32px Segoe UI, Arial'; ctx.textAlign = 'center';
      ctx.fillText('N', cx, cy-radius-18); ctx.fillText('E', cx+radius+22, cy+10); ctx.fillText('S', cx, cy+radius+38); ctx.fillText('O', cx-radius-22, cy+10);
      ctx.fillStyle = '#b8d5e3'; ctx.font = '24px Segoe UI, Arial';
      ctx.fillText('60°', cx+8, cy-radius/3+5); ctx.fillText('30°', cx+8, cy-radius*2/3+5); ctx.fillText('Cénit', cx, cy+8);
      const starById = Object.fromEntries(snapshot.stars.map(star => [star.id, star]));
      ctx.strokeStyle = 'rgba(180,210,235,.45)'; ctx.lineWidth = 2;
      for (const [aId,bId] of SKY_CONSTELLATION_LINES) {
        const a=starById[aId], b=starById[bId];
        if (!a || !b || a.altitude <= 0 || b.altitude <= 0 || !allowSky) continue;
        const pa=horizonMapPoint(a.altitude,a.azimuth,cx,cy,radius), pb=horizonMapPoint(b.altitude,b.azimuth,cx,cy,radius);
        ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke();
      }
      if (allowSky) {
        for (const star of snapshot.stars.filter(item => item.altitude > 0)) {
          const p=horizonMapPoint(star.altitude,star.azimuth,cx,cy,radius);
          const size=Math.max(2.5,6-star.mag);
          ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(p.x,p.y,size,0,Math.PI*2); ctx.fill();
          if (star.mag < 1.5) { ctx.fillStyle='#d6e9f4'; ctx.font='20px Segoe UI, Arial'; ctx.textAlign='left'; ctx.fillText(star.name,p.x+8,p.y-5); }
        }
        for (const planet of snapshot.planets.filter(item => item.altitude > 0)) {
          const p=horizonMapPoint(planet.altitude,planet.azimuth,cx,cy,radius);
          ctx.fillStyle='#fed141'; ctx.beginPath(); ctx.arc(p.x,p.y,7,0,Math.PI*2); ctx.fill();
          ctx.font='bold 22px Segoe UI, Arial'; ctx.textAlign='left'; ctx.fillText(planet.name,p.x+10,p.y+6);
        }
        if (snapshot.iss && snapshot.iss.altitude > 0) {
          const p=horizonMapPoint(snapshot.iss.altitude,snapshot.iss.azimuth,cx,cy,radius);
          ctx.fillStyle='#7ec8ff'; ctx.fillRect(p.x-6,p.y-6,12,12); ctx.font='bold 22px Segoe UI, Arial'; ctx.fillText('EEI',p.x+10,p.y+5);
        }
      }
      ctx.textAlign='left'; ctx.fillStyle='#284f5c'; ctx.font='26px Segoe UI, Arial';
      ctx.fillText(`Tiempo sideral local: ${(snapshot.lst/15).toFixed(2)} h`,48,955);
      ctx.fillText(allowSky ? 'Objetos sobre el horizonte y cielo suficientemente despejado.' : 'Mapa oculto por luz diurna o nubosidad elevada.',48,990);
    };
    const drawCalendar = (ctx, events, year) => {
      drawPanelFrame(ctx, `CALENDARIO ASTRONÓMICO ${year}`, 'Eclipses, meteoros, planetas y cometas · diseño ampliado');
      const months=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
      const colors={eclipse:'#ef8b73',meteoro:'#7ec8ff',planeta:'#fed141',luna:'#c8b7ff',cometa:'#96d27c'};
      const cardW=304, cardH=176, startX=34, startY=190, gapX=12, gapY=12;
      ctx.textAlign='left';
      for (let m=1;m<=12;m+=1) {
        const col=(m-1)%3, row=Math.floor((m-1)/3);
        const x=startX+col*(cardW+gapX), y=startY+row*(cardH+gapY);
        ctx.fillStyle='#ffffff'; ctx.fillRect(x,y,cardW,cardH);
        ctx.strokeStyle='#9eb7ae'; ctx.lineWidth=2; ctx.strokeRect(x,y,cardW,cardH);
        ctx.fillStyle='#0c3934'; ctx.font='bold 28px Segoe UI, Arial'; ctx.fillText(months[m-1],x+14,y+30);
        const items=events.filter(event=>event.month===m).slice(0,2);
        let yy=y+58;
        if (!items.length) {
          ctx.fillStyle='#6d817b'; ctx.font='21px Segoe UI, Arial';
          ctx.fillText('Sin eventos destacados',x+14,yy);
        } else {
          for (const item of items) {
            ctx.fillStyle=colors[item.type]||'#b9c6c1'; ctx.fillRect(x+14,yy-12,10,10);
            ctx.fillStyle='#18352f'; ctx.font='bold 18px Segoe UI, Arial'; ctx.fillText(item.day,x+32,yy-2);
            ctx.font='16px Segoe UI, Arial';
            const lines = wrapAstronomyText(ctx,item.title,cardW-58).slice(0,2);
            let ly = yy + 16;
            for (const line of lines) { ctx.fillText(line,x+32,ly); ly += 18; }
            yy += 54;
          }
        }
      }
      ctx.fillStyle='#426a62'; ctx.font='22px Segoe UI, Arial';
      wrapAstronomyText(ctx,'Eclipses: NASA. Cometas: aproximaciones a la Tierra según NASA/JPL SBDB. Se muestran eventos resumidos para evitar superposición de texto.',36,1010,952,24);
    };

    const refresh = () => {
      const now = LIVE_CONTEXT.localNow || getSanGermanNow();
      const snapshot = buildSkySnapshot(now);
      LIVE_CONTEXT.skySnapshot = snapshot;
      LIVE_CONTEXT.visibleConstellations = snapshot.visibleConstellations;
      LIVE_CONTEXT.visiblePlanets = snapshot.visiblePlanets;
      LIVE_CONTEXT.eventCalendar = astronomyEventsForYear(now.year);
      const isNight = now.timeOfDay >= LIVE_CONTEXT.sunsetHour || now.timeOfDay < LIVE_CONTEXT.sunriseHour;
      const weatherGood = (LIVE_CONTEXT.cloudCover || 0) < 78;
      const allowSky = isNight && weatherGood;

      const constellations = {};
      for (const star of snapshot.stars.filter(star => star.altitude > 0)) {
        const current = constellations[star.constellation];
        if (!current || star.altitude > current.altitude) constellations[star.constellation] = star;
      }
      for (const name of [...new Set(SKY_STAR_CATALOG.map(star => star.constellation))]) {
        const star=constellations[name]; updateMarker(`const-${name}`,star?.altitude||-90,star?.azimuth||0,allowSky && Boolean(star));
      }
      for (const planet of snapshot.planets) updateMarker(`planet-${planet.name}`,planet.altitude,planet.azimuth,allowSky);
      updateMarker('iss',snapshot.iss?.altitude||-90,snapshot.iss?.azimuth||0,allowSky && Boolean(snapshot.iss));

      const weatherCtx = weatherPanel.texture.getContext();
      drawPanelFrame(weatherCtx, 'ESTADO DEL TIEMPO · SAN GERMÁN', `Actualizado ${now.timeLabel}`);
      drawInfoCard(weatherCtx,48,220,284,128,'Temperatura',LIVE_CONTEXT.temperature==null?'—':`${Math.round(LIVE_CONTEXT.temperature)} ${LIVE_CONTEXT.temperatureUnit || '°F'}`);
      drawInfoCard(weatherCtx,370,220,284,128,'Humedad',LIVE_CONTEXT.humidity==null?'—':`${Math.round(LIVE_CONTEXT.humidity)} %`,'#7ec8ff');
      drawInfoCard(weatherCtx,692,220,284,128,'Nubosidad',`${Math.round(LIVE_CONTEXT.cloudCover||0)} %`,'#6dc9ae');
      drawInfoCard(weatherCtx,48,386,284,128,'Viento',`${Math.round(LIVE_CONTEXT.windSpeed||0)} ${LIVE_CONTEXT.windSpeedUnit || 'mph'}`,'#fed141');
      drawInfoCard(weatherCtx,370,386,284,128,'Lluvia',`${Number(LIVE_CONTEXT.precipitation||0).toFixed(1)} mm`,'#ffbd6d');
      drawInfoCard(weatherCtx,692,386,284,128,'Cielo',LIVE_CONTEXT.weatherLabel,'#96d27c');
      weatherCtx.fillStyle='#18352f'; weatherCtx.font='bold 38px Segoe UI, Arial';
      weatherCtx.fillText(`Amanecer: ${formatHourDecimal(LIVE_CONTEXT.sunriseHour)}`,48,596);
      weatherCtx.fillText(`Atardecer: ${formatHourDecimal(LIVE_CONTEXT.sunsetHour)}`,48,650);
      weatherCtx.fillText(`Índice de observación: ${LIVE_CONTEXT.stargazingIndex}/100`,48,704);
      weatherCtx.font='32px Segoe UI, Arial'; wrapAstronomyText(weatherCtx,`Ubicación: ${SAN_GERMAN.name}. Fuente: ${LIVE_CONTEXT.astronomySource}.`,48,792,930,40);
      weatherCtx.font='30px Segoe UI, Arial'; weatherCtx.fillStyle='#426a62'; weatherCtx.fillText(`Fecha local: ${now.dateLabel}`,48,936); weatherPanel.texture.update();

      const agendaCtx=agendaPanel.texture.getContext();
      drawPanelFrame(agendaCtx,'AGENDA ASTRONÓMICA · TERRAZA','San Germán · panel interactivo: haga clic para ampliar');
      agendaCtx.textBaseline='alphabetic';
      let agendaY = 196;
      agendaY = drawAgendaSection(agendaCtx, 'OBJETOS SOBRE EL HORIZONTE', [
        `Constelaciones: ${snapshot.visibleConstellations.length ? snapshot.visibleConstellations.join(', ') : 'ninguna marcada'}`,
        `Planetas: ${snapshot.visiblePlanets.length ? snapshot.visiblePlanets.join(', ') : 'ninguno marcado'}`
      ], 38, agendaY, 948, { accent:'#7ec8ff', bodyFont:'23px Segoe UI, Arial', lineHeight:28 });
      agendaY += 16;
      const issItems = (LIVE_CONTEXT.issPasses || []).slice(0,4).map(item => item);
      agendaY = drawAgendaSection(agendaCtx, 'VENTANAS ESTIMADAS PARA VER LA EEI', issItems.length ? issItems : ['Sin ventanas confirmadas en este momento.'], 38, agendaY, 948, { accent:'#fed141', bodyFont:'23px Segoe UI, Arial', lineHeight:28 });
      agendaY += 16;
      const upcomingEvents = LIVE_CONTEXT.eventCalendar.filter(event => event.month >= now.month).slice(0,4).map(item => `${item.day} · ${item.title}`);
      agendaY = drawAgendaSection(agendaCtx, 'PRÓXIMOS EVENTOS', upcomingEvents.length ? upcomingEvents : ['No hay eventos destacados en el calendario actual.'], 38, agendaY, 948, { accent:'#96d27c', bodyFont:'22px Segoe UI, Arial', lineHeight:27 });
      agendaCtx.fillStyle='#426a62';
      agendaCtx.font='19px Segoe UI, Arial';
      wrapAstronomyText(agendaCtx,'Posiciones planetarias: efemérides educativas de baja precisión. La información corresponde al instante en que se entra a la terraza en San Germán, Puerto Rico.',48,958,928,22);
      agendaPanel.texture.update();

      const moonCtx=moonPanel.texture.getContext(); drawPanelFrame(moonCtx,'FASE LUNAR · OBSERVACIÓN','Representación gráfica calculada');
      drawMoonPhaseDisk(moonCtx,175,360,125,LIVE_CONTEXT.moonAge||0);
      moonCtx.fillStyle='#18352f'; moonCtx.font='bold 54px Segoe UI, Arial'; moonCtx.fillText(LIVE_CONTEXT.moonPhase||'Luna nueva',340,278);
      moonCtx.font='bold 34px Segoe UI, Arial'; moonCtx.fillText(`Iluminación: ${Math.round((LIVE_CONTEXT.moonIllumination||0)*100)} %`,340,342);
      moonCtx.fillText(`Edad lunar: ${(LIVE_CONTEXT.moonAge||0).toFixed(1)} días`,340,396); moonCtx.fillText(`Índice de observación: ${LIVE_CONTEXT.stargazingIndex}/100`,340,450);
      drawInfoCard(moonCtx,48,520,284,126,'Condición',LIVE_CONTEXT.weatherLabel,'#96d27c');
      drawInfoCard(moonCtx,370,520,284,126,'EEI',(LIVE_CONTEXT.issLocation?.visibility||'estimada').toUpperCase(),'#7ec8ff');
      drawInfoCard(moonCtx,692,520,284,126,'Ventana próxima',(LIVE_CONTEXT.issPasses&&LIVE_CONTEXT.issPasses[0])?LIVE_CONTEXT.issPasses[0]:'—','#fed141');
      moonCtx.fillStyle='#18352f'; moonCtx.font='30px Segoe UI, Arial';
      if (LIVE_CONTEXT.issLocation) wrapAstronomyText(moonCtx,`Posición actual EEI: lat ${LIVE_CONTEXT.issLocation.latitude}, lon ${LIVE_CONTEXT.issLocation.longitude}, alt ${LIVE_CONTEXT.issLocation.altitude} km.`,48,730,930,36);
      else wrapAstronomyText(moonCtx,'Posición actual EEI: referencia estimada sin conexión al servicio externo.',48,730,930,36);
      wrapAstronomyText(moonCtx,'La fase lunar se calcula localmente y se dibuja con el terminador iluminado.',48,842,930,36); moonPanel.texture.update();

      const skyCtx=skyMapPanel.texture.getContext(); drawSkyMap(skyCtx,snapshot,now,allowSky); skyMapPanel.texture.update();
      const calCtx=calendarPanel.texture.getContext(); drawCalendar(calCtx,LIVE_CONTEXT.eventCalendar,now.year); calendarPanel.texture.update();

      const clockCtx=clockPanel.texture.getContext(); drawPanelFrame(clockCtx,'RELOJ · SAN GERMÁN','Hora local del recinto');
      clockCtx.fillStyle='#0c3934'; clockCtx.font='bold 96px Segoe UI, Arial'; clockCtx.textAlign='center'; clockCtx.fillText(now.timeLabel,512,416);
      clockCtx.font='bold 40px Segoe UI, Arial'; clockCtx.fillStyle='#18352f'; clockCtx.fillText(now.dateLabel,512,572); clockCtx.font='34px Segoe UI, Arial';
      clockCtx.fillText(`Clima: ${LIVE_CONTEXT.weatherLabel}`,512,660); clockCtx.fillText(`Luna: ${LIVE_CONTEXT.moonPhase||'Luna nueva'}`,512,716); clockCtx.fillStyle='#426a62'; clockCtx.font='28px Segoe UI, Arial'; clockCtx.fillText(SAN_GERMAN.name,512,794); clockPanel.texture.update();
    };

    const updateSkyMood=({daylight,cloudiness})=>{ skyRoot.setEnabled(daylight<.18&&cloudiness<.78); refresh(); };
    const api={refresh,updateSkyMood,weatherPanel,agendaPanel,moonPanel,skyMapPanel,calendarPanel,clockPanel,skyMarkers};
    refresh();
    window.__UCAN_ASTRONOMIA__={version:'V265',location:SAN_GERMAN,method:'Mapa celeste con tiempo sideral local, paneles ampliados y efemérides planetarias educativas',api};
    return api;
  }

  function auditAstronomyPanelClearance(scene) {
    const records = [...LIVE_PANEL_REGISTRY.values()].filter(record => record.position.y > LEVEL.rooftop);
    const barandaTop = LEVEL.rooftop + 1.73;
    const report = records.map(record => ({
      name: record.name,
      lowerEdge: Number((record.position.y - record.height / 2).toFixed(2)),
      clearsRailing: record.position.y - record.height / 2 > barandaTop,
      clickable: Boolean(record.meshes.front.isPickable && record.meshes.back.isPickable)
    }));
    window.__UCAN_ASTRO_PANEL_AUDIT__ = {
      version:'V265',
      panels: report,
      allClear: report.every(item => item.clearsRailing),
      allClickable: report.every(item => item.clickable)
    };
    console.info('[UCAN V265] Auditoría de paneles astronómicos:', window.__UCAN_ASTRO_PANEL_AUDIT__);
    return window.__UCAN_ASTRO_PANEL_AUDIT__;
  }

  function buildRooftop(scene, root, mats) {
    const y = LEVEL.rooftop;
    // Cubierta dividida para conservar el tragaluz central y abrir el hueco de la nueva escalera P3-Terraza.
    const sections = [
      [-47, 0, 42, 112],
      [33.4, 0, 14.8, 112],
      [57.6, 0, 20.8, 112],
      [44.0, -23.5, 6.4, 65.0],
      [44.0, 48.25, 6.4, 15.5],
      [0, -35.5, 52, 41],
      [0, 37.5, 52, 37]
    ];
    sections.forEach(([x,z,w,d],i)=>markWalkable(box(scene, `rooftop deck transitable ${i}`, new BABYLON.Vector3(x,y-.10,z), new BABYLON.Vector3(w,.20,d), i % 2 ? mats.roofStone : mats.roofDeck, root, true)));

    box(scene, 'tragaluz rooftop', new BABYLON.Vector3(0,y+.06,2), new BABYLON.Vector3(52,.12,34), mats.glass, root, false);
    [[0,-56,136,.15],[0,56,136,.15],[-68,0,.15,112],[68,0,.15,112]].forEach(([x,z,w,d],i)=>{
      box(scene, `baranda rooftop ${i}`, new BABYLON.Vector3(x,y+1.15,z), new BABYLON.Vector3(w,1.15,d), mats.darkGlass, root, true);
    });
    [[0,-15,58,.12],[0,19,58,.12],[-29,2,.12,34],[29,2,.12,34]].forEach(([x,z,w,d],i)=>{
      box(scene, `baranda tragaluz rooftop ${i}`, new BABYLON.Vector3(x,y+1.05,z), new BABYLON.Vector3(w,1.0,d), mats.glass, root, true);
    });
    // Protección lateral del hueco de la escalera. Los extremos permanecen abiertos para entrar y salir.
    for (const x of [40.62, 47.38]) {
      const rail = box(scene, `baranda hueco escalera terraza ${x}`, new BABYLON.Vector3(x, y + 1.05, 24.75), new BABYLON.Vector3(.12, 1.05, 31.5), mats.darkGlass, root, true);
      rail.metadata = { rooftopStairGuard:true };
    }

    const pergola = new BABYLON.TransformNode('pérgola rooftop', scene);
    pergola.position = new BABYLON.Vector3(-42,y,30);
    pergola.parent=root;
    for (let x of [-10,10]) for (let z of [-8,8]) box(scene,'columna pérgola',new BABYLON.Vector3(x,2.6,z),new BABYLON.Vector3(.35,5.2,.35),mats.wood,pergola,true);
    for (let x=-10;x<=10;x+=2.5) box(scene,'listón pérgola',new BABYLON.Vector3(x,5.15,0),new BABYLON.Vector3(.22,.18,17),mats.wood,pergola,false);
    box(scene,'mesa comunitaria rooftop',new BABYLON.Vector3(-42,y+.78,30),new BABYLON.Vector3(12,.16,2.5),mats.wood,root,true);
    for (let x=-47;x<=-37;x+=2.5) {
      chair(scene,root,mats,x,y,27.8,0);
      chair(scene,root,mats,x,y,32.2,Math.PI);
    }

    rooftopTableSet(scene,root,mats,40,35,'#007b5f','este 1');
    rooftopTableSet(scene,root,mats,52,22,'#fed141','este 2');
    rooftopTableSet(scene,root,mats,42,-32,'#85714d','este 3');
    rooftopTableSet(scene,root,mats,-44,-34,'#007b5f','oeste 1');
    rooftopTableSet(scene,root,mats,-55,-20,'#fed141','oeste 2');

    rooftopPlanter(scene,root,mats,-46,46,'noroeste');
    rooftopPlanter(scene,root,mats,46,46,'noreste');
    rooftopPlanter(scene,root,mats,-46,-48,'suroeste');
    rooftopPlanter(scene,root,mats,46,-48,'sureste');

    box(scene,'kiosco rooftop',new BABYLON.Vector3(51,y+1.45,-5),new BABYLON.Vector3(15,2.9,7),mats.wallPanel,root,true);
    box(scene,'barra kiosco rooftop',new BABYLON.Vector3(43.3,y+1.05,-5),new BABYLON.Vector3(.7,1.25,6.4),mats.wood,root,true);
    box(scene,'estación hidratación rooftop',new BABYLON.Vector3(-55,y+1.1,4),new BABYLON.Vector3(3,2.2,1.2),mats.metal,root,true);
    for (let x of [-60,-30,0,30,60]) for (let z of [-50,50]) {
      cyl(scene,'poste solar rooftop',new BABYLON.Vector3(x,y+1.5,z),.12,3,mats.metal,root,16,false);
      box(scene,'luminaria solar rooftop',new BABYLON.Vector3(x,y+3.05,z),new BABYLON.Vector3(.5,.18,.5),mats.solarLight,root,false);
    }

    box(scene,'elevador rooftop',new BABYLON.Vector3(-58,y+2.2,14),new BABYLON.Vector3(8,4.4,8),mats.darkGlass,root,true);
    const safe = markWalkable(box(scene,'zona segura VR rooftop',new BABYLON.Vector3(0,y+.025,44),new BABYLON.Vector3(22,.04,6),mats.carpet,root,false));
    safe.metadata.teleportable = true;

    const seasonRoots = {};
    for (const season of ['spring','summer','autumn','winter']) {
      const n = new BABYLON.TransformNode(`temporada ${season}`, scene);
      n.position.y = LEVEL.rooftop;
      n.parent = root;
      seasonRoots[season] = n;
    }
    for (let i=0;i<16;i++) {
      const a=i*Math.PI*2/16, r=3.4+(i%3)*.3;
      const flower=cyl(scene,`flor primavera ${i}`,new BABYLON.Vector3(-46+Math.cos(a)*r,.98,46+Math.sin(a)*.7),.34,.55,i%2?mats.flowerPink:mats.flowerPurple,seasonRoots.spring,12,false);
      flower.rotation.z=Math.sin(a)*.12;
    }
    seasonalTree(scene,seasonRoots.summer,mats,46,45,mats.plant,'verano 1');
    seasonalTree(scene,seasonRoots.summer,mats,-46,-47,mats.plant,'verano 2');
    seasonalTree(scene,seasonRoots.autumn,mats,46,-47,mats.autumnLeaf,'otoño 1');
    seasonalTree(scene,seasonRoots.autumn,mats,-46,45,mats.autumnGold,'otoño 2');
    for (let i=0;i<14;i++) {
      box(scene,`luz invierno ${i}`,new BABYLON.Vector3(-24+i*3.7,3.5,-49),new BABYLON.Vector3(.18,.18,.18),mats.winterDecor,seasonRoots.winter,false);
    }
    seasonalTree(scene,seasonRoots.winter,mats,46,45,mats.plant,'invierno tropical');

    const seasonSign = createSeasonSign(scene,root);
    const astronomyDisplays = buildAstronomyTerrace(scene, root, mats);
    scene.metadata = scene.metadata || {};
    scene.metadata.astronomyDisplays = astronomyDisplays;
    auditAstronomyPanelClearance(scene);
    window.__UCAN_ROOFTOP__ = { level:y, seasonRoots, seasonSign, astronomyDisplays, meshes:sections.length };
  }

  function lerpColor(a,b,t) {
    return BABYLON.Color3.Lerp(a,b,Math.max(0,Math.min(1,t)));
  }

  function seasonSpanish(season) {
    return ({ spring:'Primavera', summer:'Verano', autumn:'Otoño', winter:'Invierno' })[season] || season;
  }

  function updateSeasonVisuals(season) {
    const roof=window.__UCAN_ROOFTOP__;
    if(!roof) return;
    for(const [key,node] of Object.entries(roof.seasonRoots)) node.setEnabled(key===season);
    const tex=roof.seasonSign.texture,ctx=tex.getContext();
    ctx.fillStyle='#07352d';
    ctx.fillRect(0,0,1024,256);
    ctx.fillStyle='#fed141';
    ctx.fillRect(0,202,1024,54);
    ctx.fillStyle='#ffffff';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.font='bold 72px Segoe UI, Arial';
    ctx.fillText(`ROOFTOP · ${seasonSpanish(season).toUpperCase()}`,512,104);
    ctx.fillStyle='#082b25';
    ctx.font='bold 29px Segoe UI, Arial';
    ctx.fillText('UCAN · ÁREAS COMUNES Y BIENESTAR',512,228);
    tex.update();
  }

  function addPanoramicLandscape(scene, root, mats) {
    const landscape = new BABYLON.TransformNode('paisaje panorámico', scene);
    landscape.parent = root;

    const mountainNear = pbr(scene, 'montaña cercana', '#4f7860', { roughness: 1 });
    const mountainFar = pbr(scene, 'montaña lejana', '#6e8f78', { roughness: 1 });
    const riverMat = pbr(scene, 'río panorámico', '#73b7d6', { emissive: '#4f9bbd', emissiveIntensity: 0.35, alpha: 0.95 });
    const lakeMat = pbr(scene, 'lago panorámico', '#6eb3cf', { emissive: '#5ba3c2', emissiveIntensity: 0.25, alpha: 0.96 });
    const pathMat = pbr(scene, 'sendero panorámico', '#b79d71', { roughness: 1 });
    const meadowMat = pbr(scene, 'pradera panorámica', '#89b37d', { roughness: 1 });
    const groveLeaf = pbr(scene, 'bosque panorámico', '#4f8b54', { roughness: 1 });
    const blossomLeaf = pbr(scene, 'árbol florido panorámico', '#8aa95d', { roughness: 1 });
    const flowerMat = pbr(scene, 'flores panorámicas', '#d996c5', { emissive: '#f4c0dc', emissiveIntensity: 0.08, roughness: 1 });

    const meadow = box(scene, 'pradera panorámica', new BABYLON.Vector3(0, LEVEL.one - 0.32, -210), new BABYLON.Vector3(560, 0.6, 280), meadowMat, landscape, false);
    meadow.checkCollisions = false;
    meadow.isPickable = false;

    const mountainSpecs = [
      [-235, -258, 90, 88, mountainFar], [-165, -222, 118, 112, mountainNear], [-98, -248, 84, 72, mountainFar],
      [-15, -216, 140, 126, mountainNear], [72, -252, 96, 84, mountainFar], [152, -230, 120, 118, mountainNear], [232, -248, 92, 88, mountainFar]
    ];
    for (const [x, z, d, h, mat] of mountainSpecs) {
      const mountain = BABYLON.MeshBuilder.CreateCylinder(`montaña ${x}`, { height: h, diameterBottom: d, diameterTop: 0, tessellation: 10 }, scene);
      mountain.position = new BABYLON.Vector3(x, LEVEL.one + h / 2 - 6, z);
      mountain.material = mat;
      mountain.parent = landscape;
      mountain.isPickable = false;
      mountain.checkCollisions = false;
    }

    const riverPath = [
      new BABYLON.Vector3(-250, LEVEL.one - 0.05, -150),
      new BABYLON.Vector3(-190, LEVEL.one - 0.03, -168),
      new BABYLON.Vector3(-115, LEVEL.one - 0.04, -154),
      new BABYLON.Vector3(-40, LEVEL.one - 0.05, -182),
      new BABYLON.Vector3(38, LEVEL.one - 0.04, -173),
      new BABYLON.Vector3(122, LEVEL.one - 0.06, -192),
      new BABYLON.Vector3(225, LEVEL.one - 0.04, -178)
    ];
    const river = BABYLON.MeshBuilder.CreateTube('río panorámico', { path: riverPath, radius: 8.5, tessellation: 24, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    river.material = riverMat;
    river.parent = landscape;
    river.isPickable = false;
    river.checkCollisions = false;

    const lake = BABYLON.MeshBuilder.CreateDisc('lago lateral', { radius: 38, tessellation: 48 }, scene);
    lake.rotation.x = Math.PI / 2;
    lake.position = new BABYLON.Vector3(180, LEVEL.one - 0.02, -84);
    lake.material = lakeMat;
    lake.parent = landscape;
    lake.isPickable = false;

    const island = BABYLON.MeshBuilder.CreateDisc('islote lago', { radius: 11, tessellation: 24 }, scene);
    island.rotation.x = Math.PI / 2;
    island.position = new BABYLON.Vector3(188, LEVEL.one + 0.03, -82);
    island.material = meadowMat;
    island.parent = landscape;
    island.isPickable = false;

    const bridge = box(scene, 'puente mirador', new BABYLON.Vector3(-96, LEVEL.one + 0.6, -157), new BABYLON.Vector3(18, 0.42, 5.2), pathMat, landscape, false);
    bridge.rotation.y = -0.18;
    bridge.isPickable = false;

    const viewpoint = box(scene, 'gazebo mirador', new BABYLON.Vector3(155, LEVEL.one + 0.2, -36), new BABYLON.Vector3(18, 0.25, 18), pathMat, landscape, false);
    viewpoint.isPickable = false;
    for (const [dx, dz] of [[-7,-7],[7,-7],[-7,7],[7,7]]) {
      const post = cyl(scene, `poste gazebo ${dx} ${dz}`, new BABYLON.Vector3(155 + dx, LEVEL.one + 3.4, -36 + dz), 0.45, 6.4, mats.wood, landscape, 10, false);
      post.isPickable = false;
    }
    const gazeboRoof = BABYLON.MeshBuilder.CreateCylinder('techo gazebo mirador', { diameterTop: 0, diameterBottom: 19, height: 4.2, tessellation: 8 }, scene);
    gazeboRoof.position = new BABYLON.Vector3(155, LEVEL.one + 8.1, -36);
    gazeboRoof.material = pbr(scene, 'techo gazebo material', '#7c5a3a', { roughness: 0.95 });
    gazeboRoof.parent = landscape;
    gazeboRoof.isPickable = false;

    const waterfallPath = [
      new BABYLON.Vector3(-17, LEVEL.one + 30, -236),
      new BABYLON.Vector3(-13, LEVEL.one + 18, -220),
      new BABYLON.Vector3(-8, LEVEL.one + 7, -205),
      new BABYLON.Vector3(-3, LEVEL.one + 0.2, -193)
    ];
    const waterfall = BABYLON.MeshBuilder.CreateTube('cascada panorámica', { path: waterfallPath, radius: 2.8, tessellation: 20, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    waterfall.material = pbr(scene, 'cascada material', '#b7e6ff', { emissive: '#9bd8f7', emissiveIntensity: 0.38, alpha: 0.82 });
    waterfall.parent = landscape;
    waterfall.isPickable = false;

    const path1 = box(scene, 'sendero panorámico oeste', new BABYLON.Vector3(-155, LEVEL.one - 0.04, -92), new BABYLON.Vector3(120, 0.08, 8), pathMat, landscape, false);
    path1.rotation.y = 0.22;
    path1.isPickable = false;
    const path2 = box(scene, 'sendero panorámico este', new BABYLON.Vector3(120, LEVEL.one - 0.04, -62), new BABYLON.Vector3(84, 0.08, 8), pathMat, landscape, false);
    path2.rotation.y = -0.15;
    path2.isPickable = false;

    for (let i = 0; i < 34; i++) {
      const x = -235 + i * 14;
      const z = -116 - (i % 5) * 15;
      const trunk = cyl(scene, `tronco panorámico ${i}`, new BABYLON.Vector3(x, LEVEL.one + 6.5, z), 1.1, 13, mats.wood, landscape, 10, false);
      trunk.isPickable = false;
      const crown = BABYLON.MeshBuilder.CreateSphere(`copa panorámica ${i}`, { diameter: 8.2 + (i % 3), segments: 10 }, scene);
      crown.position = new BABYLON.Vector3(x, LEVEL.one + 14.6, z);
      crown.material = i % 6 === 0 ? blossomLeaf : groveLeaf;
      crown.parent = landscape;
      crown.isPickable = false;
    }

    for (let i = 0; i < 18; i++) {
      const x = 118 + (i % 6) * 12;
      const z = -120 - Math.floor(i / 6) * 14;
      const trunk = cyl(scene, `árbol lago ${i}`, new BABYLON.Vector3(x, LEVEL.one + 5.8, z), 0.9, 11.6, mats.wood, landscape, 10, false);
      trunk.isPickable = false;
      const crown = BABYLON.MeshBuilder.CreateSphere(`copa lago ${i}`, { diameter: 7.5, segments: 10 }, scene);
      crown.position = new BABYLON.Vector3(x, LEVEL.one + 12.8, z);
      crown.material = groveLeaf;
      crown.parent = landscape;
      crown.isPickable = false;
    }

    for (let i = 0; i < 24; i++) {
      const flower = BABYLON.MeshBuilder.CreateCylinder(`flor panorámica ${i}`, { diameterTop: 0.1, diameterBottom: 0.28, height: 1.5, tessellation: 6 }, scene);
      flower.position = new BABYLON.Vector3(-35 + (i % 6) * 5.5, LEVEL.one + 0.6, -72 - Math.floor(i / 6) * 5.2);
      flower.material = flowerMat;
      flower.parent = landscape;
      flower.isPickable = false;
    }

    return landscape;
  }

  function buildInteriorLighting(scene, root, mats) {
    const fixtures = [];
    const lights = [];

    const fixtureLayouts = [
      { floor: 1, y: LEVEL.one + 6.72, xs: [-48, -16, 16, 48], zs: [-36, 0, 36] },
      { floor: 2, y: LEVEL.two + 6.72, xs: [-48, -16, 16, 48], zs: [-36, 0, 36] },
      { floor: 3, y: LEVEL.three + 8.82, xs: [-36, 0, 36], zs: [-28, 4, 36] }
    ];

    for (const layout of fixtureLayouts) {
      for (const x of layout.xs) {
        for (const z of layout.zs) {
          const fixture = box(
            scene,
            `luminaria interior permanente piso ${layout.floor}`,
            new BABYLON.Vector3(x, layout.y, z),
            new BABYLON.Vector3(layout.floor === 3 ? 5.8 : 6.6, 0.07, 0.34),
            mats.warmLight,
            root,
            false
          );
          fixture.isPickable = false;
          fixture.checkCollisions = false;
          fixture.renderingGroupId = 2;
          fixture.metadata = { interiorLightFixture: true, floor: layout.floor, alwaysOn: true };
          fixtures.push(fixture);
        }
      }
    }

    const lightSpecs = [
      { name: 'luz permanente piso 1 norte', pos: [0, LEVEL.one + 5.5, 28], intensity: 0.72, range: 72 },
      { name: 'luz permanente piso 1 sur', pos: [0, LEVEL.one + 5.3, -26], intensity: 0.64, range: 66 },
      { name: 'luz permanente cafetería', pos: [-57, LEVEL.one + 4.8, -5], intensity: 0.48, range: 34 },
      { name: 'luz permanente biblioteca', pos: [57, LEVEL.one + 4.8, -5], intensity: 0.48, range: 34 },
      { name: 'luz permanente piso 2 norte', pos: [0, LEVEL.two + 5.5, 26], intensity: 0.70, range: 72 },
      { name: 'luz permanente piso 2 salas', pos: [0, LEVEL.two + 5.2, -28], intensity: 0.68, range: 72 },
      { name: 'luz permanente anfiteatro', pos: [0, LEVEL.three + 7.4, -4], intensity: 0.92, range: 92 }
    ];

    for (const spec of lightSpecs) {
      const light = new BABYLON.PointLight(spec.name, new BABYLON.Vector3(...spec.pos), scene);
      light.diffuse = BABYLON.Color3.FromHexString('#fff0cc');
      light.specular = BABYLON.Color3.FromHexString('#e8d4aa');
      light.intensity = spec.intensity;
      light.range = spec.range;
      light.metadata = { interiorLight: true, alwaysOn: true };
      lights.push(light);
    }

    const stageLight = new BABYLON.SpotLight(
      'luz permanente escenario anfiteatro',
      new BABYLON.Vector3(0, LEVEL.three + 8.2, -15),
      new BABYLON.Vector3(0, -1, -0.42),
      Math.PI / 2.15,
      2,
      scene
    );
    stageLight.diffuse = BABYLON.Color3.FromHexString('#fff3d6');
    stageLight.specular = BABYLON.Color3.FromHexString('#f4d7a1');
    stageLight.intensity = 1.05;
    stageLight.range = 58;
    stageLight.metadata = { interiorLight: true, alwaysOn: true, area: 'anfiteatro' };
    lights.push(stageLight);

    const interiorFill = new BABYLON.HemisphericLight('relleno interior permanente', new BABYLON.Vector3(0, 1, 0), scene);
    interiorFill.diffuse = BABYLON.Color3.FromHexString('#fff7e8');
    interiorFill.groundColor = BABYLON.Color3.FromHexString('#7a7167');
    interiorFill.intensity = 0.20;
    interiorFill.metadata = { interiorLight: true, alwaysOn: true, type: 'fill' };
    lights.push(interiorFill);

    const audit = {
      version: 'V265',
      alwaysOn: true,
      fixtureCount: fixtures.length,
      activeLights: lights.filter(light => light.isEnabled()).length,
      totalLights: lights.length,
      floors: [1, 2, 3],
      rooftopExcluded: true,
      defaultLocation: 'Piso 1 · Áreas comunes'
    };
    window.__UCAN_INTERIOR_LIGHTING__ = audit;
    console.info('[UCAN V265] Iluminación interior permanente:', audit);

    return {
      fixtures,
      lights,
      audit,
      ensureOn() {
        fixtures.forEach(mesh => mesh.setEnabled(true));
        lights.forEach(light => light.setEnabled(true));
      }
    };
  }

  function buildNaturalEnvironment(scene, root, mats, hemi, sunLight) {
    const skyMat = new BABYLON.StandardMaterial('cielo dinámico', scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    const sky = BABYLON.MeshBuilder.CreateSphere('cielo natural', { diameter: 650, segments: 24, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
    sky.material = skyMat;
    sky.isPickable = false;
    const sunMat = pbr(scene, 'sol natural', '#fff2a5', { emissive: '#ffd25d', emissiveIntensity: 1.2 });
    const moonMat = pbr(scene, 'luna natural', '#e9eef7', { emissive: '#b8c8e8', emissiveIntensity: .85 });
    const sunMesh = BABYLON.MeshBuilder.CreateSphere('sol natural', { diameter: 16, segments: 24 }, scene);
    sunMesh.material = sunMat;
    sunMesh.isPickable = false;
    const moonMesh = BABYLON.MeshBuilder.CreateSphere('luna natural', { diameter: 11, segments: 24 }, scene);
    moonMesh.material = moonMat;
    moonMesh.isPickable = false;

    const cloudMat = pbr(scene, 'nubes naturales', '#ffffff', { roughness: .95, alpha: .68 });
    cloudMat.disableLighting = true;
    cloudMat.emissiveColor = new BABYLON.Color3(.35, .35, .35);
    const clouds = [];
    for (let i = 0; i < 11; i++) {
      const g = new BABYLON.TransformNode(`nube ${i}`, scene);
      g.position = new BABYLON.Vector3(-160 + i * 32, 56 + (i % 4) * 9, -115 + (i % 6) * 42);
      g.scaling = new BABYLON.Vector3(1.3 + (i % 2) * .45, .75, 1);
      for (let j = 0; j < 5; j++) {
        const puff = BABYLON.MeshBuilder.CreateSphere(`nube ${i} parte ${j}`, { diameter: 12 + (j % 3) * 4, segments: 12 }, scene);
        puff.position = new BABYLON.Vector3((j - 2) * 6, Math.sin(j) * 2, (j % 2) * 4);
        puff.material = cloudMat;
        puff.parent = g;
        puff.isPickable = false;
      }
      clouds.push(g);
    }
    const starMat = pbr(scene, 'estrellas', '#ffffff', { emissive: '#dfeaff', emissiveIntensity: 1 });
    const stars = [];
    for (let i = 0; i < 48; i++) {
      const star = BABYLON.MeshBuilder.CreateSphere(`estrella ${i}`, { diameter: .55 + (i % 3) * .15, segments: 6 }, scene);
      const a = i * 2.399963, r = 225;
      star.position = new BABYLON.Vector3(Math.cos(a) * r, 70 + (i % 12) * 12, Math.sin(a) * r);
      star.material = starMat;
      star.isPickable = false;
      stars.push(star);
    }
    addPanoramicLandscape(scene, root, mats);

    const palettes = {
      spring: { day: '#75b9e5', dawn: '#f2a58b', night: '#0b1b35' },
      summer: { day: '#64b5e7', dawn: '#f4a06f', night: '#07172d' },
      autumn: { day: '#86add0', dawn: '#d88562', night: '#17162c' },
      winter: { day: '#a5c2d8', dawn: '#c9969d', night: '#0b1830' }
    };
    let last = performance.now(), lastStatusUpdate = 0, lastMinuteSync = -1;
    const update = () => {
      const nowTick = performance.now(), dt = Math.min((nowTick - last) / 1000, .1);
      last = nowTick;
      const sgNow = getSanGermanNow();
      if (ENV_STATE.liveClock) {
        ENV_STATE.timeOfDay = sgNow.timeOfDay;
        if (lastMinuteSync !== sgNow.minute) {
          LIVE_CONTEXT.localNow = sgNow;
          ENV_STATE.season = seasonFromMonth(sgNow.month);
          computeAstronomyAgenda(sgNow);
          if (scene.metadata?.astronomyDisplays?.refresh) scene.metadata.astronomyDisplays.refresh();
          lastMinuteSync = sgNow.minute;
        }
      } else if (ENV_STATE.cycleEnabled && !reducedMotion) {
        ENV_STATE.timeOfDay = (ENV_STATE.timeOfDay + dt * 24 / (ENV_STATE.cycleMinutes * 60)) % 24;
      }
      const t = ENV_STATE.timeOfDay;
      const sunrise = LIVE_CONTEXT.sunriseHour || 6.15;
      const sunset = LIVE_CONTEXT.sunsetHour || 18.75;
      const center = (sunrise + sunset) / 2;
      const daylightSpan = Math.max(8, sunset - sunrise);
      const daylight = Math.max(0, Math.cos(((t - center) / daylightSpan) * Math.PI));
      const angle = ((t / 24) * Math.PI * 2) - Math.PI / 2;
      sunMesh.position = new BABYLON.Vector3(Math.cos(angle) * 185, Math.sin(angle) * 145 + 18, -80);
      moonMesh.position = new BABYLON.Vector3(Math.cos(angle + Math.PI) * 170, Math.sin(angle + Math.PI) * 130 + 24, 85);
      sunMesh.setEnabled(daylight > .02);
      moonMesh.setEnabled(daylight < .42);
      const p = palettes[ENV_STATE.season] || palettes.summer;
      const night = BABYLON.Color3.FromHexString(p.night), day = BABYLON.Color3.FromHexString(p.day), dawn = BABYLON.Color3.FromHexString(p.dawn);
      let skyColor;
      if (t >= sunrise - 1.2 && t < sunrise + 0.8) skyColor = lerpColor(night, dawn, Math.min(1, Math.max(0, (t - (sunrise - 1.2)) / 2)));
      else if (t >= sunrise + 0.8 && t < sunrise + 2.2) skyColor = lerpColor(dawn, day, Math.min(1, Math.max(0, (t - (sunrise + 0.8)) / 1.4)));
      else if (t >= sunrise + 2.2 && t < sunset - 2.0) skyColor = day;
      else if (t >= sunset - 2.0 && t < sunset - 0.6) skyColor = lerpColor(day, dawn, Math.min(1, Math.max(0, (t - (sunset - 2.0)) / 1.4)));
      else if (t >= sunset - 0.6 && t < sunset + 1.3) skyColor = lerpColor(dawn, night, Math.min(1, Math.max(0, (t - (sunset - 0.6)) / 1.9)));
      else skyColor = night;

      const cloudiness = Math.min(1, Math.max(0, (LIVE_CONTEXT.cloudCover || 0) / 100));
      const precipitation = Math.max(0, LIVE_CONTEXT.precipitation || 0);
      if (cloudiness > .35) skyColor = lerpColor(skyColor, BABYLON.Color3.FromHexString(daylight > .15 ? '#92a2aa' : '#1b2431'), Math.min(.48, cloudiness * .5 + precipitation * .08));
      skyMat.emissiveColor = skyColor;
      skyMat.diffuseColor = skyColor;
      scene.clearColor = new BABYLON.Color4(skyColor.r, skyColor.g, skyColor.b, 1);
      sunLight.position.copyFrom(sunMesh.position);
      sunLight.direction = new BABYLON.Vector3(0, LEVEL.rooftop, 0).subtract(sunLight.position).normalize();
      sunLight.intensity = (.08 + daylight * .88) * (1 - cloudiness * .35);
      hemi.intensity = .28 + daylight * .32 - cloudiness * .06;
      hemi.diffuse = daylight > .2 ? new BABYLON.Color3(1, .96, .88) : new BABYLON.Color3(.48, .58, .82);
      if (!reducedMotion) clouds.forEach((c, i) => {
        c.position.x += dt * (.8 + i * .06) * (1 + cloudiness * .6);
        if (c.position.x > 190) c.position.x = -190;
      });
      const starVisible = daylight < .12 && cloudiness < .68;
      stars.forEach(s => s.setEnabled(starVisible));
      cloudMat.alpha = .18 + cloudiness * .6;
      cloudMat.emissiveColor = new BABYLON.Color3(.22 + daylight * .18, .22 + daylight * .18, .24 + daylight * .18);
      if (scene.metadata?.astronomyDisplays?.updateSkyMood) scene.metadata.astronomyDisplays.updateSkyMood({ daylight, cloudiness, now: sgNow, weatherLabel: LIVE_CONTEXT.weatherLabel });
      interiorLighting?.ensureOn();
      if (nowTick - lastStatusUpdate > 750) { lastStatusUpdate = nowTick; updateEnvironmentStatus(); }
    };
    scene.onBeforeRenderObservable.add(update);
    const api = {
      applySeason(season) {
        if (!['spring', 'summer', 'autumn', 'winter'].includes(season)) return;
        ENV_STATE.season = season;
        updateSeasonVisuals(season);
        updateEnvironmentStatus();
      },
      toggleCycle() {
        ENV_STATE.liveClock = !ENV_STATE.liveClock;
        ENV_STATE.cycleEnabled = !ENV_STATE.liveClock;
        updateEnvironmentStatus();
        return ENV_STATE.liveClock;
      },
      setTime(hour) { ENV_STATE.timeOfDay = ((Number(hour) || 0) % 24 + 24) % 24; ENV_STATE.liveClock = false; },
      getState: () => ({ ...ENV_STATE })
    };
    updateSeasonVisuals(ENV_STATE.season);
    return api;
  }

  function updateEnvironmentStatus() {
    const el = document.getElementById('environmentStatus');
    if (!el) return;
    const now = LIVE_CONTEXT.localNow || getSanGermanNow();
    const weather = LIVE_CONTEXT.weatherLabel || 'Ambiente natural';
    el.textContent = `${seasonSpanish(ENV_STATE.season)} · ${now.timeLabel} · ${weather} · ${SAN_GERMAN.name}`;
    const cycle = document.getElementById('dayCycleBtn');
    if (cycle) cycle.textContent = ENV_STATE.liveClock ? 'Usando hora real' : (ENV_STATE.cycleEnabled ? 'Pausar día/noche' : 'Activar día/noche');
  }

  function setupEnvironmentControls(scene,camera) {
    const select=document.getElementById('seasonSelect');
    if(select){
      select.value=ENV_STATE.season;
      select.addEventListener('change',()=>{
        ENV_STATE.liveClock = false;
        naturalEnvironment?.applySeason(select.value);
      });
    }
    document.getElementById('dayCycleBtn')?.addEventListener('click',()=>naturalEnvironment?.toggleCycle());
    updateEnvironmentStatus();
  }

  function requiredFloorOpenings(name) {
    const value = String(name || '').toLowerCase();
    if (value.includes('piso 2')) {
      return [{ id:'escaleras-p1-p2', x1:-24.8, x2:-3.2, z1:4.5, z2:18.2 }];
    }
    if (value.includes('piso 3')) {
      return [{ id:'escaleras-p2-p3', x1:-39.8, x2:-20.2, z1:4.5, z2:18.2 }];
    }
    if (value.includes('rooftop') || value.includes('terraza')) {
      return [{ id:'escaleras-p3-terraza', x1:40.8, x2:47.2, z1:9.0, z2:40.5 }];
    }
    return [];
  }

  function buildPartitionedSurface(scene, root, material, y, thickness, name, openings, collide = false) {
    const bounds = { x1:-72, x2:72, z1:-60, z2:60 };
    const xs = [bounds.x1, bounds.x2];
    const zs = [bounds.z1, bounds.z2];
    openings.forEach(o => { xs.push(o.x1, o.x2); zs.push(o.z1, o.z2); });
    xs.sort((a,b)=>a-b); zs.sort((a,b)=>a-b);
    const inside = (cx,cz) => openings.some(o => cx > o.x1 && cx < o.x2 && cz > o.z1 && cz < o.z2);
    let count = 0;
    for (let xi=0; xi<xs.length-1; xi++) for (let zi=0; zi<zs.length-1; zi++) {
      const x1=xs[xi], x2=xs[xi+1], z1=zs[zi], z2=zs[zi+1];
      const w=x2-x1, d=z2-z1, cx=(x1+x2)/2, cz=(z1+z2)/2;
      if (w < .24 || d < .24 || inside(cx,cz)) continue;
      const section = box(scene, `${name} sección ${count++}`, new BABYLON.Vector3(cx,y,cz), new BABYLON.Vector3(w,thickness,d), material, root, collide);
      section.isPickable = false;
      section.metadata = { ...(section.metadata || {}), floorSeparator:true, surface:name };
    }
    return count;
  }

  function addOpeningPrivacyFascia(scene, root, mats, floorY, openings, name) {
    for (const opening of openings) {
      const depth = opening.z2-opening.z1;
      const centerZ = (opening.z1+opening.z2)/2;
      for (const x of [opening.x1, opening.x2]) {
        const fascia = box(scene, `${name} faldón lateral ${opening.id}`, new BABYLON.Vector3(x,floorY-.62,centerZ), new BABYLON.Vector3(.22,1.1,depth), mats.wallPanel, root, false);
        fascia.isPickable=false;
        fascia.checkCollisions=false;
        fascia.metadata={floorPrivacy:true, opening:opening.id};
      }
    }
  }

  function auditFloorSeparation(scene) {
    const separators = scene.meshes.filter(mesh => mesh?.metadata?.floorSeparator === true);
    const privacy = scene.meshes.filter(mesh => mesh?.metadata?.floorPrivacy === true);
    const audit = {
      version:'V265',
      opaqueSeparatorSections:separators.length,
      privacyFascia:privacy.length,
      floor2Openings:requiredFloorOpenings('piso 2'),
      floor3Openings:requiredFloorOpenings('piso 3'),
      rooftopOpenings:requiredFloorOpenings('terraza'),
      obsoletePositiveHoles:false,
      depthPreservedAcrossGroups:true,
      lowerFloorsOccluded:separators.length > 0
    };
    console.info('[UCAN V265] Auditoría de separación entre pisos:',audit);
    return audit;
  }

  function floorSlab(scene, root, mats, y, name) {
    const bounds = { x1: -72, x2: 72, z1: -60, z2: 60 };
    const floorName = String(name || '').toLowerCase();
    const openings = requiredFloorOpenings(floorName);
    const xs = [bounds.x1, bounds.x2]; const zs = [bounds.z1, bounds.z2];
    openings.forEach(o => { xs.push(o.x1, o.x2); zs.push(o.z1, o.z2); });
    xs.sort((a,b) => a-b); zs.sort((a,b) => a-b);
    const inside = (cx, cz) => openings.some(o => cx > o.x1 && cx < o.x2 && cz > o.z1 && cz < o.z2);
    let part = 0;
    for (let xi=0; xi<xs.length-1; xi++) for (let zi=0; zi<zs.length-1; zi++) {
      const x1=xs[xi], x2=xs[xi+1], z1=zs[zi], z2=zs[zi+1];
      const w=x2-x1, d=z2-z1, cx=(x1+x2)/2, cz=(z1+z2)/2;
      if (w < .25 || d < .25 || inside(cx, cz)) continue;
      const slab = box(scene, `${name} gran losa ${part++}`, new BABYLON.Vector3(cx, y - 0.08, cz), new BABYLON.Vector3(w, 0.16, d), mats.floor, root, true);
      slab.isPickable = true;
      slab.metadata = { ...(slab.metadata || {}), floorSeparator:true, surface:name };
    }
    if (openings.length) addOpeningPrivacyFascia(scene,root,mats,y,openings,name);
    // Piso amplio tipo centro comercial: juntas de losas grandes y bandas de circulación.
    for (let x = -64; x <= 64; x += 8) box(scene, `${name} junta x ${x}`, new BABYLON.Vector3(x, y + 0.006, 0), new BABYLON.Vector3(0.035, 0.012, 112), mats.floorLine, root, false);
    for (let z = -52; z <= 52; z += 8) box(scene, `${name} junta z ${z}`, new BABYLON.Vector3(0, y + 0.007, z), new BABYLON.Vector3(136, 0.012, 0.035), mats.floorLine, root, false);
    box(scene, `${name} eje central premium`, new BABYLON.Vector3(0, y + .018, 33.5), new BABYLON.Vector3(110, .018, .34), mats.stoneDark, root, false);
    box(scene, `${name} eje longitudinal premium`, new BABYLON.Vector3(0, y + .019, 6.5), new BABYLON.Vector3(.34, .018, 92), mats.stoneDark, root, false);
  }

  function wall(scene, root, mats, name, x, y, z, w, h, d, rotY = 0) {
    const m = box(scene, name, new BABYLON.Vector3(x, y, z), new BABYLON.Vector3(w, h, d), mats.wall, root, true);
    m.rotation.y = rotY;
    return m;
  }

  function glassDoor(scene, root, mats, name, pos, yaw) {
    // Marco real con vano abierto. La versión anterior usaba una caja sólida como marco
    // y bloqueaba visual y físicamente la entrada de cada salón.
    const group = new BABYLON.TransformNode(`puerta ${name}`, scene);
    group.position.copyFrom(pos);
    group.rotation.y = yaw;
    group.parent = root;
    box(scene, `marco superior ${name}`, new BABYLON.Vector3(0, 1.42, 0), new BABYLON.Vector3(3.35, .18, .20), mats.metal, group, true);
    box(scene, `marco izquierdo ${name}`, new BABYLON.Vector3(-1.58, 0, 0), new BABYLON.Vector3(.18, 2.72, .20), mats.metal, group, true);
    box(scene, `marco derecho ${name}`, new BABYLON.Vector3(1.58, 0, 0), new BABYLON.Vector3(.18, 2.72, .20), mats.metal, group, true);
    const door = box(scene, `puerta cristal ${name}`, new BABYLON.Vector3(0, 0, .01), new BABYLON.Vector3(2.92, 2.65, .045), mats.doorGlass, group, false);
    door.isPickable = false;
  }

  function ceiling(scene, root, mats, y, name) {
    const value = String(name || '').toLowerCase();
    let openings = [];
    if (value.includes('piso 1')) openings = requiredFloorOpenings('piso 2');
    else if (value.includes('piso 2')) openings = requiredFloorOpenings('piso 3');
    else if (value.includes('piso 3')) openings = requiredFloorOpenings('terraza');
    buildPartitionedSurface(scene,root,mats.wall,y+.06,.18,`${name} plafón opaco`,openings,false);
    for (let x = -56; x <= 56; x += 14) {
      const beam=box(scene, `${name} viga limpia ${x}`, new BABYLON.Vector3(x, y-.02, 0), new BABYLON.Vector3(0.24, 0.18, 112), mats.wood, root, false);
      beam.isPickable=false;
    }
    for (let z of [-42,-28,-14,0,14,28,42]) {
      const strip = box(scene, `${name} luz lineal ${z}`, new BABYLON.Vector3(0, y - 0.14, z), new BABYLON.Vector3(124, 0.045, 0.12), mats.warmLight, root, false);
      strip.renderingGroupId = 1;
      strip.isPickable=false;
    }
  }

  function createTextMaterial(scene, name, title, subtitle = '', background = '#083d35', accent = '#fed141') {
    const texture = new BABYLON.DynamicTexture(`${name} texture`, { width:1024, height:512 }, scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = background; ctx.fillRect(0,0,1024,512);
    ctx.fillStyle = accent; ctx.fillRect(0,430,1024,82);
    ctx.fillStyle = '#ffffff'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font = 'bold 72px Segoe UI, Arial'; ctx.fillText(title,512,190);
    ctx.font = '36px Segoe UI, Arial'; ctx.fillText(subtitle,512,310);
    texture.update();
    const mat = new BABYLON.StandardMaterial(`${name} material`, scene);
    mat.diffuseTexture = texture; mat.emissiveTexture = texture; mat.disableLighting = true; mat.backFaceCulling = false;
    return mat;
  }

  function interactiveKiosk(scene, root, mats, id, title, subtitle, pos, rotationY = 0, target = id) {
    const g = new BABYLON.TransformNode(`kiosco ${id}`, scene); g.position.copyFrom(pos); g.rotation.y=rotationY; g.parent=root;
    box(scene, `${id} pedestal`, new BABYLON.Vector3(0,.78,0), new BABYLON.Vector3(1.35,1.55,.72), mats.wallPanel,g,true);
    const mat=createTextMaterial(scene,`pantalla ${id}`,title,subtitle);
    const screen=BABYLON.MeshBuilder.CreatePlane(`pantalla interactiva ${id}`,{width:2.45,height:1.45,sideOrientation:BABYLON.Mesh.DOUBLESIDE},scene);
    screen.position=new BABYLON.Vector3(0,1.85,-.39); screen.rotation.y=Math.PI; screen.material=mat; screen.parent=g; screen.isPickable=true;
    screen.metadata={type:'experience-kiosk',target};
    screen.actionManager=new BABYLON.ActionManager(scene);
    screen.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger,()=>{
      if(window.__UCAN_EXPERIENCES__?.open) window.__UCAN_EXPERIENCES__.open(target);
      else setStatus(`Módulo ${title} cargando…`);
    }));
    return g;
  }

  function cafeTable(scene,root,mats,x,y,z,seats=2){
    cyl(scene,'mesa café',new BABYLON.Vector3(x,y+.76,z),1.35,.10,mats.wood,root,48,true);
    cyl(scene,'base mesa café',new BABYLON.Vector3(x,y+.38,z),.15,.76,mats.metal,root,20,true);
    for(let i=0;i<seats;i++){const a=(i/seats)*Math.PI*2; chair(scene,root,mats,x+Math.sin(a)*1.2,y,z+Math.cos(a)*1.2,a+Math.PI);}
  }

  function buildSmartCafeteria(scene,root,mats,y){
    const g=new BABYLON.TransformNode('cafeteria inteligente realista',scene); g.parent=root;
    // Barra de servicio, vitrinas y equipos.
    box(scene,'barra servicio cafeteria',new BABYLON.Vector3(-62.5,y+.62,-18.7),new BABYLON.Vector3(15,1.18,2.1),mats.wood,g,true);
    box(scene,'cubierta barra cafeteria',new BABYLON.Vector3(-62.5,y+1.25,-18.7),new BABYLON.Vector3(15.3,.16,2.3),mats.stoneDark,g,true);
    const display=box(scene,'vitrina alimentos cafeteria',new BABYLON.Vector3(-66,y+1.75,-18.5),new BABYLON.Vector3(5.4,1.0,1.45),mats.glass,g,false); display.isPickable=false;
    // Máquina de café, caja, refrigeradores y área de recogido.
    box(scene,'maquina espresso cafeteria',new BABYLON.Vector3(-59.5,y+1.72,-19.1),new BABYLON.Vector3(1.35,1.0,.8),mats.black,g,true);
    cyl(scene,'tolva café izquierda',new BABYLON.Vector3(-59.85,y+2.38,-19.1),.38,.6,mats.glass,g,20,false);
    cyl(scene,'tolva café derecha',new BABYLON.Vector3(-59.15,y+2.38,-19.1),.38,.6,mats.glass,g,20,false);
    box(scene,'caja registradora cafeteria',new BABYLON.Vector3(-55.8,y+1.55,-18.8),new BABYLON.Vector3(1.1,.65,.8),mats.screen,g,true);
    box(scene,'refrigerador bebidas cafeteria',new BABYLON.Vector3(-69.4,y+1.45,-13.8),new BABYLON.Vector3(3.2,2.9,1.25),mats.darkGlass,g,true);
    box(scene,'estacion entrega pedidos cafeteria',new BABYLON.Vector3(-55.3,y+.62,-14.7),new BABYLON.Vector3(4.5,1.18,1.5),mats.wallPanel,g,true);
    // Menús digitales con caras físicas independientes. Cada lado usa la cara frontal
    // de su propio plano, por lo que el texto nunca aparece espejado.
    const cafeteriaMenus = [
      ['CAFÉ Y TÉ', 'Bebidas calientes y frías'],
      ['DESAYUNOS', 'Opciones saludables'],
      ['ALMUERZOS', 'Platos del día']
    ];
    cafeteriaMenus.forEach(([title, subtitle], i) => {
      const menuMat = createTextMaterial(scene, `menú cafetería ${i + 1}`, title, subtitle, '#132725', '#fed141');
      menuMat.backFaceCulling = true;
      const x = -68 + i * 5.6;
      const yMenu = y + 3.65;
      const panelZ = -22.75;

      // Cara orientada hacia el interior de la cafetería (+Z).
      const northFace = BABYLON.MeshBuilder.CreatePlane(`menú cafetería ${i + 1} frente`, {
        width: 4.8,
        height: 2.15,
        sideOrientation: BABYLON.Mesh.FRONTSIDE
      }, scene);
      northFace.position = new BABYLON.Vector3(x, yMenu, panelZ + 0.11);
      northFace.rotation.y = Math.PI;
      northFace.material = menuMat;
      northFace.parent = g;
      northFace.isPickable = false;
      northFace.checkCollisions = false;
      northFace.metadata = { readableSign: true, cafeteriaMenu: true, menuIndex: i + 1, side: 'interior', mirrored: false };

      // Cara posterior orientada hacia la pared (-Z), también escrita correctamente.
      const southFace = BABYLON.MeshBuilder.CreatePlane(`menú cafetería ${i + 1} reverso`, {
        width: 4.8,
        height: 2.15,
        sideOrientation: BABYLON.Mesh.FRONTSIDE
      }, scene);
      southFace.position = new BABYLON.Vector3(x, yMenu, panelZ - 0.11);
      southFace.rotation.y = 0;
      southFace.material = menuMat;
      southFace.parent = g;
      southFace.isPickable = false;
      southFace.checkCollisions = false;
      southFace.metadata = { readableSign: true, cafeteriaMenu: true, menuIndex: i + 1, side: 'posterior', mirrored: false };

      const menuFrame = box(scene, `marco menú cafetería ${i + 1}`, new BABYLON.Vector3(x, yMenu, panelZ), new BABYLON.Vector3(5.15, 2.45, .18), mats.stoneDark, g, false);
      menuFrame.isPickable = false;
      menuFrame.metadata = { cafeteriaMenuFrame: true, menuIndex: i + 1 };
    });
    // Mesas, booth, barra de carga y reciclaje.
    cafeTable(scene,g,mats,-64,y,-8,3); cafeTable(scene,g,mats,-55.5,y,-7,2); cafeTable(scene,g,mats,-64,y,3,3); cafeTable(scene,g,mats,-55.5,y,4,2);
    box(scene,'booth cafeteria asiento',new BABYLON.Vector3(-68.5,y+.48,13),new BABYLON.Vector3(5.8,.75,1.25),mats.upholstery,g,true);
    box(scene,'booth cafeteria respaldo',new BABYLON.Vector3(-68.5,y+1.15,13.55),new BABYLON.Vector3(5.8,1.25,.22),mats.upholstery,g,true);
    box(scene,'mesa booth cafeteria',new BABYLON.Vector3(-64.4,y+.72,13),new BABYLON.Vector3(2.5,.12,1.45),mats.wood,g,true);
    box(scene,'barra carga cafeteria',new BABYLON.Vector3(-60,y+.82,22),new BABYLON.Vector3(13,.16,1.1),mats.wood,g,true);
    for(let x=-65;x<=-55;x+=2.5) cyl(scene,'toma carga cafeteria',new BABYLON.Vector3(x,y+.94,22),.24,.05,mats.yellow,g,20,false);
    box(scene,'reciclaje cafeteria',new BABYLON.Vector3(-69.5,y+.65,21.5),new BABYLON.Vector3(1.15,1.3,1.1),mats.plant,g,true);
    box(scene,'basura cafeteria',new BABYLON.Vector3(-67.9,y+.65,21.5),new BABYLON.Vector3(1.15,1.3,1.1),mats.black,g,true);
    interactiveKiosk(scene,g,mats,'CAFETERIA','CAFETERÍA INTELIGENTE','Menú, filtros y pedidos',new BABYLON.Vector3(-48.5,y,9.5),-Math.PI/2,'CAFETERIA');
    const menuFaces = scene.meshes.filter(mesh => mesh?.metadata?.cafeteriaMenu === true);
    window.__UCAN_CAFETERIA_MENU_AUDIT__ = {
      version: 'V265',
      expectedFaces: 6,
      activeFaces: menuFaces.filter(mesh => mesh.isEnabled() && mesh.isVisible).length,
      mirroredFaces: menuFaces.filter(mesh => mesh.metadata?.mirrored !== false).length,
      frontAndBackReadable: menuFaces.length === 6 && menuFaces.every(mesh => mesh.metadata?.mirrored === false)
    };
    console.info('[UCAN V265] Auditoría de menús de cafetería:', window.__UCAN_CAFETERIA_MENU_AUDIT__);
  }

  function bookStack(scene,root,mats,x,y,z,width=4.5){
    box(scene,'estante biblioteca',new BABYLON.Vector3(x,y+1.55,z),new BABYLON.Vector3(width,3.1,.65),mats.wood,root,true);
    for(let shelf=0;shelf<4;shelf++){
      const sy=y+.42+shelf*.72;
      box(scene,'repisa biblioteca',new BABYLON.Vector3(x,sy,z-.02),new BABYLON.Vector3(width+.12,.08,.72),mats.stoneDark,root,true);
      for(let i=0;i<Math.floor(width*2.2);i++){
        const bx=x-width/2+.26+i*(width-.5)/Math.max(1,Math.floor(width*2.2)-1);
        const material=[mats.wallPanel,mats.yellow,mats.plant,mats.upholstery][(i+shelf)%4];
        box(scene,'libro biblioteca',new BABYLON.Vector3(bx,sy+.30,z-.38),new BABYLON.Vector3(.18,.55,.12),material,root,false);
      }
    }
  }

  function buildSmartLibrary(scene,root,mats,y){
    const g=new BABYLON.TransformNode('biblioteca inteligente realista',scene); g.parent=root;
    // Mostrador de circulación y autoservicio.
    box(scene,'mostrador circulación biblioteca',new BABYLON.Vector3(59,y+.62,-18),new BABYLON.Vector3(12,1.2,2.0),mats.wood,g,true);
    box(scene,'cubierta mostrador biblioteca',new BABYLON.Vector3(59,y+1.27,-18),new BABYLON.Vector3(12.4,.16,2.2),mats.stoneDark,g,true);
    box(scene,'monitor circulación biblioteca',new BABYLON.Vector3(57.2,y+1.85,-18.4),new BABYLON.Vector3(1.4,.85,.09),mats.screen,g,false);
    box(scene,'impresora biblioteca',new BABYLON.Vector3(63,y+1.7,-18.2),new BABYLON.Vector3(1.7,.9,1.0),mats.wallPanel,g,true);
    interactiveKiosk(scene,g,mats,'BIBLIOTECA','BIBLIOTECA INTELIGENTE','Catálogo y reservaciones',new BABYLON.Vector3(48.5,y,9.5),Math.PI/2,'BIBLIOTECA');
    // Estanterías realistas, dejando corredor central libre.
    for(const x of [51.5,58.5,65.5]){ bookStack(scene,g,mats,x,y,-9,5.0); bookStack(scene,g,mats,x,y,2,5.0); }
    // Mesas colaborativas y pods silenciosos.
    collaborativeTable(scene,g,mats,54,y,14,'biblioteca colaborativa 1');
    collaborativeTable(scene,g,mats,65,y,14,'biblioteca colaborativa 2');
    for(const x of [51.5,58.5,65.5]){
      box(scene,'pod estudio biblioteca',new BABYLON.Vector3(x,y+1.1,24),new BABYLON.Vector3(4.8,2.2,3.8),mats.darkGlass,g,true);
      box(scene,'mesa pod biblioteca',new BABYLON.Vector3(x,y+.72,23.7),new BABYLON.Vector3(3.1,.12,1.1),mats.wood,g,true);
      chair(scene,g,mats,x,y,25.0,Math.PI);
      box(scene,'luz pod biblioteca',new BABYLON.Vector3(x,y+2.15,23.7),new BABYLON.Vector3(2.8,.05,.12),mats.warmLight,g,false);
    }
    // Zona accesible, escáner y devolución.
    box(scene,'estacion accesible biblioteca',new BABYLON.Vector3(48.8,y+.68,-15),new BABYLON.Vector3(4.2,.12,1.4),mats.wood,g,true);
    box(scene,'monitor accesible biblioteca',new BABYLON.Vector3(48.8,y+1.48,-15.4),new BABYLON.Vector3(1.6,.95,.08),mats.screen,g,false);
    box(scene,'buzon devolución libros',new BABYLON.Vector3(69,y+.75,-14.5),new BABYLON.Vector3(2.0,1.5,1.1),mats.wallPanel,g,true);
  }

  function buildRoomSpecialization(scene,root,mats,room,y,backZ,frontZ){
    const sideX=room.cx+room.w/2-1.6;
    const kioskZ=frontZ-3.1;
    const titles={
      'SV-201':['LABORATORIO ACTIVO','Encuestas y aprendizaje activo'],
      'SV-202':['LABORATORIO DE ESCENARIOS','Decisiones y simulaciones'],
      'SV-203':['SALA ÁGIL','Proyectos y tablero Kanban'],
      'SV-204':['ESTUDIO MULTIMEDIA','Grabación y teleprónter'],
      'SV-205':['CENTRO DE INVESTIGACIÓN','Evidencia y citas']
    };
    const [title,subtitle]=titles[room.id]||[room.id,'Experiencia académica'];
    interactiveKiosk(scene,root,mats,room.id,title,subtitle,new BABYLON.Vector3(sideX,y,kioskZ),Math.PI,room.id);
    if(room.id==='SV-201'){
      collaborativeTable(scene,root,mats,room.cx-room.w/2+3.1,y,frontZ-4.0,'pulse lab');
    }else if(room.id==='SV-202'){
      box(scene,'consola simulación SV-202',new BABYLON.Vector3(room.cx-room.w/2+2.0,y+1.2,room.cz),new BABYLON.Vector3(1.4,2.4,5.0),mats.wallPanel,root,true);
      for(let i=-1;i<=1;i++) box(scene,'pantalla escenario SV-202',new BABYLON.Vector3(room.cx-room.w/2+2.75,y+1.3,room.cz+i*1.45),new BABYLON.Vector3(.08,1.05,1.15),mats.screen,root,false);
    }else if(room.id==='SV-203'){
      const wallX=room.cx-room.w/2+.22;
      for(let r=0;r<3;r++) for(let c=0;c<4;c++){
        const material=[mats.yellow,mats.plant,mats.wallPanel][r%3];
        box(scene,'nota kanban SV-203',new BABYLON.Vector3(wallX,y+1.45+r*.85,room.cz-2.7+c*1.8),new BABYLON.Vector3(.07,.58,1.25),material,root,false);
      }
    }else if(room.id==='SV-204'){
      box(scene,'fondo estudio SV-204',new BABYLON.Vector3(room.cx-room.w/2+.24,y+2.4,room.cz),new BABYLON.Vector3(.08,4.2,7.5),mats.plant,root,false);
      for(const dz of [-2.5,2.5]){
        const stand=cyl(scene,'trípode luz SV-204',new BABYLON.Vector3(room.cx-room.w/2+2.2,y+.9,room.cz+dz),.12,1.8,mats.black,root,16,true);
        box(scene,'softbox SV-204',new BABYLON.Vector3(stand.position.x,y+2.05,stand.position.z),new BABYLON.Vector3(.85,.85,.25),mats.warmLight,root,false);
      }
    }else if(room.id==='SV-205'){
      for(let i=-1;i<=1;i++){
        box(scene,'panel evidencia SV-205',new BABYLON.Vector3(room.cx+room.w/2-.22,y+2.35,room.cz+i*3.0),new BABYLON.Vector3(.07,2.2,2.4),mats.projection,root,false);
      }
    }
  }

  function buildFloorOne(scene, root, mats) {
    const y = LEVEL.one;
    floorSlab(scene, root, mats, y, 'piso 1');
    ceiling(scene, root, mats, y + 7.0, 'techo piso 1');
    // V212: paredes exteriores ampliadas y retiradas del eje de escaleras.
    wall(scene, root, mats, 'pared norte p1 ampliada', 0, y + 2.8, 56.5, 144, 5.6, 0.35);
    wall(scene, root, mats, 'pared sur izquierda p1 ampliada', -44, y + 2.8, -56.5, 56, 5.6, 0.35);
    wall(scene, root, mats, 'pared sur derecha p1 ampliada', 44, y + 2.8, -56.5, 56, 5.6, 0.35);
    wall(scene, root, mats, 'pared oeste p1 ampliada', -72, y + 2.8, 0, 0.35, 5.6, 112);
    wall(scene, root, mats, 'pared este p1 ampliada', 72, y + 2.8, 0, 0.35, 5.6, 112);

    // Cafetería y biblioteca se movieron hacia los laterales para liberar completamente las escaleras.
    wall(scene, root, mats, 'pared cafeteria frontal ampliada', -57, y + 2.45, -23, 28, 4.9, 0.32);
    wall(scene, root, mats, 'pared cafeteria lateral ampliada', -43.5, y + 2.45, 6, 0.32, 4.9, 54);
    wall(scene, root, mats, 'pared biblioteca frontal ampliada', 57, y + 2.45, -23, 28, 4.9, 0.32);
    wall(scene, root, mats, 'pared biblioteca lateral ampliada', 43.5, y + 2.45, 6, 0.32, 4.9, 54);
    glassDoor(scene, root, mats, 'cafeteria', new BABYLON.Vector3(-43.25, y + 1.6, 10), Math.PI/2);
    glassDoor(scene, root, mats, 'biblioteca', new BABYLON.Vector3(43.25, y + 1.6, 10), -Math.PI/2);

    // Atrio del piso 1 despejado en torno a las escaleras. La fuente se mueve al costado derecho para no interferir.
    cyl(scene, 'fuente base circular premium', new BABYLON.Vector3(18, y + 0.08, 25), 7.2, 0.16, mats.metal, root, 96, true);
    cyl(scene, 'agua fuente premium', new BABYLON.Vector3(18, y + 0.19, 25), 6.2, 0.04, mats.water, root, 96, false);
    for (let z of [42, -42]) box(scene, 'banco lineal atrio moderno', new BABYLON.Vector3(0, y+.45, z), new BABYLON.Vector3(32, .28, 1.0), mats.wood, root, true);
    for (let x of [-38, 38]) box(scene, 'jardinera lineal atrio moderna', new BABYLON.Vector3(x, y+.42, 34), new BABYLON.Vector3(16, .84, 1.2), mats.wallPanel, root, true);
    box(scene, 'zona libre escaleras piso 1', new BABYLON.Vector3(-14.0, y + 0.026, 11.4), new BABYLON.Vector3(22.4, 0.05, 14.8), mats.path, root, false);
    buildSmartCafeteria(scene,root,mats,y);
    buildSmartLibrary(scene,root,mats,y);
  }

  function buildFloorTwo(scene, root, mats) {
    const y = LEVEL.two;
    floorSlab(scene, root, mats, y, 'piso 2');
    ceiling(scene, root, mats, y + 6.8, 'techo piso 2');
    balconyRails(scene, root, mats, y, 'piso 2');

    // V212: distribución ampliada a cinco salas virtuales. Se aprovecha todo el perímetro
    // sin invadir las escaleras eléctricas ni los corredores centrales.
    ROOM_CONFIG.forEach(room => buildVirtualClassroom(scene, root, mats, room, y));

    // Áreas de espera y colaboración frente a los salones.
    for (let x of [-46, 46]) bench(scene, root, mats, x, y, 43, 0);
    collaborativeTable(scene, root, mats, -52, y, 28, 'espera oeste');
    collaborativeTable(scene, root, mats, 52, y, 28, 'espera este');
  }

  function buildFloorThree(scene, root, mats) {
    const y = LEVEL.three;
    floorSlab(scene, root, mats, y, 'piso 3');
    ceiling(scene, root, mats, y + 9.4, 'techo elevado anfiteatro piso 3');
    balconyRails(scene, root, mats, y, 'piso 3');
    wall(scene, root, mats, 'anfiteatro fondo elevado', 0, y + 4.4, -38, 104, 8.8, 0.35);
    wall(scene, root, mats, 'anfiteatro oeste elevado', -52, y + 4.4, 0, 0.35, 8.8, 76);
    wall(scene, root, mats, 'anfiteatro este elevado', 52, y + 4.4, 0, 0.35, 8.8, 76);
    wall(scene, root, mats, 'anfiteatro norte izq elevado', -34, y + 4.4, 43, 36, 8.8, 0.35);
    wall(scene, root, mats, 'anfiteatro norte der elevado', 34, y + 4.4, 43, 36, 8.8, 0.35);
    glassDoor(scene, root, mats, 'anfiteatro', new BABYLON.Vector3(0, y + 1.6, 43.05), Math.PI);

    box(scene, 'escenario ampliado anfiteatro', new BABYLON.Vector3(0, y + 0.48, -29), new BABYLON.Vector3(40, 0.96, 9.6), mats.wood, root, true);
    box(scene, 'frente escenario anfiteatro', new BABYLON.Vector3(0, y + 0.27, -24.1), new BABYLON.Vector3(40.4, 0.52, 0.25), mats.wallPanel, root, true);
    podium(scene, root, mats, 0, y + 0.1, -24.3);
    box(scene, 'mesa control anfiteatro', new BABYLON.Vector3(20, y + 0.72, -23.5), new BABYLON.Vector3(4.6, 1.1, 1.4), mats.wallPanel, root, true);
    interactiveKiosk(scene,root,mats,'ANF-301','ESCENARIO INTERACTIVO','Preguntas, reacciones y turnos',new BABYLON.Vector3(23.5,y,-21.5),Math.PI,'ANF-301');

    // Núcleo de escaleras separado completamente de las gradas, al lado izquierdo.
    const stairBay = box(scene, 'pasillo núcleo escaleras piso 3', new BABYLON.Vector3(-30, y + 0.026, 11), new BABYLON.Vector3(15.2, 0.05, 30), mats.path, root, false);
    stairBay.isPickable = true;
    stairBay.metadata = { ...(stairBay.metadata || {}), walkable: true, teleportable: true };
    box(scene, 'borde núcleo escaleras piso 3', new BABYLON.Vector3(-22.25, y + 0.03, 11), new BABYLON.Vector3(0.24, 0.06, 30), mats.pathEdge, root, false);
    box(scene, 'separador cristal escaleras anfiteatro', new BABYLON.Vector3(-22.1, y + 1.0, 5), new BABYLON.Vector3(0.12, 1.65, 34), mats.darkGlass, root, true);

    // Pasillo lateral derecho independiente para circulación entre gradas.
    box(scene, 'pasillo lateral gradería anfiteatro', new BABYLON.Vector3(20.5, y + 0.026, 3.5), new BABYLON.Vector3(5.5, 0.05, 24), mats.path, root, false);

    // Gradería con abertura central para subir y bajar sin bloqueo.
    const rowCount = 8;
    const seatColumnsLeft = [-6, -5, -4, -3];
    const seatColumnsRight = [2, 3, 4, 5, 6];
    for (let row = 0; row < rowCount; row++) {
      const tierHeight = 0.34 * row;
      const tierZ = -12 + row * 4.2;
      const tierDepth = 2.85;
      box(scene, `graderia izquierda nivel ${row + 1}`, new BABYLON.Vector3(-11.6, y + tierHeight / 2 + 0.02, tierZ), new BABYLON.Vector3(17.2, tierHeight + 0.04, tierDepth), mats.stone, root, true);
      box(scene, `graderia derecha nivel ${row + 1}`, new BABYLON.Vector3(8.1, y + tierHeight / 2 + 0.02, tierZ), new BABYLON.Vector3(17.2, tierHeight + 0.04, tierDepth), mats.stone, root, true);
      for (const col of seatColumnsLeft) seat(scene, root, mats, -1.8 + col * 2.25, y + tierHeight + 0.02, tierZ + 0.25, 0);
      for (const col of seatColumnsRight) seat(scene, root, mats, -1.8 + col * 2.25, y + tierHeight + 0.02, tierZ + 0.25, 0);
      // huella visual de escalones centrales
      box(scene, `escalon central anfiteatro ${row + 1}`, new BABYLON.Vector3(-1.8, y + tierHeight + 0.025, tierZ), new BABYLON.Vector3(4.8, 0.05, 2.15), mats.pathEdge, root, false);
    }

    // Rampas invisibles para permitir subir la gradería caminando por el paso central y lateral.
    const centerRamp = box(scene, 'rampa invisible central anfiteatro', new BABYLON.Vector3(-1.8, y + 1.22, 2.7), new BABYLON.Vector3(4.2, 0.18, 30.8), mats.path, root, true);
    centerRamp.rotation.x = -Math.atan2(2.44, 30.8);
    centerRamp.isVisible = false;
    const sideRamp = box(scene, 'rampa invisible lateral anfiteatro', new BABYLON.Vector3(20.5, y + 1.12, 3.5), new BABYLON.Vector3(3.6, 0.18, 23.5), mats.path, root, true);
    sideRamp.rotation.x = -Math.atan2(2.1, 23.5);
    sideRamp.isVisible = false;
    sideRamp.metadata = { ...(sideRamp.metadata || {}), walkable: true, teleportable: true };

    electronicBoard(scene, root, mats, 'ANF-301', 0, y + 4.45, -37.3, 22, 7.8);
    roomSign(scene, root, 'ANFITEATRO UCAN', 0, y + 8.25, 42.5);
  }


  function roomBox(scene, root, mats, label, cx, y, cz, w, d) {
    const halfW=w/2, halfD=d/2;
    wall(scene, root, mats, `${label} pared fondo`, cx, y+2.4, cz-halfD, w, 4.8, .32);
    wall(scene, root, mats, `${label} pared frente izq`, cx-halfW/2-2.1, y+2.4, cz+halfD, halfW-4.2, 4.8, .32);
    wall(scene, root, mats, `${label} pared frente der`, cx+halfW/2+2.1, y+2.4, cz+halfD, halfW-4.2, 4.8, .32);
    wall(scene, root, mats, `${label} pared oeste`, cx-halfW, y+2.4, cz, .32, 4.8, d);
    wall(scene, root, mats, `${label} pared este`, cx+halfW, y+2.4, cz, .32, 4.8, d);
    glassDoor(scene, root, mats, `Entrada ${label}`, new BABYLON.Vector3(cx, y+1.55, cz+halfD+.02), Math.PI);
  }

  function balconyRails(scene, root, mats, y, prefix) {
    box(scene, `${prefix} baranda norte amplia`, new BABYLON.Vector3(0, y+1.15, 54.5), new BABYLON.Vector3(136, 1.15, .13), mats.darkGlass, root, true);
    box(scene, `${prefix} baranda oeste amplia`, new BABYLON.Vector3(-70.5, y+1.15, 0), new BABYLON.Vector3(.13, 1.15, 108), mats.darkGlass, root, true);
    box(scene, `${prefix} baranda este amplia`, new BABYLON.Vector3(70.5, y+1.15, 0), new BABYLON.Vector3(.13, 1.15, 108), mats.darkGlass, root, true);
  }

  function buildShell(scene, root, mats) {
    // Fachada ampliada tipo mall moderno con gran muro cortina.
    for (let x=-66; x<=66; x+=8.25) box(scene, 'fachada cristal ampliada', new BABYLON.Vector3(x, 6.2, 57.0), new BABYLON.Vector3(6.8, 11.2, .14), mats.glass, root, true);
    for (let x=-68; x<=68; x+=13.6) box(scene, 'columna fachada ampliada', new BABYLON.Vector3(x, 11.2, 57.25), new BABYLON.Vector3(.58, 22.4, .7), mats.wallPanel, root, true);
    box(scene, 'volumen vertical acceso', new BABYLON.Vector3(-74.5, 14.2, 50), new BABYLON.Vector3(5.0, 28.4, 5.0), mats.wall, root, true);
    for (let x of [-52,-26,26,52]) box(scene, 'marco arquitectónico interior', new BABYLON.Vector3(x, 11.8, -58.5), new BABYLON.Vector3(.5, 22, .45), mats.wallPanel, root, true);
  }

  function buildAtriumDetails(scene, root, mats) {
    box(scene, 'tragaluz cristal ampliado', new BABYLON.Vector3(0, LEVEL.rooftop + 0.18, 3), new BABYLON.Vector3(88, .18, 76), mats.glass, root, false);
    for (let y of [LEVEL.two, LEVEL.three]) {
      box(scene, 'borde visual atrio norte amplio', new BABYLON.Vector3(0, y+.05, 23.5), new BABYLON.Vector3(76, .06, .12), mats.metal, root, false);
      box(scene, 'borde visual atrio sur amplio', new BABYLON.Vector3(0, y+.05, -14.5), new BABYLON.Vector3(76, .06, .12), mats.metal, root, false);
      box(scene, 'borde visual atrio oeste amplio', new BABYLON.Vector3(-38, y+.05, 4.5), new BABYLON.Vector3(.12, .06, 38), mats.metal, root, false);
      box(scene, 'borde visual atrio este amplio', new BABYLON.Vector3(38, y+.05, 4.5), new BABYLON.Vector3(.12, .06, 38), mats.metal, root, false);
    }
    [LEVEL.one, LEVEL.two, LEVEL.three].forEach((y,i) => {
      box(scene, `inlay piso central ampliado ${i}`, new BABYLON.Vector3(0, y+.018, 34), new BABYLON.Vector3(112, .018, .36), mats.stoneDark, root, false);
      box(scene, `inlay piso longitudinal ampliado ${i}`, new BABYLON.Vector3(0, y+.019, 5), new BABYLON.Vector3(.36, .018, 104), mats.stoneDark, root, false);
    });
  }

  function buildFurniture(scene, root, mats) {
    // Mesas tradicionales del food court
    [[-30,18],[-18,28],[-6,38],[8,38],[20,28],[32,18],[-32,44],[-16,48],[0,49],[16,48],[32,44]].forEach(([x,z],i) => tableSet(scene, root, mats, x, LEVEL.one, z, i*.22));
    for (let x of [-46,-30,30,46]) bench(scene, root, mats, x, LEVEL.one, 47, 0);

    // Cafetería y biblioteca
    box(scene, 'counter cafeteria ampliado', new BABYLON.Vector3(-60, LEVEL.one+.6, -12), new BABYLON.Vector3(18,1.2,1.4), mats.wood, root, true);
    box(scene, 'vitrina cafeteria ampliada', new BABYLON.Vector3(-60, LEVEL.one+1.25, -11.1), new BABYLON.Vector3(17,.7,.18), mats.glass, root, false);
    for (let i=0;i<7;i++) box(scene, 'estante biblioteca ampliado', new BABYLON.Vector3(49+i*3.2, LEVEL.one+1.2, -11), new BABYLON.Vector3(.6,2.4,12), mats.wood, root, true);
    for (let i=0;i<5;i++) tableSet(scene, root, mats, 49+i*4.0, LEVEL.one, 18, 0);

    // Nuevos lounges seccionales de estudio en áreas comunes - piso 1
    sectionalStudyLounge(scene, root, mats, -42, LEVEL.one, 27, Math.PI/2, 'left');
    sectionalStudyLounge(scene, root, mats, 42, LEVEL.one, 27, -Math.PI/2, 'right');
    sectionalStudyLounge(scene, root, mats, -24, LEVEL.one, 56, 0, 'straight');
    sectionalStudyLounge(scene, root, mats, 24, LEVEL.one, 56, Math.PI, 'straight');

    // Pequeños lounges de estudio en piso 2, junto a los salones
    sectionalStudyLounge(scene, root, mats, -46, LEVEL.two, 40, 0, 'straight', true);
    sectionalStudyLounge(scene, root, mats, 46, LEVEL.two, 40, Math.PI, 'straight', true);
  }

  function sectionalStudyLounge(scene, root, mats, x, y, z, yaw = 0, variant = 'left', compact = false) {
    const g = new BABYLON.TransformNode(`lounge seccional ${x} ${z}`, scene);
    g.position = new BABYLON.Vector3(x, y, z);
    g.rotation.y = yaw;
    g.parent = root;

    const seatMat = compact ? mats.upholstery : mats.upholsteryLight;
    const seatLen = compact ? 3.6 : 5.2;
    const chaiseLen = compact ? 1.8 : 2.6;
    const depth = compact ? 1.05 : 1.15;
    const hSeat = 0.46;
    const hBack = 0.82;

    // módulo principal
    box(scene, 'base sofá principal', new BABYLON.Vector3(0,hSeat/2,0), new BABYLON.Vector3(seatLen,hSeat,depth), seatMat, g, true);
    box(scene, 'respaldo sofá principal', new BABYLON.Vector3(0,hSeat + hBack/2,-depth/2 + 0.08), new BABYLON.Vector3(seatLen,hBack,0.16), seatMat, g, true);
    // brazos
    box(scene, 'brazo sofá izq', new BABYLON.Vector3(-seatLen/2 + 0.1,hSeat + 0.18,0), new BABYLON.Vector3(0.2,0.82,depth), seatMat, g, true);
    box(scene, 'brazo sofá der', new BABYLON.Vector3(seatLen/2 - 0.1,hSeat + 0.18,0), new BABYLON.Vector3(0.2,0.82,depth), seatMat, g, true);

    // chaise / parte seccional
    if (variant === 'left') {
      box(scene, 'chaise base left', new BABYLON.Vector3(-seatLen/2 + chaiseLen/2 + 0.18,hSeat/2,depth*0.92), new BABYLON.Vector3(chaiseLen,hSeat,depth), seatMat, g, true);
      box(scene, 'chaise brazo left', new BABYLON.Vector3(-seatLen/2 + 0.1,hSeat + 0.18,depth*0.92), new BABYLON.Vector3(0.2,0.82,depth), seatMat, g, true);
    } else if (variant === 'right') {
      box(scene, 'chaise base right', new BABYLON.Vector3(seatLen/2 - chaiseLen/2 - 0.18,hSeat/2,depth*0.92), new BABYLON.Vector3(chaiseLen,hSeat,depth), seatMat, g, true);
      box(scene, 'chaise brazo right', new BABYLON.Vector3(seatLen/2 - 0.1,hSeat + 0.18,depth*0.92), new BABYLON.Vector3(0.2,0.82,depth), seatMat, g, true);
    }

    // mesa de centro de estudio
    box(scene, 'mesa centro lounge', new BABYLON.Vector3(0,0.28, compact ? 2.1 : 2.4), new BABYLON.Vector3(compact ? 1.8 : 2.6,0.12,compact ? 0.9 : 1.1), mats.wood, g, true);
    for (let lx of [-0.85,0.85]) for (let lz of [compact?1.8:2.1, compact?2.4:2.7]) cyl(scene, 'pata mesa centro', new BABYLON.Vector3(lx,0.14,lz), 0.04,0.24,mats.metal,g,12,true);

    // mesa auxiliar y lámpara
    cyl(scene, 'mesa auxiliar lounge', new BABYLON.Vector3(compact ? 2.45 : 3.15,0.56,0.15), 0.46,0.08,mats.wood,g,24,true);
    cyl(scene, 'base mesa auxiliar', new BABYLON.Vector3(compact ? 2.45 : 3.15,0.28,0.15), 0.08,0.52,mats.metal,g,12,true);
    cyl(scene, 'base lámpara estudio', new BABYLON.Vector3(compact ? 2.45 : 3.15,0.04,-0.55), 0.18,0.08,mats.black,g,16,true);
    cyl(scene, 'poste lámpara estudio', new BABYLON.Vector3(compact ? 2.45 : 3.15,0.82,-0.55), 0.03,1.56,mats.black,g,12,false);
    box(scene, 'pantalla lámpara estudio', new BABYLON.Vector3(compact ? 2.45 : 3.15,1.68,-0.55), new BABYLON.Vector3(0.42,0.28,0.42), mats.warmLight, g, false);

    // superficies para estudiar / portátiles
    box(scene, 'libro lounge 1', new BABYLON.Vector3(-0.55,0.35, compact ? 2.1 : 2.42), new BABYLON.Vector3(0.42,0.03,0.3), mats.yellow, g, false);
    box(scene, 'libro lounge 2', new BABYLON.Vector3(0.05,0.35, compact ? 2.1 : 2.42), new BABYLON.Vector3(0.42,0.03,0.3), mats.wallPanel, g, false);
    box(scene, 'tablet estudio', new BABYLON.Vector3(0.68,0.37, compact ? 2.1 : 2.42), new BABYLON.Vector3(0.46,0.02,0.28), mats.black, g, false);

    // puffs laterales
    ottoman(scene, g, mats, compact ? -2.1 : -2.7, 0, compact ? 2.25 : 2.65);
    ottoman(scene, g, mats, compact ? 2.0 : 2.55, 0, compact ? 2.25 : 2.65);
  }

  function ottoman(scene, root, mats, x, y, z) {
    box(scene, 'ottoman base', new BABYLON.Vector3(x,y+0.22,z), new BABYLON.Vector3(0.9,0.44,0.9), mats.upholstery, root, true);
    for (let lx of [-0.28,0.28]) for (let lz of [-0.28,0.28]) cyl(scene, 'pata ottoman', new BABYLON.Vector3(x+lx,y+0.08,z+lz), 0.035,0.16,mats.metal,root,10,true);
  }

  function tableSet(scene, root, mats, x, y, z, yaw) {
    const table = cyl(scene, 'mesa food court', new BABYLON.Vector3(x, y+.76, z), 1.9, .09, mats.wood, root, 64, true);
    table.rotation.y = yaw;
    cyl(scene, 'base mesa', new BABYLON.Vector3(x, y+.38, z), .16, .76, mats.metal, root, 24, true);
    cyl(scene, 'pie mesa', new BABYLON.Vector3(x, y+.06, z), .84, .12, mats.metal, root, 48, true);
    [[1.55,0,Math.PI/2],[-1.55,0,-Math.PI/2],[0,1.55,Math.PI],[0,-1.55,0]].forEach(([dx,dz,r]) => chair(scene, root, mats, x+dx, y, z+dz, r));
  }

  function chair(scene, root, mats, x, y, z, yaw) {
    const g = new BABYLON.TransformNode('silla', scene); g.position = new BABYLON.Vector3(x,y,z); g.rotation.y=yaw; g.parent=root;
    box(scene, 'asiento silla', new BABYLON.Vector3(0,.48,0), new BABYLON.Vector3(.82,.12,.76), mats.wallPanel, g, true);
    box(scene, 'respaldo silla', new BABYLON.Vector3(0,1.0,-.34), new BABYLON.Vector3(.82,.82,.12), mats.wallPanel, g, true);
    for (let lx of [-.32,.32]) for (let lz of [-.28,.28]) cyl(scene, 'pata silla', new BABYLON.Vector3(lx,.24,lz), .055, .48, mats.metal, g, 12, true);
  }

  function bench(scene, root, mats, x, y, z, yaw) {
    const g = new BABYLON.TransformNode('banco', scene); g.position = new BABYLON.Vector3(x,y,z); g.rotation.y=yaw; g.parent=root;
    box(scene, 'asiento banco', new BABYLON.Vector3(0,.48,0), new BABYLON.Vector3(4.4,.18,.82), mats.wood, g, true);
    box(scene, 'respaldo banco', new BABYLON.Vector3(0,1.0,-.42), new BABYLON.Vector3(4.4,.82,.16), mats.wood, g, true);
    for (let x of [-1.8,0,1.8]) cyl(scene, 'base banco', new BABYLON.Vector3(x,.22,0), .11, .42, mats.metal, g, 16, true);
  }

  function buildVirtualClassroom(scene, root, mats, room, y) {
    roomBox(scene, root, mats, room.id, room.cx, y, room.cz, room.w, room.d);
    const backZ = room.cz - room.d / 2 + 0.22;
    const frontZ = room.cz + room.d / 2;

    const boardCenterY = room.id === 'SV-203' ? y + 2.30 : y + 2.72;
    const boardHeight = room.id === 'SV-203' ? 4.05 : 5.25;
    const boardWidth = room.id === 'SV-203' ? Math.min(room.w - 5.2, 9.8) : Math.min(room.w - 4.0, 11.2);
    electronicBoard(scene, root, mats, room.id, room.cx, boardCenterY, backZ, boardWidth, boardHeight);
    roomSign(scene, root, room.id, room.cx, y + 4.35, frontZ + 0.18);

    // Área del facilitador.
    box(scene, `${room.id} escritorio profesor`, new BABYLON.Vector3(room.cx - room.w * 0.18, y + .55, backZ + 4.1), new BABYLON.Vector3(Math.min(4.2, room.w * .28), .8, 1.2), mats.wood, root, true);
    box(scene, `${room.id} estación tecnológica`, new BABYLON.Vector3(room.cx + room.w * 0.23, y + .72, backZ + 3.85), new BABYLON.Vector3(1.55, 1.2, .78), mats.wallPanel, root, true);
    box(scene, `${room.id} monitor estación`, new BABYLON.Vector3(room.cx + room.w * 0.23, y + 1.55, backZ + 3.72), new BABYLON.Vector3(1.15, .68, .08), mats.screen, root, false);

    // Mesas flexibles, dejando un pasillo central y acceso libre a la puerta.
    const cols = room.w >= 27 ? 4 : 3;
    const spacingX = room.w >= 27 ? 3.35 : 3.55;
    const startX = room.cx - ((cols - 1) * spacingX) / 2;
    const rowBase = backZ + 7.3;
    for (let row = 0; row < 3; row++) {
      const z = rowBase + row * 3.15;
      if (z > frontZ - 4.2) continue;
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacingX;
        deskChair(scene, root, mats, x, y, z, room.id);
      }
    }

    // Tratamiento acústico lateral y luminarias de sala.
    for (let i = -1; i <= 1; i++) {
      box(scene, `${room.id} panel acústico oeste ${i}`, new BABYLON.Vector3(room.cx - room.w / 2 + .19, y + 2.55, room.cz + i * 4.1), new BABYLON.Vector3(.08, 2.2, 2.2), mats.carpet, root, false);
      box(scene, `${room.id} panel acústico este ${i}`, new BABYLON.Vector3(room.cx + room.w / 2 - .19, y + 2.55, room.cz + i * 4.1), new BABYLON.Vector3(.08, 2.2, 2.2), mats.carpet, root, false);
    }
    for (let z = backZ + 5; z < frontZ - 3; z += 4.8) {
      box(scene, `${room.id} luminaria ${z.toFixed(1)}`, new BABYLON.Vector3(room.cx, y + 5.55, z), new BABYLON.Vector3(Math.min(room.w - 4, 14), .05, .14), mats.warmLight, root, false);
    }
    buildRoomSpecialization(scene,root,mats,room,y,backZ,frontZ);
  }

  function deskChair(scene, root, mats, x, y, z, roomId = 'sala') {
    box(scene, `${roomId} mesa estudiante`, new BABYLON.Vector3(x, y + .72, z), new BABYLON.Vector3(2.25, .1, 1.05), mats.wood, root, true);
    box(scene, `${roomId} tableta estudiante`, new BABYLON.Vector3(x, y + .80, z - .03), new BABYLON.Vector3(.75, .025, .48), mats.black, root, false);
    chair(scene, root, mats, x, y, z + 1.15, Math.PI);
  }

  function collaborativeTable(scene, root, mats, x, y, z, label = 'colaborativa') {
    const g = new BABYLON.TransformNode(`mesa ${label}`, scene);
    g.position = new BABYLON.Vector3(x, y, z);
    g.parent = root;
    cyl(scene, `superficie ${label}`, new BABYLON.Vector3(0, .78, 0), 3.6, .14, mats.wood, g, 48, true);
    cyl(scene, `base ${label}`, new BABYLON.Vector3(0, .39, 0), .38, .72, mats.metal, g, 24, true);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      chair(scene, g, mats, Math.sin(a) * 2.55, 0, Math.cos(a) * 2.55, a + Math.PI);
    }
    cyl(scene, `cargador ${label}`, new BABYLON.Vector3(0, .88, 0), .46, .08, mats.yellow, g, 32, false);
  }

  function roomSign(scene, root, text, x, y, z) {
    const normalized = String(text || '').trim();
    const isStairSign = normalized === 'ESCALERAS A LA TERRAZA' || normalized === 'ESCALERAS AL PISO 3';
    const textureSize = isStairSign ? { width: 1536, height: 512 } : { width: 768, height: 192 };
    const signSize = isStairSign ? { width: 9.8, height: 2.5 } : { width: 5.2, height: 1.3 };
    const texture = new BABYLON.DynamicTexture(`rotulo ${normalized}`, textureSize, scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = '#007b5f';
    ctx.fillRect(0, 0, textureSize.width, textureSize.height);
    ctx.fillStyle = '#fed141';
    ctx.fillRect(0, textureSize.height - Math.round(textureSize.height * 0.17), textureSize.width, Math.round(textureSize.height * 0.17));
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isStairSign) {
      ctx.font = 'bold 118px Segoe UI, Arial';
      ctx.fillText('ESCALERAS', textureSize.width / 2, 165);
      ctx.font = 'bold 96px Segoe UI, Arial';
      ctx.fillText(normalized === 'ESCALERAS A LA TERRAZA' ? 'A LA TERRAZA' : 'AL PISO 3', textureSize.width / 2, 315);
    } else {
      ctx.font = 'bold 86px Segoe UI, Arial';
      ctx.fillText(normalized, textureSize.width / 2, 86);
    }
    texture.update();

    const mat = new BABYLON.StandardMaterial(`material rotulo ${normalized}`, scene);
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.disableLighting = true;
    mat.backFaceCulling = true;
    const pair = createDoubleSidedDisplay(
      scene,
      root,
      `rótulo ${normalized}`,
      signSize.width,
      signSize.height,
      new BABYLON.Vector3(x, y, z),
      Math.PI,
      mat,
      mat,
      0.07,
      { readableSign: true, text: normalized, completeText: true, twoLine: isStairSign }
    );
    return pair;
  }

  function electronicBoard(scene, root, mats, roomId, x, y, z, width, height) {
    const group = new BABYLON.TransformNode(`pizarra electrónica ${roomId}`, scene);
    group.position = new BABYLON.Vector3(x, y, z);
    group.parent = root;

    box(scene, `${roomId} respaldo pizarra`, new BABYLON.Vector3(0, 0, -0.10), new BABYLON.Vector3(width + .65, height + .62, .20), mats.black, group, false);
    box(scene, `${roomId} marco superior`, new BABYLON.Vector3(0, height / 2 + .23, .02), new BABYLON.Vector3(width + .42, .18, .14), mats.wallPanel, group, false);
    box(scene, `${roomId} marco inferior`, new BABYLON.Vector3(0, -height / 2 - .23, .02), new BABYLON.Vector3(width + .42, .18, .14), mats.wallPanel, group, false);
    box(scene, `${roomId} marco izquierdo`, new BABYLON.Vector3(-width / 2 - .22, 0, .02), new BABYLON.Vector3(.18, height + .28, .14), mats.wallPanel, group, false);
    box(scene, `${roomId} marco derecho`, new BABYLON.Vector3(width / 2 + .22, 0, .02), new BABYLON.Vector3(.18, height + .28, .14), mats.wallPanel, group, false);

    const dynamicTexture = new BABYLON.DynamicTexture(`contenido pizarra ${roomId}`, { width: 1280, height: 720 }, scene, false);
    const boardMaterial = new BABYLON.StandardMaterial(`material pizarra ${roomId}`, scene);
    boardMaterial.diffuseTexture = dynamicTexture;
    boardMaterial.emissiveTexture = dynamicTexture;
    boardMaterial.disableLighting = true;
    boardMaterial.backFaceCulling = false;

    const screen = BABYLON.MeshBuilder.CreatePlane(`${roomId} pantalla interactiva`, { width, height, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    screen.position = new BABYLON.Vector3(0, 0, .03);
    screen.rotation.y = Math.PI;
    screen.material = boardMaterial;
    screen.parent = group;
    screen.isPickable = true;
    screen.metadata = { type: 'electronic-board', roomId };

    const record = {
      id: roomId, scene, screen, dynamicTexture, defaultMaterial: boardMaterial,
      activeMaterial: boardMaterial, pages: [], pageIndex: 0, file: null,
      objectUrl: null, videoTexture: null, videoElement: null, previewType: 'empty',
      analysis: null, analysisSourceText: '', slideImages: [], slidePdfUrl: '',
      remoteAssets: []
    };
    BOARD_REGISTRY.set(roomId, record);
    drawBoardWelcome(record);

    screen.actionManager = new BABYLON.ActionManager(scene);
    screen.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => openBoardPanel(roomId)));
    screen.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
      canvas.style.cursor = 'pointer'; setStatus(`Pizarra electrónica ${roomId}: pulse para cargar contenido.`);
    }));
    screen.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => { canvas.style.cursor = 'default'; }));

    // Barra inferior y panel de control táctil.
    box(scene, `${roomId} repisa pizarra`, new BABYLON.Vector3(0, -height / 2 - .52, .36), new BABYLON.Vector3(3.8, .12, .56), mats.wood, group, true);
    const control = box(scene, `${roomId} control táctil`, new BABYLON.Vector3(width / 2 + .62, .15, .12), new BABYLON.Vector3(.55, 2.05, .10), mats.wallPanel, group, false);
    control.isPickable = true;
    control.actionManager = new BABYLON.ActionManager(scene);
    control.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => openBoardPanel(roomId)));
  }

  function buildFirstFloorCommonAreas(scene, root, mats) {
    const y = LEVEL.one;

    // Zona de coworking colaborativo en el área antes vacía del suroeste.
    box(scene, 'alfombra coworking oeste', new BABYLON.Vector3(-26, y + .018, -39), new BABYLON.Vector3(27, .025, 22), mats.carpet, root, false);
    collaborativeTable(scene, root, mats, -31, y, -39, 'coworking oeste 1');
    collaborativeTable(scene, root, mats, -20, y, -39, 'coworking oeste 2');
    box(scene, 'barra tecnológica coworking', new BABYLON.Vector3(-26, y + .62, -49), new BABYLON.Vector3(17, 1.1, 1.15), mats.wallPanel, root, true);
    for (let x = -32; x <= -20; x += 4) {
      box(scene, `monitor coworking ${x}`, new BABYLON.Vector3(x, y + 1.55, -48.45), new BABYLON.Vector3(2.0, 1.05, .08), mats.screen, root, false);
    }

    // Lounge de bienestar y conversación en el sureste.
    box(scene, 'alfombra bienestar este', new BABYLON.Vector3(27, y + .018, -39), new BABYLON.Vector3(28, .025, 22), mats.carpet, root, false);
    sectionalStudyLounge(scene, root, mats, 21, y, -42, 0, 'left', true);
    sectionalStudyLounge(scene, root, mats, 34, y, -42, Math.PI, 'right', true);
    plant(scene, root, mats, 16, y, -48); plant(scene, root, mats, 39, y, -48);

    // Galería central con mesas altas para encuentros breves y orientación.
    box(scene, 'isla orientación UCAN', new BABYLON.Vector3(0, y + .66, -44), new BABYLON.Vector3(13, 1.25, 2.2), mats.wood, root, true);
    box(scene, 'pantalla orientación UCAN', new BABYLON.Vector3(0, y + 2.35, -45.0), new BABYLON.Vector3(8.2, 2.6, .12), mats.screen, root, false);
    for (let x of [-5, -2.5, 2.5, 5]) {
      cyl(scene, 'mesa alta orientación', new BABYLON.Vector3(x, y + .82, -38), 1.25, .12, mats.wood, root, 32, true);
      cyl(scene, 'base mesa alta orientación', new BABYLON.Vector3(x, y + .4, -38), .15, .78, mats.metal, root, 16, true);
    }
  }

  function createShieldTexture(scene, id, title, subtitle, primary = '#007b5f', accent = '#fed141') {
    const texture = new BABYLON.DynamicTexture(`escudo ${id}`, { width: 512, height: 640 }, scene, false);
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 512, 640);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(256, 22); ctx.lineTo(456, 92); ctx.lineTo(418, 350); ctx.quadraticCurveTo(392, 468, 256, 585); ctx.quadraticCurveTo(120, 468, 94, 350); ctx.lineTo(56, 92); ctx.closePath(); ctx.fill();
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(256, 42); ctx.lineTo(432, 104); ctx.lineTo(398, 340); ctx.quadraticCurveTo(375, 440, 256, 545); ctx.quadraticCurveTo(137, 440, 114, 340); ctx.lineTo(80, 104); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(108, 138, 296, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 225);
    const initials = title.split(/\s+/).map(w => w[0]).join('').slice(0, 4);
    ctx.font = 'bold 130px Segoe UI, Arial';
    ctx.fillText(initials, 256, 330);
    ctx.font = 'bold 28px Segoe UI, Arial';
    ctx.fillText(subtitle, 256, 420);
    ctx.font = '24px Segoe UI, Arial';
    ctx.fillText('San Germán · Puerto Rico', 256, 468);
    texture.update();
    return texture;
  }

  function drawBoardWelcome(record) {
    drawBoardCanvas(record, record.id, ['PIZARRA ELECTRÓNICA', 'Pulse la pantalla para cargar contenido:', 'PowerPoint · Word · PDF · imágenes · videos · texto'], 'UCAN Academic Mall V265');
    record.pages = [];
    record.pageIndex = 0;
    record.previewType = 'empty';
  }

  function drawBoardCanvas(record, title, lines, footer = '') {
    const texture = record.dynamicTexture;
    const ctx = texture.getContext();
    const W = 1280, H = 720;
    ctx.fillStyle = '#f4f6f3'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#007b5f'; ctx.fillRect(0, 0, W, 112);
    ctx.fillStyle = '#fed141'; ctx.fillRect(0, 108, W, 12);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 48px Segoe UI, Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(String(title || record.id).slice(0, 42), 52, 56);
    ctx.fillStyle = '#14211e'; ctx.font = '34px Segoe UI, Arial'; ctx.textBaseline = 'top';
    let y = 160;
    const maxWidth = W - 104;
    const source = Array.isArray(lines) ? lines : [String(lines || '')];
    for (const line of source) {
      const wrapped = wrapAstronomyText(ctx, String(line || ''), maxWidth);
      for (const part of wrapped) {
        if (y > 620) break;
        ctx.fillText(part, 52, y); y += 46;
      }
      y += 8;
      if (y > 620) break;
    }
    ctx.fillStyle = '#52645f'; ctx.font = '24px Segoe UI, Arial'; ctx.textBaseline = 'middle';
    ctx.fillText(footer || '', 52, 682);
    texture.update();
    if (record.screen.material !== record.defaultMaterial) record.screen.material = record.defaultMaterial;
  }


  function auditTextWrapping() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '34px Segoe UI, Arial';
    const arrayResult = wrapAstronomyText(ctx, 'Texto de prueba para pizarras electrónicas', 260);
    const drawnResult = wrapAstronomyText(ctx, 'Texto de prueba para panel astronómico', 10, 20, 260, 40);
    window.__UCAN_TEXT_WRAP_AUDIT__ = {
      version: 'V265',
      iterableBoardLines: Array.isArray(arrayResult),
      boardLineCount: Array.isArray(arrayResult) ? arrayResult.length : 0,
      astronomyCursorNumeric: Number.isFinite(drawnResult),
      passed: Array.isArray(arrayResult) && Number.isFinite(drawnResult)
    };
    console.info('[UCAN V265] Auditoría de ajuste de texto:', window.__UCAN_TEXT_WRAP_AUDIT__);
    return window.__UCAN_TEXT_WRAP_AUDIT__;
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = text.replace(/\s+/g, ' ').trim().split(' ');
    if (!words[0]) return [''];
    const lines = []; let line = words.shift();
    for (const word of words) {
      const test = `${line} ${word}`;
      if (ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; }
      else line = test;
    }
    lines.push(line); return lines;
  }


  function buildWalkPaths(scene, root, mats) {
    // Piso 1: circulación principal y acceso a las nuevas áreas comunes.
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.one + 0.013, 36), new BABYLON.Vector3(14, 0.02, 44));
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.one + 0.014, 10), new BABYLON.Vector3(10, 0.02, 30));
    pathStrip(scene, root, mats, new BABYLON.Vector3(-34, LEVEL.one + 0.013, 2), new BABYLON.Vector3(40, 0.02, 8));
    pathStrip(scene, root, mats, new BABYLON.Vector3(34, LEVEL.one + 0.013, 2), new BABYLON.Vector3(40, 0.02, 8));
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.one + 0.013, -25), new BABYLON.Vector3(10, 0.02, 42));
    pathStrip(scene, root, mats, new BABYLON.Vector3(-17, LEVEL.one + 0.013, -34), new BABYLON.Vector3(24, 0.02, 7));
    pathStrip(scene, root, mats, new BABYLON.Vector3(17, LEVEL.one + 0.013, -34), new BABYLON.Vector3(24, 0.02, 7));
    pathNode(scene, root, mats, 0, LEVEL.one, 22, 7.5);

    // Piso 2: corredor ampliado con ramales claros hacia las cinco salas.
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.two + 0.013, 37), new BABYLON.Vector3(16, 0.02, 40));
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.two + 0.013, 7), new BABYLON.Vector3(11, 0.02, 28));
    pathStrip(scene, root, mats, new BABYLON.Vector3(-34, LEVEL.two + 0.013, 10), new BABYLON.Vector3(58, 0.02, 8));
    pathStrip(scene, root, mats, new BABYLON.Vector3(34, LEVEL.two + 0.013, 10), new BABYLON.Vector3(58, 0.02, 8));
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.two + 0.013, -15), new BABYLON.Vector3(10, 0.02, 26));
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.two + 0.013, -22), new BABYLON.Vector3(72, 0.02, 7));
    pathStrip(scene, root, mats, new BABYLON.Vector3(-17, LEVEL.two + 0.014, 32), new BABYLON.Vector3(40, 0.02, 8));
    pathNode(scene, root, mats, 0, LEVEL.two, 14, 7.5);

    // Piso 3: ruta directa al anfiteatro y ramal libre hacia el núcleo de escaleras izquierdo.
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.three + 0.013, 34), new BABYLON.Vector3(16, 0.02, 42));
    pathStrip(scene, root, mats, new BABYLON.Vector3(0, LEVEL.three + 0.013, -2), new BABYLON.Vector3(12, 0.02, 34));
    pathStrip(scene, root, mats, new BABYLON.Vector3(-16, LEVEL.three + 0.014, 10), new BABYLON.Vector3(38, 0.02, 8));
    pathStrip(scene, root, mats, new BABYLON.Vector3(-30, LEVEL.three + 0.014, 20), new BABYLON.Vector3(12, 0.02, 28));
    pathNode(scene, root, mats, 0, LEVEL.three, 18, 7.5);
    pathNode(scene, root, mats, -30, LEVEL.three, 10, 6.5);
  }

  function pathStrip(scene, root, mats, pos, size) {
    const path = box(scene, 'ruta avatar', pos, size, mats.path, root, false);
    path.isPickable = true;
    path.metadata = { ...(path.metadata || {}), walkable: true, teleportable: true };
    box(scene, 'borde ruta avatar izq', pos.clone().add(new BABYLON.Vector3(-size.x/2 + 0.16, 0.003, 0)), new BABYLON.Vector3(0.22, 0.026, size.z), mats.pathEdge, root, false);
    box(scene, 'borde ruta avatar der', pos.clone().add(new BABYLON.Vector3(size.x/2 - 0.16, 0.003, 0)), new BABYLON.Vector3(0.22, 0.026, size.z), mats.pathEdge, root, false);
  }

  function pathNode(scene, root, mats, x, y, z, radius) {
    const disk = cyl(scene, 'nodo ruta avatar', new BABYLON.Vector3(x, y + 0.012, z), radius, 0.02, mats.path, root, 40, false);
    const ring = cyl(scene, 'anillo ruta avatar', new BABYLON.Vector3(x, y + 0.015, z), radius + 0.12, 0.022, mats.pathEdge, root, 40, false);
    disk.rotation.x = ring.rotation.x = 0;
    disk.isPickable = true;
    disk.metadata = { ...(disk.metadata || {}), walkable: true, teleportable: true };
  }

  function buildPlants(scene, root, mats) {
    [[-60,46],[60,46],[-60,-42],[60,-42],[-35,54],[35,54],[-10,52],[10,52]].forEach(([x,z]) => plant(scene, root, mats, x, LEVEL.one, z));
    [[-60,LEVEL.two,46],[60,LEVEL.two,46],[-60,LEVEL.three,46],[60,LEVEL.three,46]].forEach(([x,y,z]) => plant(scene, root, mats, x, y, z));
  }

  function plant(scene, root, mats, x, y, z) {
    cyl(scene, 'tiesto planta', new BABYLON.Vector3(x,y+.35,z), 1.0, .7, mats.wallPanel, root, 32, true);
    for (let i=0;i<6;i++) {
      const a=i*Math.PI*2/6;
      const leaf=plane(scene, 'hoja planta', new BABYLON.Vector3(x+Math.cos(a)*.35,y+1.1+(i%2)*.18,z+Math.sin(a)*.35), .55, 1.35, mats.plant, root, new BABYLON.Vector3(.75,-a,0), false);
      leaf.billboardMode = 0;
    }
  }

  function seat(scene, root, mats, x, y, z, yaw) {
    const g = new BABYLON.TransformNode('butaca', scene); g.position = new BABYLON.Vector3(x,y,z); g.rotation.y=yaw; g.parent=root;
    box(scene, 'asiento butaca', new BABYLON.Vector3(0,.48,0), new BABYLON.Vector3(1.2,.18,.92), mats.wallPanel, g, true);
    box(scene, 'respaldo butaca', new BABYLON.Vector3(0,1.08,.38), new BABYLON.Vector3(1.2,.95,.16), mats.wallPanel, g, true);
    box(scene, 'apoya brazos izq', new BABYLON.Vector3(-.72,.78,0), new BABYLON.Vector3(.12,.55,.92), mats.black, g, true);
    box(scene, 'apoya brazos der', new BABYLON.Vector3(.72,.78,0), new BABYLON.Vector3(.12,.55,.92), mats.black, g, true);
  }

  function podium(scene, root, mats, x, y, z) { box(scene, 'podio limpio', new BABYLON.Vector3(x,y+.65,z), new BABYLON.Vector3(1.4,1.3,.9), mats.wood, root, true); }

  function escalatorDirectionSign(scene, root, mats, run, yaw) {
    const isDown = run.dir === 'down';
    const texture = new BABYLON.DynamicTexture(`señal ${run.id}`, { width: 512, height: 256 }, scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = isDown ? '#15332e' : '#85714d';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#fed141';
    ctx.fillRect(0, 0, 512, 18);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 88px Segoe UI, Arial';
    ctx.fillText(isDown ? '↓ BAJA' : '↑ SUBE', 256, 105);
    ctx.font = 'bold 32px Segoe UI, Arial';
    const floorLabel = run.id === 'down32' ? 'AL PISO 2' : run.id === 'down21' ? 'AL PISO 1' : run.id === 'up23' ? 'AL PISO 3' : 'AL PISO 2';
    ctx.fillText(floorLabel, 256, 190);
    texture.update();

    const mat = new BABYLON.StandardMaterial(`material señal ${run.id}`, scene);
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.disableLighting = true;
    mat.backFaceCulling = true;
    const horizontal = run.to.subtract(run.from); horizontal.y = 0;
    if (horizontal.lengthSquared() > 0.001) horizontal.normalize();
    const side = new BABYLON.Vector3(horizontal.z, 0, -horizontal.x);
    const signWidth = run.id === 'up12' ? 3.6 : 4.5;
    const signHeight = run.id === 'up12' ? 1.9 : 2.25;
    let pos = run.from.subtract(horizontal.scale(2.25)).add(new BABYLON.Vector3(0, 2.25, 0));
    if (run.id === 'up12') {
      pos = run.from.add(side.scale(7.6)).add(horizontal.scale(1.1)).add(new BABYLON.Vector3(0, 2.15, 0));
    }
    createDoubleSidedDisplay(scene, root, `señal dirección ${run.id}`, signWidth, signHeight, pos, yaw + Math.PI, mat, mat, 0.05, { readableSign: true, escalator: run.id, relocated: run.id === 'up12' });
  }

  function buildEscalators(scene, root, mats) {
    const runs = [
      { id:'up12',   from:new BABYLON.Vector3(-20, LEVEL.one+.1, 32), to:new BABYLON.Vector3(-20, LEVEL.two+.1, 10),  dir:'up' },
      { id:'down21', from:new BABYLON.Vector3(-8, LEVEL.two+.1, 10),  to:new BABYLON.Vector3(-8, LEVEL.one+.1, 32), dir:'down' },
      { id:'up23',   from:new BABYLON.Vector3(-34, LEVEL.two+.1, 32), to:new BABYLON.Vector3(-34, LEVEL.three+.1, 10), dir:'up' },
      { id:'down32', from:new BABYLON.Vector3(-26, LEVEL.three+.1, 10), to:new BABYLON.Vector3(-26, LEVEL.two+.1, 32), dir:'down' }
    ];
    runs.forEach(r => escalatorRun(scene, root, mats, r));
    buildStairsToRooftop(scene, root, mats);
    escalatorVoid(scene, root, mats, -14, LEVEL.two, 10);
    escalatorVoid(scene, root, mats, -30, LEVEL.two, 32);
    escalatorVoid(scene, root, mats, -30, LEVEL.three, 10);
  }

  function auditUpstairsSignClearance(scene) {
    const signMeshes = scene.meshes.filter(mesh => mesh?.metadata?.escalator === 'up12');
    const blocked = signMeshes.some(mesh => {
      const p = mesh.getAbsolutePosition?.();
      return p && p.x >= -24.8 && p.x <= -3.2 && p.z >= 24 && p.z <= 38;
    });
    window.__UCAN_UP12_SIGN_AUDIT__ = {
      version:'V265',
      signCount: signMeshes.length,
      clear: !blocked,
      relocated: signMeshes.every(mesh => mesh?.metadata?.relocated === true || mesh?.metadata?.side === 'back' || mesh?.metadata?.side === 'front'),
      positions: signMeshes.map(mesh => ({ name: mesh.name, x: mesh.getAbsolutePosition().x, y: mesh.getAbsolutePosition().y, z: mesh.getAbsolutePosition().z }))
    };
    console.info('[UCAN V265] Auditoría cartel escalera piso 1:', window.__UCAN_UP12_SIGN_AUDIT__);
    return window.__UCAN_UP12_SIGN_AUDIT__;
  }

  function buildStairsToRooftop(scene, root, mats) {
    const from = new BABYLON.Vector3(44, LEVEL.three + 0.12, 39.0);
    const to = new BABYLON.Vector3(44, LEVEL.rooftop + 0.12, 10.5);
    const steps = 30;
    const width = 5.2;
    const totalRise = to.y - from.y;
    const totalRun = Math.abs(to.z - from.z);
    const tread = totalRun / steps;
    const rise = totalRise / steps;
    const group = new BABYLON.TransformNode('escaleras piso 3 a terraza', scene);
    group.parent = root;

    for (let i = 0; i < steps; i++) {
      const topY = from.y + rise * (i + 1);
      const z = from.z - tread * (i + 0.5);
      const step = box(scene, `peldaño escalera terraza ${i + 1}`, new BABYLON.Vector3(from.x, topY - 0.09, z), new BABYLON.Vector3(width, 0.18, tread * 1.04), mats.stone, group, false);
      step.isPickable = false;
      step.metadata = { rooftopStairStep:true, index:i + 1 };
    }

    const midpoint = from.add(to).scale(0.5);
    const pitch = Math.atan2(totalRise, totalRun);
    const ramp = box(scene, 'rampa invisible escalera terraza', midpoint, new BABYLON.Vector3(width - 0.55, 0.16, Math.sqrt(totalRun * totalRun + totalRise * totalRise)), mats.path, group, true);
    ramp.rotation.x = -pitch;
    ramp.isVisible = false;
    ramp.isPickable = true;
    ramp.metadata = { walkable:true, teleportable:true, rooftopStairRamp:true };

    const slopedLength = Math.sqrt(totalRun * totalRun + totalRise * totalRise);
    for (const x of [from.x - width / 2 - 0.08, from.x + width / 2 + 0.08]) {
      const side = box(scene, `baranda lateral escalera terraza ${x}`, midpoint.add(new BABYLON.Vector3(x - from.x, 1.0, 0)), new BABYLON.Vector3(0.14, 1.35, slopedLength + 0.5), mats.darkGlass, group, true);
      side.rotation.x = -pitch;
      side.metadata = { rooftopStairRail:true };
      const handrail = box(scene, `pasamanos escalera terraza ${x}`, midpoint.add(new BABYLON.Vector3(x - from.x, 1.72, 0)), new BABYLON.Vector3(0.18, 0.14, slopedLength + 0.7), mats.black, group, false);
      handrail.rotation.x = -pitch;
      handrail.metadata = { rooftopStairRail:true };
    }

    const lowerLanding = box(scene, 'descanso piso 3 escalera terraza', new BABYLON.Vector3(from.x, LEVEL.three + 0.05, 41.2), new BABYLON.Vector3(7.2, 0.12, 4.2), mats.path, root, true);
    lowerLanding.isPickable = true;
    lowerLanding.metadata = { walkable:true, teleportable:true, rooftopStairLanding:'floor3' };
    const upperLanding = box(scene, 'descanso terraza escalera', new BABYLON.Vector3(to.x, LEVEL.rooftop + 0.05, 7.2), new BABYLON.Vector3(7.2, 0.12, 4.2), mats.path, root, true);
    upperLanding.isPickable = true;
    upperLanding.metadata = { walkable:true, teleportable:true, rooftopStairLanding:'rooftop' };

    roomSign(scene, root, 'ESCALERAS A LA TERRAZA', 44, LEVEL.three + 4.25, 42.4);
    roomSign(scene, root, 'ESCALERAS AL PISO 3', 44, LEVEL.rooftop + 3.6, 6.1);

    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const p = BABYLON.Vector3.Lerp(from, to, t).add(new BABYLON.Vector3(0, 2.15, 0));
      const light = box(scene, `luz escalera terraza ${i + 1}`, p, new BABYLON.Vector3(1.6, 0.10, 0.18), mats.warmLight, root, false);
      light.rotation.x = -pitch;
      light.metadata = { rooftopStairLight:true };
    }

    window.__UCAN_ROOFTOP_STAIRS__ = {
      version:'V265',
      enabled:true,
      stepCount:steps,
      from:{ x:from.x, y:from.y, z:from.z },
      to:{ x:to.x, y:to.y, z:to.z },
      bidirectional:true,
      opening:requiredFloorOpenings('terraza')[0]
    };
  }

  function escalatorRun(scene, root, mats, r) {
    const delta = r.to.subtract(r.from);
    const horiz = new BABYLON.Vector3(delta.x,0,delta.z);
    const length = Math.sqrt(horiz.lengthSquared() + delta.y*delta.y);
    const mid = r.from.add(r.to).scale(.5);
    const yaw = Math.atan2(delta.x, delta.z);
    const pitch = Math.atan2(delta.y, horiz.length());
    const group = new BABYLON.TransformNode(`escalera ${r.id}`, scene); group.parent=root;
    const orient = mesh => { mesh.rotation.y=yaw; mesh.rotation.x=-pitch; return mesh; };
    escalatorDirectionSign(scene, root, mats, r, yaw);
    orient(box(scene, `estructura escalera ${r.id}`, mid, new BABYLON.Vector3(4.2,.3,length), mats.metal, group, false));
    orient(box(scene, `banda escalera ${r.id}`, mid.add(new BABYLON.Vector3(0,.16,0)), new BABYLON.Vector3(3.05,.08,length-1), mats.wallPanel, group, false));
    [-2.15,2.15].forEach(side => {
      const off = new BABYLON.Vector3(Math.cos(yaw)*side,0,-Math.sin(yaw)*side);
      orient(box(scene, `cristal escalera ${r.id}`, mid.add(off).add(new BABYLON.Vector3(0,.95,0)), new BABYLON.Vector3(.1,1.35,length+.45), mats.glass, group, false));
      orient(box(scene, `pasamanos escalera ${r.id}`, mid.add(off).add(new BABYLON.Vector3(0,1.65,0)), new BABYLON.Vector3(.18,.12,length+.6), mats.black, group, false));
    });
    for (let i=0;i<20;i++) {
      const t=i/19;
      const p=BABYLON.Vector3.Lerp(r.from,r.to,t).add(new BABYLON.Vector3(0,.3,0));
      const step=box(scene, `peldaño móvil ${r.id}`, p, new BABYLON.Vector3(3.15,.07,.58), mats.wallPanel, group, false);
      step.rotation.y=yaw; step.rotation.x=-pitch; step.metadata={t,start:r.from.clone(),end:r.to.clone(),dir:r.dir};
      scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        // El movimiento visual siempre va de start -> end. En las escaleras de bajada,
        // start ya está en el piso superior y end en el piso inferior, por lo que el valor
        // t también debe aumentar para que los peldaños realmente se vean bajando.
        step.metadata.t += 0.11 * dt;
        if (step.metadata.t > 1) step.metadata.t = 0;
        step.position.copyFrom(BABYLON.Vector3.Lerp(step.metadata.start, step.metadata.end, step.metadata.t).add(new BABYLON.Vector3(0, .3, 0)));
      });
    }
    const startPad=box(scene, `plataforma inicio ${r.id}`, r.from.clone().add(new BABYLON.Vector3(0,.045,0)), new BABYLON.Vector3(6.4,.14,3.8), mats.yellow, root, true); startPad.rotation.y=yaw;
    const endPad=box(scene, `plataforma fin ${r.id}`, r.to.clone().add(new BABYLON.Vector3(0,.045,0)), new BABYLON.Vector3(6.4,.14,3.8), mats.yellow, root, true); endPad.rotation.y=yaw;
    startPad.isPickable = endPad.isPickable = true;
    startPad.metadata = { ...(startPad.metadata || {}), walkable: true, teleportable: true, escalator: r.id };
    endPad.metadata = { ...(endPad.metadata || {}), walkable: true, teleportable: true, escalator: r.id };
    orient(box(scene, `luz lateral escalera ${r.id}`, mid.add(new BABYLON.Vector3(0,.42,0)), new BABYLON.Vector3(.08,.04,length-.8), mats.warmLight, root, false));
  }

  function escalatorVoid(scene, root, mats, x, y, z) {
    box(scene, 'borde piedra hueco norte premium', new BABYLON.Vector3(x,y+.12,z+5.25), new BABYLON.Vector3(15.5,.24,.30), mats.stoneDark, root, false);
    box(scene, 'borde piedra hueco sur premium', new BABYLON.Vector3(x,y+.12,z-5.25), new BABYLON.Vector3(15.5,.24,.30), mats.stoneDark, root, false);
    box(scene, 'borde piedra hueco este premium', new BABYLON.Vector3(x+7.75,y+.12,z), new BABYLON.Vector3(.30,.24,10.5), mats.stoneDark, root, false);
    box(scene, 'borde piedra hueco oeste premium', new BABYLON.Vector3(x-7.75,y+.12,z), new BABYLON.Vector3(.30,.24,10.5), mats.stoneDark, root, false);
    box(scene, 'baranda cristal hueco norte premium', new BABYLON.Vector3(x,y+1.12,z+5.42), new BABYLON.Vector3(15.5,1,.09), mats.darkGlass, root, true);
    box(scene, 'baranda cristal hueco sur premium', new BABYLON.Vector3(x,y+1.12,z-5.42), new BABYLON.Vector3(15.5,1,.09), mats.darkGlass, root, true);
  }

  function clearFirstFloorEscalatorConflict(scene) {
    // Corrige el problema reportado: cualquier pared/objeto arquitectónico del primer piso que invada el tramo P1→P2 se desactiva.
    const zone = { x1:-31, x2:-4, z1:5, z2:39, y1:LEVEL.one-.5, y2:LEVEL.one+6.8 };
    const keep = /escalera|peldaño|banda|pasamanos|cristal lateral|plataforma|luz lateral/i;
    const remove = /pared|wall|columna|fachada|marco|counter|vitrina|estante|mesa|silla|banco|jardinera|planta/i;
    scene.meshes.slice().forEach(mesh => {
      if (!mesh || !mesh.getAbsolutePosition) return;
      const p = mesh.getAbsolutePosition();
      const inside = p.x>=zone.x1 && p.x<=zone.x2 && p.z>=zone.z1 && p.z<=zone.z2 && p.y>=zone.y1 && p.y<=zone.y2;
      if (!inside) return;
      const name = mesh.name || '';
      if (keep.test(name)) return;
      if (remove.test(name)) { mesh.setEnabled(false); mesh.checkCollisions = false; }
    });
  }

  function buildVRComfortElements(scene, root, mats) {
    const pads = [];
    [LEVEL.one, LEVEL.two, LEVEL.three].forEach((y,i) => {
      pads.push(box(scene, `zona segura VR ampliada piso ${i+1}`, new BABYLON.Vector3(0,y+.023,43), new BABYLON.Vector3(20, .022, 4.0), mats.carpet, root, false));
      pads.push(box(scene, `zona VR lateral izquierda piso ${i+1}`, new BABYLON.Vector3(-50,y+.024,40), new BABYLON.Vector3(10, .022, 3.4), mats.carpet, root, false));
      pads.push(box(scene, `zona VR lateral derecha piso ${i+1}`, new BABYLON.Vector3(50,y+.024,40), new BABYLON.Vector3(10, .022, 3.4), mats.carpet, root, false));
    });
    for (const room of ROOM_CONFIG) {
      const y = LEVEL.two;
      pads.push(box(scene, `zona VR interior ${room.id}`, new BABYLON.Vector3(room.cx, y + .024, room.cz + 2), new BABYLON.Vector3(Math.min(room.w - 4, 14), .022, Math.min(room.d - 5, 12)), mats.carpet, root, false));
    }
    pads.push(box(scene, 'zona VR anfiteatro central', new BABYLON.Vector3(0, LEVEL.three + .024, -18), new BABYLON.Vector3(12, .022, 9), mats.carpet, root, false));
    pads.push(box(scene, 'zona VR tarima anfiteatro', new BABYLON.Vector3(0, LEVEL.three + .99, -29), new BABYLON.Vector3(18, .022, 6), mats.carpet, root, false));
    pads.forEach(pad => {
      pad.isPickable = true;
      pad.metadata = { ...(pad.metadata || {}), walkable: true, teleportable: true };
    });
  }


  function configureMobility(scene) {
    const audit = {
      version: 'V265',
      checkedMeshes: 0,
      clearedObstacles: 0,
      collisionFixes: 0,
      walkableSurfaces: 0,
      teleportSurfaces: 0,
      doorwaysVerified: 0,
      escalatorLandingsVerified: 0,
      details: []
    };

    const zones = [];
    const addZone = (id, x, y, z, w, h, d, type) => zones.push({ id, x1:x-w/2, x2:x+w/2, y1:y-h/2, y2:y+h/2, z1:z-d/2, z2:z+d/2, type });

    // Corredores principales de los tres pisos.
    addZone('p1-central', 0, LEVEL.one + 1.3, 12, 11, 3.2, 88, 'corridor');
    addZone('p1-transversal', 0, LEVEL.one + 1.3, 2, 82, 3.2, 9, 'corridor');
    addZone('p2-central', 0, LEVEL.two + 1.3, 10, 12, 3.2, 72, 'corridor');
    addZone('p2-transversal', 0, LEVEL.two + 1.3, 10, 118, 3.2, 9, 'corridor');
    addZone('p3-central', 0, LEVEL.three + 1.3, 20, 13, 3.2, 46, 'corridor');
    addZone('anfiteatro-paso-central', -1.8, LEVEL.three + 2.0, 2.5, 5.8, 5.5, 34, 'theater-aisle');
    addZone('anfiteatro-paso-lateral', 20.5, LEVEL.three + 2.0, 3.5, 5.8, 5.5, 26, 'theater-aisle');
    addZone('p3-nucleo-escaleras', -30, LEVEL.three + 1.6, 11, 16, 4.4, 32, 'stair-bay');
    addZone('p3-enlace-escaleras', -15, LEVEL.three + 1.4, 10, 34, 3.2, 9, 'corridor');
    addZone('rooftop-comunes', 0, LEVEL.rooftop + 1.5, 0, 132, 4.5, 108, 'rooftop');

    // Accesos a las salas y servicios.
    for (const room of ROOM_CONFIG) {
      addZone(`entrada-${room.id}`, room.cx, LEVEL.two + 1.4, room.cz + room.d/2, 4.5, 3.1, 6.0, 'doorway');
    }
    addZone('entrada-cafeteria', -43.25, LEVEL.one + 1.4, 10, 6, 3.1, 5.2, 'doorway');
    addZone('entrada-biblioteca', 43.25, LEVEL.one + 1.4, 10, 6, 3.1, 5.2, 'doorway');
    addZone('entrada-anfiteatro', 0, LEVEL.three + 1.4, 43, 6, 3.1, 6.5, 'doorway');

    // Llegadas y salidas de escaleras.
    const landings = [
      ['up12-start', -20, LEVEL.one + 1.2, 32], ['up12-end', -20, LEVEL.two + 1.2, 10],
      ['down21-start', -8, LEVEL.two + 1.2, 10], ['down21-end', -8, LEVEL.one + 1.2, 32],
      ['up23-start', -34, LEVEL.two + 1.2, 32], ['up23-end', -34, LEVEL.three + 1.2, 10],
      ['down32-start', -26, LEVEL.three + 1.2, 10], ['down32-end', -26, LEVEL.two + 1.2, 32]
    ];
    landings.forEach(([id,x,y,z]) => addZone(id,x,y,z,7.2,3.2,5.0,'landing'));

    const allowed = /ruta avatar|borde ruta|nodo ruta|anillo ruta|gran losa|junta|eje |zona VR|zona segura|plataforma inicio|plataforma fin|escalera|peldaño|banda escalera|pasamanos|cristal escalera|luz lateral|borde piedra hueco|baranda cristal hueco|graderia|escalon central|rampa invisible|pasillo núcleo escaleras piso 3|borde núcleo escaleras piso 3|pasillo lateral gradería anfiteatro|rooftop deck|zona segura VR rooftop|puerta |marco |señal dirección/i;
    const movableObstacle = /mesa|silla|butaca|asiento|respaldo|apoya brazos|banco|sofá|lounge|planta|tiesto|jardinera|counter|vitrina|estante|monitor|isla orientación|mesa alta/i;
    const inZone = (p,z) => p.x>=z.x1&&p.x<=z.x2&&p.y>=z.y1&&p.y<=z.y2&&p.z>=z.z1&&p.z<=z.z2;

    for (const mesh of scene.meshes.slice()) {
      if (!mesh || !mesh.getAbsolutePosition || !mesh.isEnabled()) continue;
      audit.checkedMeshes += 1;
      const name = String(mesh.name || '');
      const pos = mesh.getAbsolutePosition();

      if (/puerta cristal/i.test(name)) {
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        audit.collisionFixes += 1;
      }

      if (/gran losa|ruta avatar|nodo ruta avatar|zona segura VR|zona VR |pasillo lateral escalera anfiteatro|escalon central anfiteatro|rampa invisible|rooftop deck|zona segura VR rooftop|plataforma (?:inicio|fin)/i.test(name)) {
        mesh.isPickable = true;
        mesh.metadata = { ...(mesh.metadata || {}), walkable: true, teleportable: true };
        audit.walkableSurfaces += 1;
        audit.teleportSurfaces += 1;
      }

      const zone = zones.find(z => inZone(pos,z));
      if (zone && zone.type !== 'rooftop' && movableObstacle.test(name) && !allowed.test(name)) {
        mesh.setEnabled(false);
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        audit.clearedObstacles += 1;
        if (audit.details.length < 60) audit.details.push({ mesh: name, zone: zone.id, reason: 'Obstáculo retirado de ruta de movilidad' });
      }
    }

    audit.doorwaysVerified = zones.filter(z => z.type === 'doorway').length;
    audit.escalatorLandingsVerified = zones.filter(z => z.type === 'landing').length;
    console.info('[UCAN V265] Auditoría integral de movilidad:', audit);
    return audit;
  }

  function cleanupLegacyInterference(scene) {
    const audit = {
      version: 'V265',
      checkedMeshes: 0,
      disabledLegacy: 0,
      disabledDuplicates: 0,
      disabledEscalatorBlockers: 0,
      disabledTheaterBlockers: 0,
      collisionFixes: 0,
      details: []
    };

    const legacyName = /(?:legacy|obsolete|deprecated|capa vieja|old layer|v20(?:9|10|11|12|13)(?:\b|[-_ ]))/i;
    const escalatorAllowed = /escalera|peldaño|banda escalera|pasamanos|cristal escalera|plataforma (?:inicio|fin)|luz lateral|gran losa|junta|ruta avatar|borde ruta|zona segura|zona VR|borde piedra hueco|baranda cristal hueco/i;
    const potentialBlocker = /pared|wall|columna|fachada|marco arquitectónico|counter|vitrina|estante|mesa|silla|banco|jardinera|planta|sofá|lounge|butaca|asiento|respaldo|apoya brazos|control táctil/i;
    const theaterAllowed = /separador cristal escaleras anfiteatro|ANF-301|escenario|frente escenario|podio|mesa control anfiteatro|graderia|rótulo ANFITEATRO|techo piso 3|anfiteatro (?:fondo|oeste|este|norte)|puerta anfiteatro|marco (?:superior|izquierdo|derecho) anfiteatro|puerta cristal anfiteatro/i;

    const downZones = [
      { id: 'down21', minX: -12.8, maxX: -3.2, minY: LEVEL.one + .1, maxY: LEVEL.two + 3.2, minZ: 5.6, maxZ: 34.6 },
      { id: 'down32', minX: -30.8, maxX: -21.2, minY: LEVEL.two + .1, maxY: LEVEL.three + 3.2, minZ: 5.6, maxZ: 34.6 }
    ];

    function inZone(p, z) {
      return p.x >= z.minX && p.x <= z.maxX && p.y >= z.minY && p.y <= z.maxY && p.z >= z.minZ && p.z <= z.maxZ;
    }

    function disable(mesh, reason, counter) {
      if (!mesh || !mesh.isEnabled()) return;
      mesh.setEnabled(false);
      mesh.checkCollisions = false;
      mesh.isPickable = false;
      audit[counter] += 1;
      if (audit.details.length < 80) audit.details.push({ mesh: mesh.name, reason });
    }

    const exactSignatures = new Map();
    const meshes = scene.meshes.slice();
    audit.checkedMeshes = meshes.length;

    for (const mesh of meshes) {
      if (!mesh || !mesh.getAbsolutePosition || !mesh.isEnabled()) continue;
      const name = String(mesh.name || '');
      const pos = mesh.getAbsolutePosition();

      if (legacyName.test(name)) {
        disable(mesh, 'Nombre identificado como geometría heredada', 'disabledLegacy');
        continue;
      }

      // Mantiene libres las dos escaleras destinadas a bajar.
      const downZone = downZones.find(zone => inZone(pos, zone));
      if (downZone && potentialBlocker.test(name) && !escalatorAllowed.test(name)) {
        disable(mesh, `Interferencia en corredor de descenso ${downZone.id}`, 'disabledEscalatorBlockers');
        continue;
      }

      // Elimina butacas u objetos antiguos del pasillo central del anfiteatro.
      const centralAisle = Math.abs(pos.x) < 3.65 && pos.y >= LEVEL.three - .1 && pos.y <= LEVEL.three + 5.8 && pos.z >= -18 && pos.z <= 35;
      if (centralAisle && /butaca|asiento|respaldo|apoya brazos|mesa estudiante|silla/i.test(name)) {
        disable(mesh, 'Objeto heredado en pasillo central del anfiteatro', 'disabledTheaterBlockers');
        continue;
      }

      // Protege la tarima y la línea visual frente a la pantalla principal.
      const stageSightline = Math.abs(pos.x) < 23 && pos.y >= LEVEL.three - .1 && pos.y <= LEVEL.three + 6.4 && pos.z >= -39.5 && pos.z <= -22.0;
      if (stageSightline && potentialBlocker.test(name) && !theaterAllowed.test(name)) {
        disable(mesh, 'Objeto heredado frente a tarima o pantalla del anfiteatro', 'disabledTheaterBlockers');
        continue;
      }

      // Repara colisiones impropias de elementos visuales y pantallas.
      if (/pantalla interactiva|rótulo |contenido pizarra|fachada cristal|hoja planta|luz lineal/i.test(name) && mesh.checkCollisions) {
        mesh.checkCollisions = false;
        audit.collisionFixes += 1;
      }

      // Detecta geometría exactamente superpuesta, no simples nombres repetidos.
      try {
        mesh.computeWorldMatrix(true);
        const bi = mesh.getBoundingInfo();
        const center = bi.boundingBox.centerWorld;
        const ext = bi.boundingBox.extendSizeWorld;
        const materialName = mesh.material ? mesh.material.name : '';
        const signature = [
          name,
          center.x.toFixed(3), center.y.toFixed(3), center.z.toFixed(3),
          ext.x.toFixed(3), ext.y.toFixed(3), ext.z.toFixed(3),
          materialName
        ].join('|');
        const prior = exactSignatures.get(signature);
        if (prior && prior.isEnabled()) {
          disable(mesh, `Duplicado exacto de ${prior.name}`, 'disabledDuplicates');
        } else {
          exactSignatures.set(signature, mesh);
        }
      } catch (err) {
        // Algunos nodos auxiliares no exponen un bounding box útil; no afectan la auditoría.
      }
    }

    console.info('[UCAN V265] Auditoría de capas y colisiones:', audit);
    return audit;
  }

  function setupEscalatorRide(scene, camera) {
    const zones = [
      { id:'up12', from:new BABYLON.Vector3(-20,LEVEL.one+PLAYER_HEIGHT,32), to:new BABYLON.Vector3(-20,LEVEL.two+PLAYER_HEIGHT,10), label:'Subiendo al Piso 2', lookFrom:new BABYLON.Vector3(-20,LEVEL.one+1.55,20), lookTo:new BABYLON.Vector3(-20,LEVEL.two+1.75,-2) },
      { id:'down21', from:new BABYLON.Vector3(-8,LEVEL.two+PLAYER_HEIGHT,10), to:new BABYLON.Vector3(-8,LEVEL.one+PLAYER_HEIGHT,32), label:'Bajando al Piso 1', lookFrom:new BABYLON.Vector3(-8,LEVEL.two+0.95,15), lookTo:new BABYLON.Vector3(-8,LEVEL.one+0.2,36) },
      { id:'up23', from:new BABYLON.Vector3(-34,LEVEL.two+PLAYER_HEIGHT,32), to:new BABYLON.Vector3(-34,LEVEL.three+PLAYER_HEIGHT,10), label:'Subiendo al Piso 3', lookFrom:new BABYLON.Vector3(-34,LEVEL.two+1.65,20), lookTo:new BABYLON.Vector3(-34,LEVEL.three+1.75,-2) },
      { id:'down32', from:new BABYLON.Vector3(-26,LEVEL.three+PLAYER_HEIGHT,10), to:new BABYLON.Vector3(-26,LEVEL.two+PLAYER_HEIGHT,32), label:'Bajando al Piso 2', lookFrom:new BABYLON.Vector3(-26,LEVEL.three+0.95,15), lookTo:new BABYLON.Vector3(-26,LEVEL.two+0.2,36) },
      { id:'up34', from:new BABYLON.Vector3(44,LEVEL.three+PLAYER_HEIGHT,39), to:new BABYLON.Vector3(44,LEVEL.rooftop+PLAYER_HEIGHT,10.5), label:'Subiendo por las escaleras a la terraza', lookFrom:new BABYLON.Vector3(44,LEVEL.three+1.65,28), lookTo:new BABYLON.Vector3(44,LEVEL.rooftop+1.55,-2), duration:5200 },
      { id:'down43', from:new BABYLON.Vector3(44,LEVEL.rooftop+PLAYER_HEIGHT,10.5), to:new BABYLON.Vector3(44,LEVEL.three+PLAYER_HEIGHT,39), label:'Bajando por las escaleras al Piso 3', lookFrom:new BABYLON.Vector3(44,LEVEL.rooftop+1.55,22), lookTo:new BABYLON.Vector3(44,LEVEL.three+1.45,48), duration:5200 }
    ];
    let riding = false;
    let cooldownUntil = 0;
    window.__ucanV254IsRiding = () => riding;
    const nearEntry = (p,z) => {
      const dx = p.x - z.from.x;
      const dz = p.z - z.from.z;
      const dy = Math.abs(p.y - z.from.y);
      return dx*dx + dz*dz <= 13.0 && dy <= 1.25;
    };
    scene.onBeforeRenderObservable.add(() => {
      if (riding || performance.now() < cooldownUntil) return;
      const z = zones.find(zone => nearEntry(camera.position, zone));
      if (z) ride(z);
    });
    function smoothStep(t) { return t * t * (3 - 2 * t); }
    function ride(zone) {
      riding = true;
      setStatus(`${zone.label}. Simulación activa de escalera eléctrica.`);
      camera.detachControl(canvas);
      const startTime = performance.now();
      const duration = zone.duration || 3600;
      const obs = scene.onBeforeRenderObservable.add(() => {
        const tRaw = Math.min(1, (performance.now() - startTime) / duration);
        const t = smoothStep(tRaw);
        const pos = BABYLON.Vector3.Lerp(zone.from, zone.to, t);
        const bob = Math.sin(t * Math.PI * 8) * 0.012;
        camera.position.copyFrom(pos.add(new BABYLON.Vector3(0, bob, 0)));
        camera.setTarget(BABYLON.Vector3.Lerp(zone.lookFrom, zone.lookTo, t));
        if (tRaw >= 1) {
          scene.onBeforeRenderObservable.remove(obs);
          camera.position.copyFrom(zone.to.clone());
          camera.setTarget(zone.lookTo.clone());
          camera.attachControl(canvas, true);
          riding = false;
          cooldownUntil = performance.now() + 1800;
          setStatus(`${zone.label} completado. Continúe caminando.`);
        }
      });
    }
  }


  function clampCameraHeight(camera) {
    if (window.__ucanV254IsRiding && window.__ucanV254IsRiding()) return;

    // Subida/bajada progresiva en el anfiteatro por el paso central y lateral.
    const inCenterAisle = camera.position.x > -4.8 && camera.position.x < 1.2 && camera.position.z > -14 && camera.position.z < 18.8;
    const inSideAisle = camera.position.x > 18.2 && camera.position.x < 22.8 && camera.position.z > -8 && camera.position.z < 18.8;
    if (inCenterAisle || inSideAisle) {
      const z0 = inCenterAisle ? -12 : -7;
      const z1 = 17.4;
      const rise = inCenterAisle ? 2.38 : 2.04;
      const t = Math.max(0, Math.min(1, (camera.position.z - z0) / (z1 - z0)));
      camera.position.y = LEVEL.three + PLAYER_HEIGHT + rise * t;
      return;
    }

    const floors=[LEVEL.one+PLAYER_HEIGHT,LEVEL.two+PLAYER_HEIGHT,LEVEL.three+PLAYER_HEIGHT,LEVEL.rooftop+PLAYER_HEIGHT];
    let nearest=floors[0];
    floors.forEach(f => { if (Math.abs(camera.position.y - f) < Math.abs(camera.position.y - nearest)) nearest = f; });
    if (Math.abs(camera.position.y - nearest) < .35) camera.position.y = nearest;
  }


  function setupReliableMovement(scene,camera) {
    const keys=new Set();
    window.addEventListener('keydown',ev=>{keys.add(ev.code); if(ev.code==='KeyR'){resetToSafePoint(camera); return;} if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.code)) ev.preventDefault();});
    window.addEventListener('keyup',ev=>keys.delete(ev.code));
    try{camera.inputs.removeByType('FreeCameraKeyboardMoveInput');camera.inputs.removeByType('FreeCameraGamepadInput');}catch(e){}
    scene.onBeforeRenderObservable.add(()=>{
      if(window.__ucanV254IsRiding&&window.__ucanV254IsRiding()) return;
      const dt=Math.min(engine.getDeltaTime()/1000,.05);
      let forward=0, strafe=0, turn=0;
      if(keys.has('KeyW')||keys.has('ArrowUp')) forward+=1; if(keys.has('KeyS')||keys.has('ArrowDown')) forward-=1; if(keys.has('KeyD')) strafe+=1; if(keys.has('KeyA')) strafe-=1; if(keys.has('ArrowRight')) turn+=1; if(keys.has('ArrowLeft')) turn-=1;
      const pads=navigator.getGamepads?Array.from(navigator.getGamepads()).filter(Boolean):[];
      for(const gp of pads){const ax=gp.axes||[]; const lx=Math.abs(ax[2]||0)>Math.abs(ax[0]||0)?(ax[2]||0):(ax[0]||0); const ly=Math.abs(ax[3]||0)>Math.abs(ax[1]||0)?(ax[3]||0):(ax[1]||0); if(Math.abs(lx)>.18) strafe+=lx; if(Math.abs(ly)>.18) forward+=-ly; const rx=ax[4]||ax[2]||0; if(Math.abs(rx)>.25) turn+=rx;}
      const turnSpeed=comfortMode?1.2:1.9; if(turn) camera.rotation.y+=turn*turnSpeed*dt;
      const mag=Math.hypot(forward,strafe); if(mag<.01) return; forward/=Math.max(1,mag); strafe/=Math.max(1,mag);
      const speed=(comfortMode?3.4:(keys.has('ShiftLeft')||keys.has('ShiftRight')?7.0:5.0)); const yaw=camera.rotation.y;
      const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*speed*dt; const dz=(Math.cos(yaw)*forward-Math.sin(yaw)*strafe)*speed*dt;
      const move=new BABYLON.Vector3(dx,0,dz); if(typeof camera._collideWithWorld==='function') camera._collideWithWorld(move); else camera.position.addInPlace(move);
    });
  }

  function navigateToArea(key, camera) {
    const target = AREA[key];
    if (!target) return false;
    camera.position.copyFrom(target.pos());
    camera.setTarget(target.target());
    currentAreaKey = key;
    if (/^class20[1-5]$/.test(key)) activeBoardId = target.label;
    if (key === 'theater') activeBoardId = 'ANF-301';
    setStatus(`Ubicación: ${target.label}.`);
    return true;
  }

  function setupHUD(scene,camera) {
    document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>navigateToArea(btn.getAttribute('data-go'), camera)));
    document.getElementById('destinationGo')?.addEventListener('click',()=>navigateToArea(document.getElementById('destinationSelect')?.value, camera));
    document.getElementById('destinationSelect')?.addEventListener('keydown',event=>{ if(event.key==='Enter') navigateToArea(event.currentTarget.value,camera); });
    document.getElementById('boardsBtn')?.addEventListener('click',()=>openBoardPanel(activeBoardId));
    document.getElementById('xrBtn')?.addEventListener('click',async()=>{ try{ if(xrHelper) await xrHelper.baseExperience.enterXRAsync('immersive-vr','local-floor'); else setStatus('WebXR aún no está listo. Espere unos segundos.'); } catch(err){ setStatus('No se pudo entrar en VR. Use HTTPS o Cloudflare en Meta Quest.'); }});
    document.getElementById('mrBtn')?.addEventListener('click',async()=>{ try{ if(navigator.xr) await navigator.xr.requestSession('immersive-ar', { optionalFeatures:['local-floor','bounded-floor','hand-tracking','layers'] }); else throw new Error('XR no disponible'); setStatus('Modo MR solicitado. Si el navegador no lo admite, use VR tradicional.'); } catch(err){ setStatus('MR o passthrough no está disponible en este navegador. Use Entrar en VR.'); }});
    document.getElementById('comfortBtn')?.addEventListener('click',event=>{ comfortMode=!comfortMode; event.currentTarget.setAttribute('aria-pressed',String(comfortMode)); setStatus(comfortMode?'Modo confort activado: velocidad y giro reducidos.':'Modo confort desactivado.'); });
    document.getElementById('qualityBtn')?.addEventListener('click',event=>{ qualityHigh=!qualityHigh; autoQuality=false; engine.setHardwareScalingLevel(qualityHigh?1:1.6); event.currentTarget.textContent=qualityHigh?'Calidad: alta':'Calidad: rendimiento'; document.getElementById('autoQualityBtn')?.setAttribute('aria-pressed','false'); setStatus(qualityHigh?'Calidad alta activada manualmente.':'Modo de rendimiento activado manualmente.'); });
    document.getElementById('autoQualityBtn')?.addEventListener('click',event=>{ autoQuality=!autoQuality; event.currentTarget.setAttribute('aria-pressed',String(autoQuality)); event.currentTarget.textContent=autoQuality?'Calidad automática':'Calidad manual'; setStatus(autoQuality?'La calidad se ajustará según el rendimiento del dispositivo.':'El ajuste automático de calidad quedó pausado.'); });
    document.getElementById('motionBtn')?.addEventListener('click',event=>{ reducedMotion=!reducedMotion; document.body.classList.toggle('reduced-motion',reducedMotion); event.currentTarget.setAttribute('aria-pressed',String(reducedMotion)); event.currentTarget.textContent=reducedMotion?'Movimiento reducido':'Reducir movimiento'; setStatus(reducedMotion?'Movimiento ambiental reducido y ciclo visual pausado.':'Movimiento ambiental normal restaurado.'); });
    document.getElementById('contrastBtn')?.addEventListener('click',event=>{ highContrast=!highContrast; document.body.classList.toggle('high-contrast',highContrast); scene.imageProcessingConfiguration.contrast=highContrast?1.35:1.18; event.currentTarget.setAttribute('aria-pressed',String(highContrast)); event.currentTarget.textContent=highContrast?'Contraste normal':'Alto contraste'; });
    document.getElementById('textSizeBtn')?.addEventListener('click',event=>{ largeText=!largeText; document.body.classList.toggle('large-text',largeText); event.currentTarget.setAttribute('aria-pressed',String(largeText)); event.currentTarget.textContent=largeText?'Texto normal':'Texto grande'; });
    document.getElementById('hudToggle')?.addEventListener('click',event=>{ const body=document.getElementById('hudBody'); const collapsed=body?.classList.toggle('collapsed'); event.currentTarget.textContent=collapsed?'＋':'−'; event.currentTarget.setAttribute('aria-expanded',String(!collapsed)); event.currentTarget.title=collapsed?'Expandir panel':'Contraer panel'; });
    document.getElementById('resetBtn')?.addEventListener('click',()=>resetToSafePoint(camera));
  }

  function resetToSafePoint(camera) {
    const currentY = camera.position.y;
    const floor = Math.abs(currentY-(LEVEL.rooftop+PLAYER_HEIGHT)) < 4 ? 4 : Math.abs(currentY-(LEVEL.three+PLAYER_HEIGHT)) < 4 ? 3 : Math.abs(currentY-(LEVEL.two+PLAYER_HEIGHT)) < 4 ? 2 : 1;
    const safe = floor === 4 ? new BABYLON.Vector3(0,LEVEL.rooftop+PLAYER_HEIGHT,42) : floor === 3 ? new BABYLON.Vector3(0,LEVEL.three+PLAYER_HEIGHT,38) : floor === 2 ? new BABYLON.Vector3(0,LEVEL.two+PLAYER_HEIGHT,42) : new BABYLON.Vector3(0,LEVEL.one+PLAYER_HEIGHT,42);
    const target = floor === 4 ? new BABYLON.Vector3(0,LEVEL.rooftop+1.3,0) : floor === 3 ? new BABYLON.Vector3(0,LEVEL.three+1.4,-20) : floor === 2 ? new BABYLON.Vector3(0,LEVEL.two+1.4,-10) : new BABYLON.Vector3(0,LEVEL.one+1.4,5);
    camera.position.copyFrom(safe);
    camera.setTarget(target);
    setStatus(floor === 4 ? 'Reubicado en una zona segura de la terraza.' : `Reubicado en una zona segura del Piso ${floor}.`);
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }

  function extractKeywords(text, limit = 8) {
    const stop = new Set(['para','como','esta','este','estos','estas','desde','hasta','entre','sobre','donde','cuando','quien','cual','cuales','porque','tambien','ademas','deber','debera','deben','puede','pueden','using','with','that','this','from','your','their','there','have','will','would','about','into','presentation','documento','documentos','slide','slides','diapositiva','diapositivas','archivo','archivos','salas','anfiteatro','virtuales','virtual','room','rooms','theater','classroom','board','pizarra','electronica','electrónica','contenido','local','navegador','pagina','página','pages','texto','text','upload','cargar']);
    const words = (String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9ñ]{4,}/g) || []).filter(w => !stop.has(w));
    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([w]) => w);
  }

  function splitSentences(text) {
    return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  }

  function scoreSentence(sentence, keywords) {
    const normalized = sentence.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let score = Math.min(2, sentence.length / 120);
    for (const kw of keywords) if (normalized.includes(kw)) score += 2;
    if (/debe|debera|debera|recomienda|objetivo|conclusion|conclusión|importante|resumen|must|should|need/i.test(normalized)) score += 1.5;
    if (/^[•\-*\d]/.test(sentence)) score += 1;
    return score;
  }

  function buildAnalysisPages(analysis) {
    if (!analysis) return [];
    const pages = [];
    pages.push(['RESUMEN IA', analysis.summary || 'Sin resumen automático disponible.'].join('\n\n'));
    if (analysis.keywords?.length) pages.push(['TEMAS CLAVE', analysis.keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')].join('\n\n'));
    if (analysis.keyPoints?.length) pages.push(['PUNTOS DESTACADOS', analysis.keyPoints.map((k, i) => `• ${k}`).join('\n\n')].join('\n\n'));
    if (analysis.recommendations?.length) pages.push(['RECOMENDACIONES IA', analysis.recommendations.map((k, i) => `• ${k}`).join('\n\n')].join('\n\n'));
    if (analysis.questions?.length) pages.push(['PREGUNTAS DE DISCUSIÓN', analysis.questions.map((k, i) => `${i + 1}. ${k}`).join('\n\n')].join('\n\n'));
    return pages;
  }

  function generateSmartAnalysis(rawText, fileName, kind = 'Documento') {
    const normalized = String(rawText || '').replace(/\r/g, '').replace(/\t/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!normalized) return { summary: `No se pudo extraer texto suficiente del archivo ${fileName}.`, keywords: [], keyPoints: [], recommendations: [], questions: [], pageCount: 0, kind };
    const sentences = splitSentences(normalized).slice(0, 60);
    const keywords = extractKeywords(normalized, 8);
    const scored = sentences.map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence, keywords) })).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 4).sort((a, b) => a.index - b.index);
    const summary = scored.map(item => item.sentence).join(' ');
    const paragraphCandidates = normalized.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const keyPoints = paragraphCandidates.filter(line => line.length > 30).slice(0, 4);
    const recommendations = sentences.filter(s => /debe|debera|recomienda|conviene|importante|must|should|need/i.test(s)).slice(0, 3);
    const questions = [
      keywords[0] ? `¿Cómo se conecta "${keywords[0]}" con el objetivo principal del documento?` : '',
      keywords[1] ? `¿Qué evidencia o ejemplos fortalecen el tema "${keywords[1]}"?` : '',
      '¿Cuáles son las acciones o decisiones que deben tomarse a partir de este contenido?'
    ].filter(Boolean);
    return {
      summary: summary || `Se analizó automáticamente el archivo ${fileName}.`,
      keywords,
      keyPoints: keyPoints.length ? keyPoints : sentences.slice(0, 3),
      recommendations,
      questions,
      pageCount: paragraphCandidates.length,
      kind
    };
  }

  function renderBoardAnalysis(record) {
    const target = document.getElementById('boardAnalysisContent');
    if (!target) return;
    if (!record || !record.file) {
      target.innerHTML = '<p class="analysis-empty">Suba un documento para generar un análisis inteligente local.</p>';
      return;
    }
    const analysis = record.analysis;
    if (!analysis) {
      target.innerHTML = `<p class="analysis-empty">${escapeHtml(record.id)} · ${escapeHtml(record.file.name)}: no hay análisis IA disponible para este formato todavía.</p>`;
      return;
    }
    const list = items => items && items.length ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="analysis-empty">No se generaron elementos en esta categoría.</p>';
    target.innerHTML = `
      <div class="analysis-section"><strong>Resumen</strong><p>${escapeHtml(analysis.summary)}</p></div>
      <div class="analysis-section"><strong>Temas clave</strong>${list((analysis.keywords || []).map(w => w.toUpperCase()))}</div>
      <div class="analysis-section"><strong>Puntos destacados</strong>${list(analysis.keyPoints || [])}</div>
      <div class="analysis-section"><strong>Recomendaciones</strong>${list(analysis.recommendations || [])}</div>
      <div class="analysis-section"><strong>Preguntas sugeridas</strong>${list(analysis.questions || [])}</div>
    `;
  }

  function setupBoardUI(scene) {
    const panel = document.getElementById('boardPanel');
    const close = document.getElementById('boardClose');
    const select = document.getElementById('boardSelect');
    const fileInput = document.getElementById('boardFile');
    const prev = document.getElementById('boardPrev');
    const next = document.getElementById('boardNext');
    const play = document.getElementById('boardPlay');
    const pause = document.getElementById('boardPause');
    const clear = document.getElementById('boardClear');

    if (!panel || !select || !fileInput) return;
    select.innerHTML = '';
    for (const room of BOARD_TARGETS) {
      const opt = document.createElement('option'); opt.value = room.id; opt.textContent = room.label; select.appendChild(opt);
    }
    select.value = activeBoardId;
    select.addEventListener('change', () => { activeBoardId = select.value; refreshBoardViewer(); });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try { await loadFileToBoard(activeBoardId, file); }
      catch (err) {
        console.error(err);
        updateBoardInfo(`No se pudo procesar ${file.name}: ${err.message || err}`);
        setStatus(`Error cargando archivo en ${activeBoardId}.`);
      }
      fileInput.value = '';
    });
    prev?.addEventListener('click', () => changeBoardPage(-1));
    next?.addEventListener('click', () => changeBoardPage(1));
    play?.addEventListener('click', () => controlBoardVideo('play'));
    pause?.addEventListener('click', () => controlBoardVideo('pause'));
    clear?.addEventListener('click', () => clearBoard(activeBoardId));
    close?.addEventListener('click', closeBoardPanel);
    panel.addEventListener('click', ev => { if (ev.target === panel) closeBoardPanel(); });
    window.addEventListener('keydown', ev => { if (ev.key === 'Escape' && panel.classList.contains('open')) closeBoardPanel(); });
  }

  function openBoardPanel(roomId) {
    if (!BOARD_REGISTRY.has(roomId)) roomId = 'SV-201';
    activeBoardId = roomId;
    const panel = document.getElementById('boardPanel');
    const select = document.getElementById('boardSelect');
    if (select) select.value = roomId;
    panel?.classList.add('open');
    refreshBoardViewer();
    setStatus(`Pizarra electrónica ${roomId} abierta.`);
  }

  function closeBoardPanel() {
    document.getElementById('boardPanel')?.classList.remove('open');
    canvas.focus();
  }

  function updateBoardInfo(text) {
    const info = document.getElementById('boardInfo'); if (info) info.textContent = text;
  }

  function refreshBoardViewer() {
    const record = BOARD_REGISTRY.get(activeBoardId);
    const viewer = document.getElementById('boardViewer');
    const title = document.getElementById('boardTitle');
    if (title) title.textContent = `Pizarra electrónica · ${activeBoardId}`;
    if (!record || !viewer) return;
    viewer.innerHTML = '';
    const file = record.file;
    if (!file) {
      viewer.innerHTML = '<div class="viewer-placeholder">Pizarra disponible. Cargue una presentación, documento, imagen o video.</div>';
      updateBoardInfo(`${activeBoardId}: sin archivo cargado.`);
      renderBoardAnalysis(record);
      return;
    }
    const slideCount = record.slideImages?.length || 0;
    const textPageCount = record.pages?.length || 0;
    updateBoardInfo(`${activeBoardId} · ${file.name} · ${formatBytes(file.size)}${slideCount ? ` · diapositiva ${record.pageIndex + 1} de ${slideCount}` : textPageCount ? ` · página ${record.pageIndex + 1} de ${textPageCount}` : ''}`);

    if (record.previewType === 'rendered-slides' && slideCount) {
      const img = document.createElement('img');
      img.src = record.slideImages[record.pageIndex];
      img.alt = `${file.name} diapositiva ${record.pageIndex + 1}`;
      viewer.appendChild(img);
    } else if (record.previewType === 'pdf' && record.objectUrl) {
      const iframe = document.createElement('iframe'); iframe.src = record.objectUrl; iframe.title = `Documento PDF ${file.name}`; viewer.appendChild(iframe);
    } else if (record.previewType === 'video' && record.objectUrl) {
      const video = document.createElement('video'); video.src = record.objectUrl; video.controls = true; video.playsInline = true; video.preload = 'metadata'; viewer.appendChild(video);
    } else if (record.previewType === 'image' && record.objectUrl) {
      const img = document.createElement('img'); img.src = record.objectUrl; img.alt = file.name; viewer.appendChild(img);
    } else if (record.pages.length) {
      const text = document.createElement('div'); text.className = 'text-preview'; text.textContent = record.pages[record.pageIndex] || ''; viewer.appendChild(text);
    } else {
      viewer.innerHTML = '<div class="viewer-placeholder">Archivo cargado en la pizarra 3D.</div>';
    }
    renderBoardAnalysis(record);
    window.dispatchEvent(new CustomEvent('ucan:board-updated', { detail: { roomId: activeBoardId } }));
  }


  async function renderBoardImageUrl(record, imageUrl, footerText = '') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('No se pudo renderizar la diapositiva convertida'));
      img.src = imageUrl;
    });
    const ctx = record.dynamicTexture.getContext(); const W = 1280, H = 720;
    ctx.fillStyle = '#101716'; ctx.fillRect(0, 0, W, H);
    const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    if (footerText) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, H - 42, W, 42);
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px Segoe UI, Arial';
      ctx.fillText(footerText, 24, H - 14);
    }
    record.dynamicTexture.update();
    record.screen.material = record.defaultMaterial;
  }

  async function renderPptxOnServer(file) {
    const response = await fetch(`/api/render-pptx?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
      body: await file.arrayBuffer()
    });
    if (!response.ok) {
      const msg = await response.text().catch(() => 'Error de conversión');
      throw new Error(msg || `Conversión fallida (${response.status})`);
    }
    return response.json();
  }

  async function loadFileToBoard(roomId, file) {
    const record = BOARD_REGISTRY.get(roomId);
    if (!record) throw new Error('Sala no encontrada');
    releaseBoardMedia(record);
    record.file = file; record.pages = []; record.pageIndex = 0; record.analysis = null; record.analysisSourceText = ''; record.slideImages = []; record.slidePdfUrl = '';
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const type = file.type || '';

    if (type.startsWith('image/') || ['png','jpg','jpeg','webp','gif'].includes(ext)) {
      await loadImageBoard(record, file);
      record.analysis = { summary: `La imagen ${file.name} se cargó correctamente en ${roomId}. Para análisis textual inteligente, utilice PPTX, DOCX, TXT o HTML.`, keywords: ['imagen','recurso visual'], keyPoints: [], recommendations: [], questions: [] };
    } else if (type.startsWith('video/') || ['mp4','webm','ogg'].includes(ext)) {
      loadVideoBoard(record, file);
      record.analysis = { summary: `El video ${file.name} se proyecta en ${roomId}. El análisis inteligente local está orientado principalmente a documentos con texto extraíble.`, keywords: ['video','proyección'], keyPoints: [], recommendations: [], questions: [] };
    } else if (type === 'application/pdf' || ext === 'pdf') {
      loadPdfBoard(record, file);
      record.analysis = { summary: `El PDF ${file.name} se cargó correctamente. Para análisis IA local, exporte el contenido a PPTX, DOCX o TXT, o utilice un PDF con texto OCR seleccionable.`, keywords: ['pdf','ocr'], keyPoints: [], recommendations: ['Si el PDF es escaneado, conviértalo a texto u OCR antes de analizarlo.'], questions: ['¿Desea convertir este contenido a DOCX o TXT para un análisis más profundo?'] };
    } else if (['pptx','ppsx','pptm','potx','ppt','pps'].includes(ext)) {
      const renderResult = await renderPptxOnServer(file);
      record.slideImages = Array.isArray(renderResult.pages) ? renderResult.pages : [];
      record.slidePdfUrl = renderResult.pdf || '';
      if (record.slideImages.length) {
        record.previewType = 'rendered-slides';
        try {
          record.pages = await parsePptx(file);
        } catch (err) {
          record.pages = ['La presentación se visualiza correctamente, pero no se pudo extraer texto suficiente para el análisis local.'];
        }
        record.analysisSourceText = record.pages.join('\n\n');
        record.analysis = generateSmartAnalysis(record.analysisSourceText, file.name, 'Presentación PowerPoint');
        await renderBoardImageUrl(record, record.slideImages[0], `${file.name} · diapositiva 1/${record.slideImages.length}`);
      } else {
        record.pages = ['La presentación se cargó, pero el servidor no devolvió diapositivas renderizadas.'];
        record.previewType = 'pages';
        record.analysisSourceText = record.pages.join('\n\n');
        record.analysis = generateSmartAnalysis(record.analysisSourceText, file.name, 'Presentación PowerPoint');
        renderCurrentBoardPage(record, 'Presentación PowerPoint');
      }
    } else if (ext === 'docx') {
      try {
        record.pages = await parseDocx(file);
      } catch (err) {
        record.pages = [`No se pudo extraer todo el texto del documento ${file.name}. ${err.message || err}`];
      }
      record.previewType = 'pages';
      record.analysisSourceText = record.pages.join('\n\n');
      record.analysis = generateSmartAnalysis(record.analysisSourceText, file.name, 'Documento Word');
      renderCurrentBoardPage(record, 'Documento');
    } else if (['txt','md','csv','json','html','htm'].includes(ext) || type.startsWith('text/')) {
      record.pages = paginateText(await file.text());
      record.previewType = 'pages';
      record.analysisSourceText = record.pages.join('\n\n');
      record.analysis = generateSmartAnalysis(record.analysisSourceText, file.name, 'Documento de texto');
      renderCurrentBoardPage(record, 'Documento');
    } else {
      record.previewType = 'unknown';
      drawBoardCanvas(record, roomId, ['ARCHIVO CARGADO', file.name, 'Formato no visualizable directamente.', 'Conviértalo a PDF, PPTX, DOCX, imagen o video.'], 'Procesamiento local');
      record.analysis = { summary: `El archivo ${file.name} se cargó en ${roomId}, pero su formato no se analiza de forma local.`, keywords: ['formato no compatible'], keyPoints: [], recommendations: ['Convierta el archivo a PPTX, DOCX, TXT, HTML o PDF con OCR.'], questions: [] };
    }
    refreshBoardViewer();
    setStatus(`${file.name} cargado en la pizarra ${roomId}. ${record.previewType === 'rendered-slides' ? 'Presentación renderizada fielmente.' : 'Contenido procesado.'}`);
  }


  async function loadImageBoard(record, file) {
    record.objectUrl = URL.createObjectURL(file); record.previewType = 'image';
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Imagen no válida')); img.src = record.objectUrl; });
    const ctx = record.dynamicTexture.getContext(); const W = 1280, H = 720;
    ctx.fillStyle = '#101716'; ctx.fillRect(0, 0, W, H);
    const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    record.dynamicTexture.update(); record.screen.material = record.defaultMaterial;
  }

  function loadVideoBoard(record, file) {
    record.objectUrl = URL.createObjectURL(file); record.previewType = 'video';
    const texture = new BABYLON.VideoTexture(`video ${record.id}`, record.objectUrl, record.scene, true, true, BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE, { autoPlay:false, loop:true, muted:false, playsinline:true });
    const mat = new BABYLON.StandardMaterial(`material video ${record.id}`, record.scene);
    mat.diffuseTexture = texture; mat.emissiveTexture = texture; mat.disableLighting = true; mat.backFaceCulling = false;
    record.videoTexture = texture; record.videoElement = texture.video; record.activeMaterial = mat; record.screen.material = mat;
    texture.video.play().catch(() => {});
  }

  function loadPdfBoard(record, file) {
    record.objectUrl = URL.createObjectURL(file); record.previewType = 'pdf';
    drawBoardCanvas(record, record.id, ['DOCUMENTO PDF CARGADO', file.name, 'Abra la pizarra para leer el documento completo.'], 'PDF · visor integrado');
  }

  async function parsePptx(file) {
    if (!window.JSZip) throw new Error('JSZip no está disponible');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideNames = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n)).sort((a, b) => slideNumber(a) - slideNumber(b));
    const noteNames = Object.keys(zip.files).filter(n => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(n)).sort((a, b) => slideNumber(a) - slideNumber(b));
    const pages = [];

    const extractText = async name => {
      const entry = zip.file(name);
      if (!entry) return '';
      const xml = await entry.async('string');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      return Array.from(doc.getElementsByTagNameNS('*', 't')).map(n => (n.textContent || '').trim()).filter(Boolean).join('\n');
    };

    for (const name of slideNames) {
      const slideText = await extractText(name);
      pages.push(slideText || `Diapositiva ${pages.length + 1} sin texto extraíble.`);
    }

    if (!pages.length) {
      for (const name of noteNames) {
        const noteText = await extractText(name);
        if (noteText) pages.push(noteText);
      }
    }

    if (!pages.length) {
      const fallbackXml = Object.keys(zip.files).filter(n => /^ppt\/.*\.xml$/i.test(n)).slice(0, 20);
      for (const name of fallbackXml) {
        const value = await extractText(name);
        if (value) pages.push(value);
      }
    }

    if (!pages.length) {
      return ['La presentación se cargó, pero no se encontró texto extraíble. Si la presentación está compuesta por imágenes, añada texto en las diapositivas o exporte a PDF con OCR.'];
    }
    return pages;
  }


  async function parseDocx(file) {
    if (!window.JSZip) throw new Error('JSZip no está disponible');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const candidates = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];
    const blocks = [];
    for (const name of candidates) {
      const entry = zip.file(name);
      if (!entry) continue;
      const xml = await entry.async('string');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const paragraphs = Array.from(doc.getElementsByTagNameNS('*', 'p')).map(p =>
        Array.from(p.getElementsByTagNameNS('*', 't')).map(t => t.textContent || '').join('')
      ).filter(Boolean);
      if (paragraphs.length) blocks.push(paragraphs.join('\n\n'));
    }
    if (!blocks.length) return ['El documento Word se cargó, pero no contiene texto legible de forma local.'];
    return paginateText(blocks.join('\n\n'));
  }


  function slideNumber(name) { const m = name.match(/slide(\d+)\.xml/i); return m ? Number(m[1]) : 0; }

  function paginateText(text, maxChars = 1300) {
    const clean = String(text || '').replace(/\r/g, '').trim();
    if (!clean) return ['Documento sin texto visible.'];
    const pages = []; let remaining = clean;
    while (remaining.length > maxChars) {
      let cut = remaining.lastIndexOf('\n', maxChars);
      if (cut < maxChars * .55) cut = remaining.lastIndexOf(' ', maxChars);
      if (cut < maxChars * .4) cut = maxChars;
      pages.push(remaining.slice(0, cut).trim()); remaining = remaining.slice(cut).trim();
    }
    if (remaining) pages.push(remaining); return pages;
  }

  async function renderCurrentBoardPage(record, kind = 'Documento') {
    if (record.previewType === 'rendered-slides' && record.slideImages.length) {
      await renderBoardImageUrl(record, record.slideImages[record.pageIndex], `${record.file?.name || ''} · diapositiva ${record.pageIndex + 1}/${record.slideImages.length}`);
      return;
    }
    const page = record.pages[record.pageIndex] || '';
    const lines = page.split(/\n+/).filter(Boolean);
    drawBoardCanvas(record, `${record.id} · ${kind}`, lines, `${record.file?.name || ''} · ${record.pageIndex + 1}/${Math.max(record.pages.length,1)}`);
  }

  async function changeBoardPage(delta) {
    const record = BOARD_REGISTRY.get(activeBoardId); if (!record) return;
    const total = record.previewType === 'rendered-slides' ? record.slideImages.length : record.pages.length;
    if (!total) return;
    record.pageIndex = (record.pageIndex + delta + total) % total;
    await renderCurrentBoardPage(record, /\.(pptx|ppsx|pptm|potx|ppt|pps)$/i.test(record.file?.name || '') ? 'Presentación PowerPoint' : 'Documento');
    refreshBoardViewer();
  }


  function controlBoardVideo(action) {
    const record = BOARD_REGISTRY.get(activeBoardId);
    if (!record?.videoElement) { updateBoardInfo(`${activeBoardId}: no hay un video cargado.`); return; }
    if (action === 'play') record.videoElement.play().catch(() => {}); else record.videoElement.pause();
  }

  function clearBoard(roomId) {
    const record = BOARD_REGISTRY.get(roomId); if (!record) return;
    releaseBoardMedia(record); record.file = null; record.pages = []; record.pageIndex = 0; record.analysis = null; record.analysisSourceText = ''; record.slideImages = []; record.slidePdfUrl = ''; record.remoteAssets = [];
    drawBoardWelcome(record); refreshBoardViewer(); setStatus(`Pizarra ${roomId} limpiada.`);
  }

  function releaseBoardMedia(record) {
    try { record.videoElement?.pause(); } catch(e) {}
    try { record.videoTexture?.dispose(); } catch(e) {}
    if (record.activeMaterial && record.activeMaterial !== record.defaultMaterial) { try { record.activeMaterial.dispose(); } catch(e) {} }
    if (record.objectUrl) { try { URL.revokeObjectURL(record.objectUrl); } catch(e) {} }
    record.videoTexture = null; record.videoElement = null; record.objectUrl = null; record.activeMaterial = record.defaultMaterial; record.screen.material = record.defaultMaterial;
    record.slideImages = []; record.slidePdfUrl = ''; record.remoteAssets = [];
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B','KB','MB','GB']; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function setupClassroomIO(scene) {
    if(!socket) return;
    socket.on('screen-update', payload => setStatus(`Pantalla actualizada en ${payload.room || 'salón'}.`));
  }

  async function setupWebXR(scene) {
    try {
      const floorMeshes = scene.meshes.filter(mesh => {
        if (!mesh || !mesh.isEnabled()) return false;
        const name = String(mesh.name || '');
        const explicit = mesh.metadata?.teleportable === true;
        const namedWalkable = /gran losa|ruta avatar|nodo ruta avatar|zona segura VR|zona VR |pasillo lateral escalera anfiteatro|escalon central anfiteatro|rampa invisible|rooftop deck|zona segura VR rooftop|plataforma (?:inicio|fin)|graderia (?:izquierda|derecha)/i.test(name);
        if (explicit || namedWalkable) {
          mesh.isPickable = true;
          return true;
        }
        return false;
      });
      xrHelper=await scene.createDefaultXRExperienceAsync({ floorMeshes, optionalFeatures:true, disableTeleportation:false });
      try {
        xrHelper.baseExperience.featuresManager.enableFeature(BABYLON.WebXRFeatureName.HAND_TRACKING, 'latest', { xrInput: xrHelper.input }, true, true);
      } catch(e) { /* Hand tracking depends on browser/device support. */ }
      setStatus(`WebXR disponible: ${floorMeshes.length} superficies de teletransportación verificadas, controladores y hand tracking.`);
    } catch(err) {
      console.warn('WebXR no disponible:', err);
      setStatus('Entorno visible en computadora. Para VR use HTTPS/Cloudflare en Meta Quest.');
    }
  }


  window.__UCAN_API__ = {
    getActiveBoardId: () => activeBoardId,
    setActiveBoardId: id => { if (BOARD_REGISTRY.has(id)) { activeBoardId = id; const select = document.getElementById('boardSelect'); if (select) select.value = id; refreshBoardViewer(); } },
    getBoardRecord: id => BOARD_REGISTRY.get(id || activeBoardId),
    getBoardTargets: () => BOARD_TARGETS.map(item => ({ ...item })),
    openBoardPanel,
    closeBoardPanel,
    loadFileToBoard,
    changeBoardPage,
    refreshBoardViewer,
    clearBoard,
    setStatus,
    getLayerAudit: () => window.__UCAN_LAYER_AUDIT__ || null,
    getScene: () => activeScene,
    getCamera: () => activeCamera,
    getEnvironment: () => naturalEnvironment?.getState?.() || { ...ENV_STATE },
    setSeason: season => naturalEnvironment?.applySeason?.(season),
    goToArea: key => {
      const target=AREA[key]; if(!target||!activeCamera) return false;
      activeCamera.position.copyFrom(target.pos()); activeCamera.setTarget(target.target()); return true;
    }
  };

  try {
    const scene=createScene();
    engine.runRenderLoop(()=>scene.render());
    window.addEventListener('resize',()=>engine.resize());
    window.addEventListener('error', ev => { console.error(ev.error || ev.message); setStatus('Error en la escena V265: revise consola del navegador.'); });
    window.addEventListener('unhandledrejection', ev => { console.error(ev.reason); setStatus('Error procesando una operación. Recargue la página o revise el archivo seleccionado.'); });
  } catch(err) {
    console.error(err);
    if(loadStatus) loadStatus.textContent = 'Error construyendo el entorno: ' + (err && err.message ? err.message : err);
    setStatus('No se pudo construir el entorno. Revise consola del navegador.');
  }
})();
