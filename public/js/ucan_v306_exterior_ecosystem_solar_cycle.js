(() => {
  'use strict';

  const VERSION = 'V306';
  const BUILD = 'V306-20260723-EXTERIOR-ECOSYSTEM-SOLAR-SAN-GERMAN';
  const B = window.BABYLON;
  if (!B) return;

  const LOCATION = Object.freeze({
    name:'San Germán, Puerto Rico',
    latitude:18.0819,
    longitude:-67.0458,
    timeZone:'America/Puerto_Rico',
    utcOffsetHours:-4
  });

  const BUILDING = Object.freeze({ minX:-70, maxX:70, minZ:-51, maxZ:51 });
  const EXTERIOR = Object.freeze({ sideX:71.2, frontZ:55.2, rearZ:-55.2 });
  const SKY_RADIUS = 155;
  const REFRESH_MS = 60000;

  const state = {
    scene:null,
    root:null,
    skyRoot:null,
    baseV304Root:null,
    lobbyV305Root:null,
    installed:false,
    questMode:false,
    skyTexture:null,
    skyMaterial:null,
    sunMesh:null,
    moonMesh:null,
    sunLight:null,
    hemiLight:null,
    nightLights:[],
    board:null,
    boardTexture:null,
    hiddenLegacyRoots:0,
    treeCount:0,
    palmCount:0,
    shrubCount:0,
    flowerCount:0,
    rockCount:0,
    gardenLightCount:0,
    exteriorMeshes:0,
    lastMinuteKey:null,
    lastSolar:null,
    lastError:null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rad = degrees => degrees * Math.PI / 180;
  const deg = radians => radians * 180 / Math.PI;
  const color = hex => B.Color3.FromHexString(hex);
  const mix = (a, b, t) => new B.Color3(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    return /OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`);
  }

  function puertoRicoNow(date = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone:LOCATION.timeZone,
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit',
      hourCycle:'h23'
    }).formatToParts(date).map(part => [part.type, part.value]));
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    const second = Number(parts.second);
    return {
      year, month, day, hour, minute, second,
      key:`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
      decimalHour:hour + minute / 60 + second / 3600,
      label:new Intl.DateTimeFormat('es-PR', {
        timeZone:LOCATION.timeZone,
        weekday:'long', year:'numeric', month:'long', day:'numeric',
        hour:'numeric', minute:'2-digit', hour12:true
      }).format(date)
    };
  }

  function dayOfYear(year, month, day) {
    return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000);
  }

  function solarParameters(now) {
    const n = dayOfYear(now.year, now.month, now.day);
    const gamma = 2 * Math.PI / 365 * (n - 1 + (now.decimalHour - 12) / 24);
    const equationOfTime = 229.18 * (
      0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma)
    );
    const declination =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma);
    return { n, gamma, equationOfTime, declination };
  }

  function solarPosition(now) {
    const params = solarParameters(now);
    const latitude = rad(LOCATION.latitude);
    const localMinutes = now.hour * 60 + now.minute + now.second / 60;
    let trueSolarMinutes = localMinutes + params.equationOfTime + 4 * LOCATION.longitude - 60 * LOCATION.utcOffsetHours;
    trueSolarMinutes = ((trueSolarMinutes % 1440) + 1440) % 1440;
    let hourAngleDegrees = trueSolarMinutes / 4 - 180;
    if (hourAngleDegrees < -180) hourAngleDegrees += 360;
    const hourAngle = rad(hourAngleDegrees);
    const sinAltitude =
      Math.sin(latitude) * Math.sin(params.declination) +
      Math.cos(latitude) * Math.cos(params.declination) * Math.cos(hourAngle);
    const altitude = Math.asin(clamp(sinAltitude, -1, 1));
    let azimuth = Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(params.declination) * Math.cos(latitude)
    ) + Math.PI;
    azimuth = ((azimuth % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return {
      altitude,
      azimuth,
      altitudeDeg:deg(altitude),
      azimuthDeg:deg(azimuth),
      equationOfTime:params.equationOfTime,
      declination:params.declination
    };
  }

  function sunriseSunset(now) {
    const params = solarParameters({ ...now, decimalHour:12 });
    const latitude = rad(LOCATION.latitude);
    const zenith = rad(90.833);
    const cosHourAngle =
      Math.cos(zenith) / (Math.cos(latitude) * Math.cos(params.declination)) -
      Math.tan(latitude) * Math.tan(params.declination);
    if (cosHourAngle < -1 || cosHourAngle > 1) return { sunriseMinutes:null, sunsetMinutes:null, solarNoonMinutes:null };
    const hourAngle = deg(Math.acos(clamp(cosHourAngle, -1, 1)));
    const solarNoonMinutes = 720 - 4 * LOCATION.longitude - params.equationOfTime + LOCATION.utcOffsetHours * 60;
    return {
      sunriseMinutes:solarNoonMinutes - 4 * hourAngle,
      sunsetMinutes:solarNoonMinutes + 4 * hourAngle,
      solarNoonMinutes
    };
  }

  function formatMinutes(minutes) {
    if (!Number.isFinite(minutes)) return '—';
    const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
    let hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const period = hour >= 12 ? 'p. m.' : 'a. m.';
    hour %= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
  }

  function solarPhase(now, solar, times) {
    const minute = now.hour * 60 + now.minute + now.second / 60;
    const sunriseDistance = Number.isFinite(times.sunriseMinutes) ? Math.abs(minute - times.sunriseMinutes) : Infinity;
    const sunsetDistance = Number.isFinite(times.sunsetMinutes) ? Math.abs(minute - times.sunsetMinutes) : Infinity;
    if (sunriseDistance <= 45) return 'Amanecer';
    if (sunsetDistance <= 55) return 'Atardecer';
    if (solar.altitudeDeg >= 0) return 'Día';
    if (solar.altitudeDeg >= -12) return 'Crepúsculo';
    return 'Noche';
  }

  function currentSeason() {
    const base = window.__UCAN_SEASONAL_ECOSYSTEM_V304__;
    if (base?.currentSeasonLabel) return base.currentSeasonLabel;
    const now = puertoRicoNow();
    const md = now.month * 100 + now.day;
    if (md >= 320 && md < 621) return 'Primavera';
    if (md >= 621 && md < 922) return 'Verano';
    if (md >= 922 && md < 1221) return 'Otoño';
    return 'Invierno';
  }

  function seasonalPalette() {
    const season = currentSeason();
    if (season === 'Primavera') return { leaf:'#43a855', leafBright:'#76c865', flower:'#f36c9b', accent:'#ffe36f' };
    if (season === 'Otoño') return { leaf:'#557d3a', leafBright:'#8fa844', flower:'#ed8d3d', accent:'#ffd05a' };
    if (season === 'Invierno') return { leaf:'#2b704d', leafBright:'#559270', flower:'#e8f3f2', accent:'#9bd8e5' };
    return { leaf:'#237a3b', leafBright:'#49a857', flower:'#f5523b', accent:'#ffd44d' };
  }

  function material(name, diffuse, options = {}) {
    const mat = new B.StandardMaterial(name, state.scene);
    mat.diffuseColor = color(diffuse);
    mat.specularColor = options.specular ? color(options.specular) : new B.Color3(0.025, 0.025, 0.025);
    mat.emissiveColor = options.emissive ? color(options.emissive) : B.Color3.Black();
    mat.alpha = options.alpha == null ? 1 : options.alpha;
    mat.backFaceCulling = options.backFaceCulling !== false;
    if (options.disableLighting) mat.disableLighting = true;
    return mat;
  }

  function track(mesh, metadata = {}) {
    mesh.parent = state.root;
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = state.questMode ? false : true;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      ecosystemV306:true,
      exteriorEcosystem:true,
      outsideBuilding:true,
      decorative:true,
      ...metadata
    };
    state.exteriorMeshes += 1;
    return mesh;
  }

  function box(name, x, y, z, width, height, depth, mat, metadata = {}) {
    const mesh = B.MeshBuilder.CreateBox(name, { width, height, depth }, state.scene);
    mesh.position.set(x, y, z);
    mesh.material = mat;
    return track(mesh, metadata);
  }

  function cylinder(name, x, y, z, height, diameter, mat, tessellation = 10) {
    const mesh = B.MeshBuilder.CreateCylinder(name, { height, diameter, tessellation }, state.scene);
    mesh.position.set(x, y, z);
    mesh.material = mat;
    return track(mesh);
  }

  function sphere(name, x, y, z, diameter, mat, segments = 8) {
    const mesh = B.MeshBuilder.CreateSphere(name, { diameter, segments }, state.scene);
    mesh.position.set(x, y, z);
    mesh.material = mat;
    return track(mesh);
  }

  function createTree(x, z, scale, mats, flowering = false) {
    const trunkHeight = 4.8 * scale;
    cylinder(`tronco exterior V306 ${state.treeCount}`, x, trunkHeight / 2, z, trunkHeight, 0.54 * scale, mats.trunk, 9);
    const crownY = trunkHeight + 0.8 * scale;
    const offsets = state.questMode
      ? [[0,0,3.0],[-0.9,0.05,2.35],[0.9,0.05,2.35]]
      : [[0,0,3.2],[-1.05,0.05,2.5],[1.05,0.05,2.5],[0,0.72,2.35]];
    offsets.forEach(([dx, dy, diameter], index) => sphere(
      `copa exterior V306 ${state.treeCount}-${index}`,
      x + dx * scale, crownY + dy * scale, z,
      diameter * scale,
      flowering ? mats.leafBright : mats.leaf,
      7
    ));
    if (flowering) {
      const count = state.questMode ? 4 : 8;
      for (let i = 0; i < count; i += 1) {
        const angle = i * 2.399;
        sphere(
          `flor árbol exterior V306 ${state.treeCount}-${i}`,
          x + Math.cos(angle) * (1.0 + (i % 3) * 0.35) * scale,
          crownY + 0.35 * scale + Math.sin(i * 1.27) * 0.42 * scale,
          z + Math.sin(angle) * (1.0 + (i % 3) * 0.35) * scale,
          0.34 * scale,
          i % 2 ? mats.flower : mats.accent,
          5
        );
        state.flowerCount += 1;
      }
    }
    state.treeCount += 1;
  }

  function createPalm(x, z, scale, mats) {
    const height = 5.9 * scale;
    cylinder(`tronco palma exterior V306 ${state.palmCount}`, x, height / 2, z, height, 0.34 * scale, mats.palmTrunk, 8);
    const leaves = state.questMode ? 5 : 7;
    for (let i = 0; i < leaves; i += 1) {
      const angle = i * Math.PI * 2 / leaves;
      const leaf = B.MeshBuilder.CreateCylinder(`hoja palma exterior V306 ${state.palmCount}-${i}`, {
        height:3.0 * scale,
        diameterTop:0.035,
        diameterBottom:0.22 * scale,
        tessellation:5
      }, state.scene);
      leaf.position.set(x + Math.cos(angle) * 0.95 * scale, height + 0.2 * scale, z + Math.sin(angle) * 0.95 * scale);
      leaf.rotation.z = Math.PI / 2.65;
      leaf.rotation.y = -angle;
      leaf.material = mats.leaf;
      track(leaf);
    }
    sphere(`corona palma exterior V306 ${state.palmCount}`, x, height, z, 0.62 * scale, mats.leafBright, 6);
    state.palmCount += 1;
  }

  function createShrub(x, z, scale, mats, flowering = true) {
    sphere(`arbusto exterior V306 ${state.shrubCount}`, x, 0.62 * scale, z, 1.45 * scale, mats.leafBright, 6);
    if (flowering) {
      const flowers = state.questMode ? 2 : 3;
      for (let i = 0; i < flowers; i += 1) {
        sphere(`flor arbusto exterior V306 ${state.shrubCount}-${i}`, x + (i - 1) * 0.32 * scale, 1.0 * scale, z + (i % 2 ? 0.22 : -0.2) * scale, 0.22 * scale, i % 2 ? mats.flower : mats.accent, 5);
        state.flowerCount += 1;
      }
    }
    state.shrubCount += 1;
  }

  function createRock(x, z, scale, mats) {
    const rock = B.MeshBuilder.CreateSphere(`roca exterior V306 ${state.rockCount}`, {
      diameterX:1.35 * scale,
      diameterY:0.78 * scale,
      diameterZ:1.05 * scale,
      segments:5
    }, state.scene);
    rock.position.set(x, 0.38 * scale, z);
    rock.rotation.y = (state.rockCount % 7) * 0.47;
    rock.material = mats.rock;
    track(rock);
    state.rockCount += 1;
  }

  function createGardenLight(x, z, mats) {
    cylinder(`poste luz exterior V306 ${state.gardenLightCount}`, x, 0.62, z, 1.24, 0.09, mats.metal, 7);
    const lamp = sphere(`lámpara exterior V306 ${state.gardenLightCount}`, x, 1.31, z, 0.25, mats.lamp, 6);
    lamp.material.disableLighting = true;
    if (!state.questMode && state.nightLights.length < 6) {
      const point = new B.PointLight(`luz jardín solar V306 ${state.gardenLightCount}`, new B.Vector3(x, 1.6, z), state.scene);
      point.diffuse = color('#ffd990');
      point.specular = color('#ffd990');
      point.intensity = 0;
      point.range = 10;
      state.nightLights.push(point);
    }
    state.gardenLightCount += 1;
  }

  function hideInteriorEcosystems() {
    state.baseV304Root = state.scene.getTransformNodeByName?.('Ecosistema natural estacional UCAN V304') || null;
    state.lobbyV305Root = state.scene.getTransformNodeByName?.('Plaza natural visible UCAN V305') || null;
    for (const root of [state.baseV304Root, state.lobbyV305Root]) {
      if (!root) continue;
      root.setEnabled(false);
      state.hiddenLegacyRoots += 1;
    }
  }

  function buildExteriorEcosystem() {
    state.root = new B.TransformNode('Ecosistema exterior UCAN V306', state.scene);
    const palette = seasonalPalette();
    const mats = {
      soil:material('tierra exterior V306', '#395d3b'),
      border:material('borde piedra exterior V306', '#747b72'),
      trunk:material('tronco exterior V306', '#684329'),
      palmTrunk:material('tronco palma exterior V306', '#87633f'),
      leaf:material('hoja exterior V306', palette.leaf),
      leafBright:material('hoja brillante exterior V306', palette.leafBright),
      flower:material('flor exterior V306', palette.flower, { emissive:'#24100d' }),
      accent:material('flor acento exterior V306', palette.accent, { emissive:'#29230b' }),
      rock:material('roca exterior V306', '#75766f'),
      metal:material('metal exterior V306', '#293330'),
      lamp:material('lámpara exterior V306', '#ffe0a0', { emissive:'#ffe0a0', disableLighting:true })
    };

    // Franjas de jardín completamente fuera del volumen del edificio.
    box('jardín frontal exterior V306', 0, 0.09, EXTERIOR.frontZ, 132, 0.18, 5.5, mats.soil, { exteriorZone:'front' });
    box('borde jardín frontal exterior V306', 0, 0.22, EXTERIOR.frontZ - 2.72, 132, 0.26, 0.24, mats.border);
    box('jardín posterior exterior V306', 0, 0.09, EXTERIOR.rearZ, 132, 0.18, 5.5, mats.soil, { exteriorZone:'rear' });
    box('borde jardín posterior exterior V306', 0, 0.22, EXTERIOR.rearZ + 2.72, 132, 0.26, 0.24, mats.border);
    box('jardín lateral oeste exterior V306', -EXTERIOR.sideX, 0.09, 0, 2.8, 0.18, 98, mats.soil, { exteriorZone:'west' });
    box('jardín lateral este exterior V306', EXTERIOR.sideX, 0.09, 0, 2.8, 0.18, 98, mats.soil, { exteriorZone:'east' });

    const frontX = [-60,-48,-36,-24,24,36,48,60];
    frontX.forEach((x, index) => {
      if (index % 2 === 0) createPalm(x, EXTERIOR.frontZ, 0.72, mats);
      else createTree(x, EXTERIOR.frontZ, 0.72, mats, true);
      createShrub(x + (index % 2 ? 3.2 : -3.2), EXTERIOR.frontZ - 0.2, 0.62, mats, true);
    });

    const rearX = [-60,-45,-30,-15,15,30,45,60];
    rearX.forEach((x, index) => {
      createTree(x, EXTERIOR.rearZ, 0.74, mats, index % 2 === 0);
      if (!state.questMode || index % 2 === 0) createRock(x + 3.4, EXTERIOR.rearZ + 0.2, 0.65, mats);
    });

    const sideZ = [-42,-28,-14,0,14,28,42];
    sideZ.forEach((z, index) => {
      createTree(-EXTERIOR.sideX, z, 0.68, mats, index % 2 === 0);
      createTree(EXTERIOR.sideX, z, 0.68, mats, index % 2 !== 0);
    });

    [-54,-36,-18,0,18,36,54].forEach(x => {
      createGardenLight(x, 52.4, mats);
      if (!state.questMode || Math.abs(x) % 36 === 0) createGardenLight(x, -52.4, mats);
    });
  }

  function buildSky() {
    state.skyRoot = new B.TransformNode('Ciclo solar San Germán V306', state.scene);
    state.skyTexture = new B.DynamicTexture('Cielo solar San Germán V306 textura', { width:1024, height:512 }, state.scene, false);
    state.skyMaterial = new B.StandardMaterial('Cielo solar San Germán V306 material', state.scene);
    state.skyMaterial.emissiveTexture = state.skyTexture;
    state.skyMaterial.diffuseTexture = state.skyTexture;
    state.skyMaterial.disableLighting = true;
    state.skyMaterial.backFaceCulling = false;
    state.skyMaterial.specularColor = B.Color3.Black();
    const sky = B.MeshBuilder.CreateSphere('Domo exterior solar San Germán V306', {
      diameter:SKY_RADIUS * 2,
      segments:state.questMode ? 16 : 24,
      sideOrientation:B.Mesh.BACKSIDE
    }, state.scene);
    sky.material = state.skyMaterial;
    sky.isPickable = false;
    sky.infiniteDistance = true;
    sky.parent = state.skyRoot;

    const sunMat = material('Sol San Germán V306 material', '#fff1b8', { emissive:'#fff1b8', disableLighting:true });
    state.sunMesh = B.MeshBuilder.CreateSphere('Sol San Germán V306', { diameter:state.questMode ? 7 : 8, segments:10 }, state.scene);
    state.sunMesh.material = sunMat;
    state.sunMesh.isPickable = false;
    state.sunMesh.parent = state.skyRoot;

    const moonMat = material('Luna San Germán V306 material', '#dce8f3', { emissive:'#b9c9da', disableLighting:true });
    state.moonMesh = B.MeshBuilder.CreateSphere('Luna San Germán V306', { diameter:5.5, segments:10 }, state.scene);
    state.moonMesh.material = moonMat;
    state.moonMesh.isPickable = false;
    state.moonMesh.parent = state.skyRoot;

    state.sunLight = new B.DirectionalLight('Luz solar dinámica San Germán V306', new B.Vector3(-0.3, -1, 0.2), state.scene);
    state.sunLight.diffuse = color('#fff3d1');
    state.sunLight.specular = color('#fff7e2');
    state.sunLight.intensity = 0.55;

    state.hemiLight = new B.HemisphericLight('Ambiente solar dinámico San Germán V306', new B.Vector3(0, 1, 0), state.scene);
    state.hemiLight.diffuse = color('#b9d8ee');
    state.hemiLight.groundColor = color('#74695d');
    state.hemiLight.intensity = 0.32;
  }

  function drawSky(topColor, horizonColor, bottomColor, starAlpha) {
    const ctx = state.skyTexture.getContext();
    const width = 1024;
    const height = 512;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(0.62, horizonColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    if (starAlpha > 0.01) {
      ctx.fillStyle = `rgba(255,255,245,${starAlpha})`;
      const stars = state.questMode ? 42 : 85;
      for (let i = 0; i < stars; i += 1) {
        const x = (i * 193 + 67) % width;
        const y = (i * 97 + 31) % 330;
        const radius = 0.7 + (i % 4) * 0.35;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    state.skyTexture.update(false);
  }

  function phaseColors(altitudeDeg, phase) {
    if (phase === 'Amanecer') return { top:'#6e8fc8', horizon:'#ffb36b', bottom:'#f7d09c', hemi:0.36, sun:0.52, stars:0.08 };
    if (phase === 'Atardecer') return { top:'#526ca4', horizon:'#f27b43', bottom:'#f5b36d', hemi:0.34, sun:0.46, stars:0.10 };
    if (phase === 'Día') return { top:'#57a8e5', horizon:'#b9daf1', bottom:'#e9d6b6', hemi:0.50, sun:0.74, stars:0 };
    if (phase === 'Crepúsculo') {
      const t = clamp((altitudeDeg + 12) / 12, 0, 1);
      const top = mix(color('#09152f'), color('#596aa0'), t).toHexString();
      const horizon = mix(color('#182743'), color('#e98555'), t).toHexString();
      return { top, horizon, bottom:'#6d5a60', hemi:0.14 + t * 0.18, sun:0.04 + t * 0.28, stars:0.65 - t * 0.45 };
    }
    return { top:'#071126', horizon:'#12233e', bottom:'#233041', hemi:0.10, sun:0.02, stars:0.82 };
  }

  function updateBoard(now, solar, times, phase) {
    if (!state.boardTexture) return;
    const ctx = state.boardTexture.getContext();
    ctx.fillStyle = '#102d25';
    ctx.fillRect(0, 0, 1200, 620);
    ctx.fillStyle = '#e4af37';
    ctx.fillRect(0, 0, 1200, 34);
    ctx.fillRect(0, 586, 1200, 34);
    ctx.strokeStyle = '#f5e9bd';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, 1172, 592);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px Arial';
    ctx.fillText('ECOSISTEMA EXTERIOR', 600, 85);
    ctx.fillStyle = '#f6d36b';
    ctx.font = 'bold 40px Arial';
    ctx.fillText(`${currentSeason().toUpperCase()} · ${phase.toUpperCase()}`, 600, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = '34px Arial';
    ctx.fillText(LOCATION.name, 600, 210);
    ctx.font = '30px Arial';
    ctx.fillText(`Amanecer: ${formatMinutes(times.sunriseMinutes)}   ·   Atardecer: ${formatMinutes(times.sunsetMinutes)}`, 600, 280);
    ctx.fillText(`Sol: ${solar.altitudeDeg.toFixed(1)}° de elevación   ·   ${solar.azimuthDeg.toFixed(1)}° de azimut`, 600, 335);
    ctx.fillStyle = '#cfe9db';
    ctx.font = '28px Arial';
    ctx.fillText(now.label, 600, 395);
    const celebration = window.__UCAN_SEASONAL_ECOSYSTEM_V304__?.currentCelebration;
    if (celebration) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 29px Arial';
      ctx.fillText(`Puerto Rico: ${celebration}`, 600, 465);
    }
    ctx.fillStyle = '#b9d7ca';
    ctx.font = '24px Arial';
    ctx.fillText('El cielo y la iluminación cambian automáticamente con la hora solar de San Germán.', 600, 535);
    state.boardTexture.update(false);
  }

  function buildInformationBoard() {
    state.boardTexture = new B.DynamicTexture('Información solar exterior V306 textura', { width:1200, height:620 }, state.scene, false);
    const mat = new B.StandardMaterial('Información solar exterior V306 material', state.scene);
    mat.diffuseTexture = state.boardTexture;
    mat.emissiveTexture = state.boardTexture;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    state.board = B.MeshBuilder.CreatePlane('Cartel ecosistema exterior y ciclo solar V306', {
      width:12.8,
      height:6.6,
      sideOrientation:B.Mesh.DOUBLESIDE
    }, state.scene);
    state.board.position.set(0, 4.3, 52.2);
    state.board.rotation.y = Math.PI;
    state.board.material = mat;
    state.board.isPickable = true;
    state.board.alwaysSelectAsActiveMesh = true;
    state.board.renderingGroupId = 3;
    state.board.metadata = {
      livePanel:true,
      livePanelKey:'exterior-solar-v306',
      readableSign:true,
      exteriorEcosystem:true,
      title:'Ecosistema exterior y ciclo solar de San Germán'
    };
    if (B.ActionManager && B.ExecuteCodeAction) {
      state.board.actionManager = new B.ActionManager(state.scene);
      state.board.actionManager.registerAction(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger, () => {
        window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(state.board);
      }));
    }
  }

  function applySolarCycle(force = false) {
    const now = puertoRicoNow();
    if (!force && now.key === state.lastMinuteKey) return;
    state.lastMinuteKey = now.key;
    const solar = solarPosition(now);
    const times = sunriseSunset(now);
    const phase = solarPhase(now, solar, times);
    const colors = phaseColors(solar.altitudeDeg, phase);
    drawSky(colors.top, colors.horizon, colors.bottom, colors.stars);

    const horizontal = Math.cos(solar.altitude);
    const direction = new B.Vector3(
      Math.sin(solar.azimuth) * horizontal,
      Math.sin(solar.altitude),
      Math.cos(solar.azimuth) * horizontal
    );
    state.sunMesh.position.copyFrom(direction.scale(SKY_RADIUS * 0.82));
    state.moonMesh.position.copyFrom(direction.scale(-SKY_RADIUS * 0.78));
    state.sunMesh.setEnabled(solar.altitudeDeg > -10);
    state.moonMesh.setEnabled(solar.altitudeDeg < 12);
    state.sunLight.direction.copyFrom(direction.scale(-1));
    state.sunLight.intensity = colors.sun;
    state.sunLight.diffuse = phase === 'Atardecer' || phase === 'Amanecer' ? color('#ffb06b') : color('#fff1c8');
    state.hemiLight.intensity = colors.hemi;
    state.hemiLight.diffuse = color(colors.top);
    state.hemiLight.groundColor = color(colors.bottom);
    const nightFactor = clamp((-solar.altitudeDeg + 2) / 12, 0, 1);
    state.nightLights.forEach(light => { light.intensity = 0.55 * nightFactor; });
    state.scene.clearColor = new B.Color4(color(colors.horizon).r, color(colors.horizon).g, color(colors.horizon).b, 1);
    updateBoard(now, solar, times, phase);

    state.lastSolar = {
      now,
      phase,
      altitudeDeg:solar.altitudeDeg,
      azimuthDeg:solar.azimuthDeg,
      sunrise:formatMinutes(times.sunriseMinutes),
      sunset:formatMinutes(times.sunsetMinutes),
      sunriseMinutes:times.sunriseMinutes,
      sunsetMinutes:times.sunsetMinutes
    };
    updateAudit();
  }

  function ensureExteriorOnly() {
    state.baseV304Root?.setEnabled?.(false);
    state.lobbyV305Root?.setEnabled?.(false);
    state.root?.setEnabled?.(true);
    state.skyRoot?.setEnabled?.(true);
  }

  function recordError(stage, error) {
    state.lastError = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error desconocido'),
      at:new Date().toISOString()
    };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_EXTERIOR_ECOSYSTEM_V306__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      location:LOCATION.name,
      latitude:LOCATION.latitude,
      longitude:LOCATION.longitude,
      timeZone:LOCATION.timeZone,
      exteriorOnly:true,
      interiorV305GardenDisabled:true,
      baseV304GeometryDisabled:true,
      seasonalCalendarPreserved:true,
      browserAndQuest:true,
      questOptimized:state.questMode,
      dynamicSolarPosition:true,
      dynamicSunriseSunset:true,
      dynamicDawnDuskNight:true,
      automaticMinuteRefresh:true,
      ecosystemOutsideBuildingBounds:true,
      buildingBounds:BUILDING,
      exteriorZones:['front','rear','west','east'],
      treeCount:state.treeCount,
      palmCount:state.palmCount,
      shrubCount:state.shrubCount,
      flowerCount:state.flowerCount,
      rockCount:state.rockCount,
      gardenLightCount:state.gardenLightCount,
      exteriorMeshes:state.exteriorMeshes,
      hiddenLegacyRoots:state.hiddenLegacyRoots,
      currentPhase:state.lastSolar?.phase || null,
      currentSolarAltitudeDeg:state.lastSolar?.altitudeDeg ?? null,
      currentSolarAzimuthDeg:state.lastSolar?.azimuthDeg ?? null,
      sunrise:state.lastSolar?.sunrise || null,
      sunset:state.lastSolar?.sunset || null,
      lastError:state.lastError,
      refresh:() => applySolarCycle(true),
      getState:() => ({
        installed:state.installed,
        questMode:state.questMode,
        exteriorOnly:true,
        exteriorMeshes:state.exteriorMeshes,
        trees:state.treeCount,
        palms:state.palmCount,
        shrubs:state.shrubCount,
        currentPhase:state.lastSolar?.phase || null,
        altitudeDeg:state.lastSolar?.altitudeDeg ?? null,
        azimuthDeg:state.lastSolar?.azimuthDeg ?? null,
        sunrise:state.lastSolar?.sunrise || null,
        sunset:state.lastSolar?.sunset || null,
        lastError:state.lastError
      })
    };
  }

  function install(scene) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.questMode = questDetected();
    try {
      hideInteriorEcosystems();
      buildExteriorEcosystem();
      buildSky();
      buildInformationBoard();
      applySolarCycle(true);
      scene.onBeforeRenderObservable.add(() => {
        try { ensureExteriorOnly(); } catch (error) { recordError('ensure-exterior-only', error); }
      });
      window.setInterval(() => {
        try { applySolarCycle(false); } catch (error) { recordError('solar-refresh', error); }
      }, REFRESH_MS);
      window.__UCAN_API__?.setStatus?.('UCAN Academic V306: ecosistema exterior y ciclo solar de San Germán activados.');
      updateAudit();
      console.info(`[UCAN ${VERSION}] Ecosistema exterior y ciclo solar de San Germán instalados.`);
    } catch (error) {
      recordError('install', error);
    }
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const calendarReady = window.__UCAN_SEASONAL_ECOSYSTEM_V304__?.installed === true;
    const visibilityReady = window.__UCAN_ECOSYSTEM_VISIBILITY_V305__?.installed === true;
    if (scene && calendarReady && visibilityReady) return install(scene);
    if (attempt < 480) window.setTimeout(() => boot(attempt + 1), 100);
    else recordError('boot', new Error('No se encontró la escena, el calendario V304 o la capa V305.'));
  }

  updateAudit();
  boot();
})();
