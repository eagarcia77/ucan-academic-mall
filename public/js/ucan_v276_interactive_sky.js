(() => {
  'use strict';

  const VERSION = 'V276';
  const BUILD = 'V276-20260717-INTERACTIVE-TERRACE-SKY';
  const B = window.BABYLON;
  if (!B) return;

  const LEVEL = Object.freeze({ rooftop: 27.2 });
  const SKY_RADIUS = 168;
  const REFRESH_MS = 120000;

  const PLANET_INFO = Object.freeze({
    Mercurio: { type:'Planeta rocoso', color:'#b8aaa0', diameter:'4,879 km', year:'88 días terrestres', day:'59 días terrestres', moons:'0', summary:'El planeta más cercano al Sol. Presenta grandes cambios de temperatura y una superficie llena de cráteres.' },
    Venus: { type:'Planeta rocoso', color:'#f4c878', diameter:'12,104 km', year:'225 días terrestres', day:'243 días terrestres', moons:'0', summary:'Tiene una atmósfera muy densa de dióxido de carbono y es el planeta más caliente del Sistema Solar.' },
    Tierra: { type:'Planeta rocoso', color:'#4b93d1', diameter:'12,742 km', year:'365.25 días', day:'23 h 56 min', moons:'1', summary:'Nuestro planeta. Es el único mundo conocido con océanos superficiales estables y vida.' },
    Marte: { type:'Planeta rocoso', color:'#d86f45', diameter:'6,779 km', year:'687 días terrestres', day:'24 h 37 min', moons:'2', summary:'Conocido como el planeta rojo por los óxidos de hierro presentes en su superficie.' },
    Júpiter: { type:'Gigante gaseoso', color:'#d7b18a', diameter:'139,820 km', year:'11.86 años terrestres', day:'9 h 56 min', moons:'Más de 90', summary:'Es el planeta más grande. Su Gran Mancha Roja es una tormenta de larga duración.' },
    Saturno: { type:'Gigante gaseoso', color:'#e3ce92', diameter:'116,460 km', year:'29.45 años terrestres', day:'10 h 42 min', moons:'Más de 140', summary:'Destaca por su extenso sistema de anillos formados principalmente por hielo y roca.' },
    Urano: { type:'Gigante de hielo', color:'#8ad7df', diameter:'50,724 km', year:'84 años terrestres', day:'17 h 14 min', moons:'27', summary:'Rota prácticamente de lado, probablemente como resultado de una antigua colisión.' },
    Neptuno: { type:'Gigante de hielo', color:'#496fd0', diameter:'49,244 km', year:'164.8 años terrestres', day:'16 h 6 min', moons:'14', summary:'Es el planeta principal más distante del Sol y posee algunos de los vientos más rápidos conocidos.' }
  });

  const state = {
    scene:null,
    desktopCamera:null,
    root:null,
    dome:null,
    objects:new Map(),
    entries:[],
    infoPlane:null,
    infoTexture:null,
    panel:null,
    panelTitle:null,
    panelBody:null,
    select:null,
    enabled:false,
    educational:true,
    lastSnapshot:null,
    lastRefresh:0,
    initialized:false,
    selection:null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = value => Number.isFinite(Number(value));
  const normalizeDegrees = value => ((Number(value) % 360) + 360) % 360;

  function currentCamera() {
    return state.scene?.activeCamera || state.desktopCamera || window.__UCAN_RUNTIME__?.camera || null;
  }

  function cameraPosition(camera) {
    return camera?.globalPosition?.clone?.() || camera?.position?.clone?.() || new B.Vector3(0, LEVEL.rooftop + 1.72, 42);
  }

  function currentFloor() {
    try {
      const auditState = window.__UCAN_QUEST_XR_AUDIT__?.getState?.();
      const floor = Number(auditState?.floor ?? auditState?.stableFloor);
      if (finite(floor)) return floor;
    } catch (_) {}
    const camera = currentCamera();
    const y = Number(camera?.globalPosition?.y ?? camera?.position?.y ?? 0);
    return y >= LEVEL.rooftop - 1.2 ? LEVEL.rooftop : y;
  }

  function onTerrace() {
    return currentFloor() >= LEVEL.rooftop - 0.35;
  }

  function skyPoint(altitude, azimuth, radius = SKY_RADIUS) {
    const alt = clamp(Number(altitude), 5, 88) * Math.PI / 180;
    const az = normalizeDegrees(azimuth) * Math.PI / 180;
    const horizontal = Math.cos(alt) * radius;
    return new B.Vector3(
      Math.sin(az) * horizontal,
      LEVEL.rooftop + 8 + Math.sin(alt) * radius,
      -Math.cos(az) * horizontal
    );
  }

  function createDome(scene) {
    const dome = B.MeshBuilder.CreateSphere('cielo interactivo terraza V276', {
      diameter: SKY_RADIUS * 2.55,
      segments: 32,
      sideOrientation: B.Mesh.BACKSIDE
    }, scene);
    dome.position.set(0, LEVEL.rooftop + 10, 0);
    dome.isPickable = false;
    dome.checkCollisions = false;
    dome.infiniteDistance = true;
    dome.renderingGroupId = 0;

    const texture = new B.DynamicTexture('textura cielo terraza V276', { width:2048, height:1024 }, scene, false);
    const ctx = texture.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, '#020613');
    gradient.addColorStop(0.32, '#07152c');
    gradient.addColorStop(0.68, '#15344b');
    gradient.addColorStop(1, '#8b6a58');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2048, 1024);
    const milky = ctx.createLinearGradient(0, 0, 2048, 1024);
    milky.addColorStop(0, 'rgba(255,255,255,0)');
    milky.addColorStop(0.42, 'rgba(160,188,225,0.04)');
    milky.addColorStop(0.5, 'rgba(225,232,255,0.10)');
    milky.addColorStop(0.58, 'rgba(160,188,225,0.04)');
    milky.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = milky;
    ctx.fillRect(0, 0, 2048, 1024);
    texture.update();

    const material = new B.StandardMaterial('material cielo interactivo V276', scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.specularColor = B.Color3.Black();
    material.alpha = 0.98;
    dome.material = material;
    return dome;
  }

  function createLabel(scene, root, entry, position, color) {
    const texture = new B.DynamicTexture(`etiqueta celeste ${entry.id}`, { width:512, height:128 }, scene, false);
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(3,12,25,.78)';
    ctx.fillRect(0, 18, 512, 92);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 21, 506, 86);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.name, 256, 64);
    texture.hasAlpha = true;
    texture.update();

    const material = new B.StandardMaterial(`material etiqueta ${entry.id}`, scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.alpha = entry.belowHorizon ? 0.58 : 0.94;

    const label = B.MeshBuilder.CreatePlane(`etiqueta ${entry.name}`, { width:8.8, height:2.2, sideOrientation:B.Mesh.DOUBLESIDE }, scene);
    label.position.copyFrom(position.add(new B.Vector3(0, entry.radius + 1.9, 0)));
    label.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    label.material = material;
    label.parent = root;
    label.renderingGroupId = 3;
    label.isPickable = true;
    label.checkCollisions = false;
    return label;
  }

  function attachSelection(mesh, entry) {
    mesh.metadata = { ...(mesh.metadata || {}), celestialObject:true, celestialId:entry.id, celestialData:entry };
    mesh.isPickable = true;
    mesh.actionManager = mesh.actionManager || new B.ActionManager(state.scene);
    mesh.actionManager.registerAction(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger, () => selectEntry(entry.id)));
  }

  function makeCelestial(entry) {
    const scene = state.scene;
    const root = state.root;
    const position = skyPoint(entry.altitude, entry.azimuth, entry.distance || SKY_RADIUS);
    const mesh = B.MeshBuilder.CreateSphere(`objeto celeste ${entry.name}`, {
      diameter:entry.radius * 2,
      segments:entry.kind === 'star' ? 12 : 24
    }, scene);
    mesh.position.copyFrom(position);
    mesh.parent = root;
    mesh.renderingGroupId = 2;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.checkCollisions = false;

    const material = new B.StandardMaterial(`material celeste ${entry.id}`, scene);
    const color = B.Color3.FromHexString(entry.color);
    material.diffuseColor = color.scale(0.65);
    material.emissiveColor = color.scale(entry.kind === 'star' ? 1.05 : 0.72);
    material.specularColor = color.scale(0.32);
    material.specularPower = entry.kind === 'star' ? 64 : 32;
    material.disableLighting = entry.kind === 'star';
    material.backFaceCulling = false;
    material.alpha = entry.belowHorizon ? 0.52 : 1;
    mesh.material = material;

    if (entry.name === 'Saturno') {
      const ringMaterial = new B.StandardMaterial('anillos Saturno V276', scene);
      ringMaterial.diffuseColor = B.Color3.FromHexString('#d8c38d');
      ringMaterial.emissiveColor = B.Color3.FromHexString('#6d6044').scale(0.38);
      ringMaterial.alpha = 0.78;
      ringMaterial.backFaceCulling = false;
      const ring = B.MeshBuilder.CreateTorus('anillos Saturno interactivo', { diameter:entry.radius * 3.1, thickness:0.28, tessellation:48 }, scene);
      ring.position.copyFrom(position);
      ring.rotation.x = Math.PI / 2.6;
      ring.rotation.z = Math.PI / 7;
      ring.parent = root;
      ring.material = ringMaterial;
      ring.isPickable = true;
      ring.checkCollisions = false;
      attachSelection(ring, entry);
    }

    const label = createLabel(scene, root, entry, position, entry.color);
    attachSelection(mesh, entry);
    attachSelection(label, entry);
    state.objects.set(entry.id, { entry, mesh, label });
  }

  function solarAltAz(date) {
    const rad = Math.PI / 180;
    const jd = date.getTime() / 86400000 + 2440587.5;
    const n = jd - 2451545.0;
    const L = normalizeDegrees(280.460 + 0.9856474 * n);
    const g = normalizeDegrees(357.528 + 0.9856003 * n) * rad;
    const lambda = normalizeDegrees(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    const epsilon = (23.439 - 0.0000004 * n) * rad;
    const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
    const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
    const gmst = normalizeDegrees(280.46061837 + 360.98564736629 * (jd - 2451545.0));
    let hourAngle = normalizeDegrees(gmst - 67.0458 - ra / rad);
    if (hourAngle > 180) hourAngle -= 360;
    const H = hourAngle * rad;
    const lat = 18.0819 * rad;
    const altitude = Math.asin(Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H));
    const azimuth = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(H));
    return { altitude:altitude / rad, azimuth:normalizeDegrees(azimuth / rad) };
  }

  function buildEntries() {
    const live = window.__UCAN_SAN_GERMAN__ || {};
    const snapshot = live.skySnapshot || state.lastSnapshot || null;
    const entries = [];
    const stars = Array.isArray(snapshot?.stars) ? snapshot.stars : [];
    for (const star of stars.filter(item => Number(item.altitude) > 1).slice(0, 30)) {
      const magnitude = Number(star.mag ?? 2.5);
      entries.push({
        id:`star-${star.id || String(star.name).toLowerCase().replace(/\W+/g,'-')}`,
        name:star.name,
        kind:'star',
        category:'Estrella',
        constellation:star.constellation || 'Sin constelación marcada',
        magnitude,
        altitude:Number(star.altitude),
        azimuth:Number(star.azimuth),
        radius:clamp(1.7 - magnitude * 0.22, 0.55, 2.2),
        color:magnitude < 0.5 ? '#fff2c2' : star.name === 'Antares' || star.name === 'Betelgeuse' ? '#ff9f7b' : '#dcecff',
        summary:`${star.name} pertenece a ${star.constellation || 'una región del cielo sin marcar'}. Su magnitud aparente educativa es ${magnitude.toFixed(1)}.`
      });
    }

    const planets = Array.isArray(snapshot?.planets) ? snapshot.planets : [];
    for (const planet of planets) {
      const info = PLANET_INFO[planet.name] || {};
      const below = Number(planet.altitude) <= 3;
      entries.push({
        id:`planet-${planet.name}`,
        name:planet.name,
        kind:'planet',
        category:info.type || 'Planeta',
        altitude:below ? 8 : Number(planet.altitude),
        actualAltitude:Number(planet.altitude),
        azimuth:Number(planet.azimuth),
        distanceAU:Number(planet.distance),
        belowHorizon:below,
        radius:planet.name === 'Júpiter' ? 4.4 : planet.name === 'Saturno' ? 4.0 : planet.name === 'Urano' || planet.name === 'Neptuno' ? 3.1 : 2.8,
        color:info.color || '#ffffff',
        ...info
      });
    }

    const date = snapshot?.date ? new Date(snapshot.date) : new Date();
    const sun = solarAltAz(date);
    entries.push({
      id:'sun', name:'Sol', kind:'sun', category:'Estrella', altitude:Math.max(8, sun.altitude), actualAltitude:sun.altitude, azimuth:sun.azimuth,
      belowHorizon:sun.altitude <= 0, radius:6.8, color:'#ffd66b', diameter:'1.39 millones km', summary:'La estrella central del Sistema Solar. Su energía impulsa el clima y sostiene la mayor parte de la vida terrestre.'
    });

    const moonAge = Number(live.moonAge ?? 0);
    entries.push({
      id:'moon', name:'Luna', kind:'moon', category:'Satélite natural', altitude:42, azimuth:normalizeDegrees(sun.azimuth + 180 + moonAge * 12.19), radius:5.1, color:'#e8edf3',
      phase:live.moonPhase || 'Fase no disponible', illumination:Math.round(Number(live.moonIllumination || 0) * 100), diameter:'3,475 km', summary:'El único satélite natural de la Tierra. Su fase visible cambia durante un ciclo aproximado de 29.5 días.'
    });

    if (snapshot?.iss && Number(snapshot.iss.altitude) > 0) {
      entries.push({
        id:'iss', name:'Estación Espacial Internacional', kind:'spacecraft', category:'Estación orbital', altitude:Number(snapshot.iss.altitude), azimuth:Number(snapshot.iss.azimuth), radius:1.5, color:'#fff7dc',
        summary:'Laboratorio orbital internacional utilizado para investigación científica y tecnológica en microgravedad.'
      });
    }
    state.lastSnapshot = snapshot;
    return entries;
  }

  function clearObjects() {
    for (const { mesh, label } of state.objects.values()) {
      try { mesh.dispose(false, true); } catch (_) {}
      try { label.dispose(false, true); } catch (_) {}
    }
    for (const mesh of state.scene?.meshes?.slice?.() || []) {
      if (mesh?.metadata?.celestialObject && /anillos Saturno interactivo/.test(mesh.name || '')) {
        try { mesh.dispose(false, true); } catch (_) {}
      }
    }
    state.objects.clear();
  }

  function rebuild() {
    if (!state.scene || !state.root) return;
    clearObjects();
    state.entries = buildEntries();
    state.entries.forEach(makeCelestial);
    fillSelect();
    state.lastRefresh = Date.now();
    window.__UCAN_SKY_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      initialized:true,
      interactiveObjects:state.entries.length,
      planets:state.entries.filter(item => item.kind === 'planet').length,
      stars:state.entries.filter(item => item.kind === 'star').length,
      allVisibleObjectsPickable:[...state.objects.values()].every(item => item.mesh.isPickable && item.label.isPickable),
      vrTriggerSelection:true,
      desktopPointerSelection:true,
      terraceOnly:true,
      educationalBelowHorizonPlanets:true
    };
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawInfo(entry) {
    const texture = state.infoTexture;
    if (!texture) return;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 1024, 640);
    const gradient = ctx.createLinearGradient(0, 0, 1024, 640);
    gradient.addColorStop(0, '#071426');
    gradient.addColorStop(1, '#123b50');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = entry.color || '#fed141';
    ctx.fillRect(0, 0, 1024, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px Segoe UI, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(entry.name, 52, 86);
    ctx.fillStyle = '#9edbe6';
    ctx.font = 'bold 30px Segoe UI, Arial';
    ctx.fillText(entry.category || entry.kind, 54, 130);
    ctx.fillStyle = '#ffffff';
    ctx.font = '28px Segoe UI, Arial';
    const facts = [];
    if (entry.constellation) facts.push(`Constelación: ${entry.constellation}`);
    if (finite(entry.actualAltitude ?? entry.altitude)) facts.push(`Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°`);
    if (finite(entry.azimuth)) facts.push(`Azimut: ${Number(entry.azimuth).toFixed(1)}°`);
    if (entry.diameter) facts.push(`Diámetro: ${entry.diameter}`);
    if (entry.year) facts.push(`Año: ${entry.year}`);
    if (entry.day) facts.push(`Rotación: ${entry.day}`);
    if (entry.moons) facts.push(`Lunas: ${entry.moons}`);
    if (entry.phase) facts.push(`Fase: ${entry.phase} · ${entry.illumination}%`);
    if (finite(entry.distanceAU)) facts.push(`Distancia educativa: ${entry.distanceAU.toFixed(2)} UA`);
    if (entry.belowHorizon) facts.push('Estado: bajo el horizonte; se muestra en modo educativo.');
    let y = 185;
    for (const fact of facts.slice(0, 7)) {
      ctx.fillStyle = '#dff8ff';
      ctx.fillText(`• ${fact}`, 58, y);
      y += 42;
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '27px Segoe UI, Arial';
    const lines = wrapLines(ctx, entry.summary || 'Objeto astronómico interactivo.', 910);
    y += 12;
    for (const line of lines.slice(0, 5)) {
      ctx.fillText(line, 56, y);
      y += 38;
    }
    ctx.fillStyle = '#8dc8d7';
    ctx.font = '22px Segoe UI, Arial';
    ctx.fillText('Apunte con el control y presione el gatillo para seleccionar otro objeto.', 56, 604);
    texture.update();
  }

  function positionInfoPlane() {
    if (!state.infoPlane?.isEnabled?.() || !state.selection) return;
    const camera = currentCamera();
    if (!camera) return;
    const origin = cameraPosition(camera);
    let direction;
    try { direction = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!direction || direction.lengthSquared() < 0.001) direction = new B.Vector3(0, 0, 1);
    direction.normalize();
    const target = origin.add(direction.scale(5.2));
    target.y = Math.max(LEVEL.rooftop + 2.2, origin.y - 0.15);
    state.infoPlane.position.copyFrom(target);
  }

  function showInfo3D(entry) {
    drawInfo(entry);
    state.infoPlane.setEnabled(true);
    positionInfoPlane();
  }

  function showInfoDom(entry) {
    if (!state.panel) return;
    state.panelTitle.textContent = entry.name;
    const facts = [];
    facts.push(`<strong>${entry.category || entry.kind}</strong>`);
    if (entry.constellation) facts.push(`Constelación: ${entry.constellation}`);
    if (finite(entry.actualAltitude ?? entry.altitude)) facts.push(`Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°`);
    if (finite(entry.azimuth)) facts.push(`Azimut: ${Number(entry.azimuth).toFixed(1)}°`);
    if (entry.diameter) facts.push(`Diámetro: ${entry.diameter}`);
    if (entry.year) facts.push(`Año: ${entry.year}`);
    if (entry.day) facts.push(`Rotación: ${entry.day}`);
    if (entry.moons) facts.push(`Lunas: ${entry.moons}`);
    if (entry.phase) facts.push(`Fase: ${entry.phase} · ${entry.illumination}%`);
    if (entry.belowHorizon) facts.push('Actualmente está bajo el horizonte y se muestra en modo educativo.');
    state.panelBody.innerHTML = `<p>${facts.join('<br>')}</p><p>${entry.summary || ''}</p>`;
    state.select.value = entry.id;
    state.panel.classList.add('open');
    state.panel.setAttribute('aria-hidden', 'false');
  }

  function selectEntry(id) {
    const entry = state.entries.find(item => item.id === id);
    if (!entry) return;
    state.selection = entry;
    showInfo3D(entry);
    showInfoDom(entry);
    window.__UCAN_API__?.setStatus?.(`Objeto seleccionado: ${entry.name}.`);
  }

  function fillSelect() {
    if (!state.select) return;
    state.select.innerHTML = '';
    const groups = [
      ['Planetas y objetos', state.entries.filter(item => item.kind !== 'star')],
      ['Estrellas', state.entries.filter(item => item.kind === 'star')]
    ];
    for (const [label, items] of groups) {
      const group = document.createElement('optgroup');
      group.label = label;
      for (const entry of items) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.belowHorizon ? `${entry.name} · bajo horizonte` : entry.name;
        group.appendChild(option);
      }
      state.select.appendChild(group);
    }
    if (state.selection) state.select.value = state.selection.id;
  }

  function createDomPanel() {
    if (document.getElementById('ucanSkyExplorer')) {
      state.panel = document.getElementById('ucanSkyExplorer');
      state.panelTitle = document.getElementById('ucanSkyTitle');
      state.panelBody = document.getElementById('ucanSkyBody');
      state.select = document.getElementById('ucanSkySelect');
      return;
    }
    const style = document.createElement('style');
    style.textContent = `
      #ucanSkyExplorer{position:fixed;right:16px;top:16px;z-index:52;width:min(390px,calc(100vw - 32px));max-height:88vh;overflow:auto;background:rgba(4,15,31,.94);border:1px solid rgba(143,214,236,.5);border-radius:18px;color:#fff;box-shadow:0 22px 70px rgba(0,0,0,.5);backdrop-filter:blur(14px);display:none}
      #ucanSkyExplorer.open{display:block}#ucanSkyExplorer header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.15)}#ucanSkyExplorer h2{font-size:18px;margin:0}#ucanSkyExplorer button{border:0;border-radius:10px;padding:8px 11px;background:#fed141;color:#071713;font-weight:800;cursor:pointer}#ucanSkyExplorer .sky-controls{padding:12px 15px}#ucanSkyExplorer select{width:100%;padding:10px;border-radius:10px;border:1px solid #7cb8c8;background:#eef8fb;color:#102733;font:inherit}#ucanSkyBody{padding:0 15px 15px;line-height:1.5;color:#e5f8ff}#ucanSkyBody p{margin:8px 0}
    `;
    document.head.appendChild(style);
    const panel = document.createElement('aside');
    panel.id = 'ucanSkyExplorer';
    panel.setAttribute('aria-hidden','true');
    panel.innerHTML = `<header><h2 id="ucanSkyTitle">Cielo interactivo</h2><button id="ucanSkyClose" aria-label="Cerrar">×</button></header><div class="sky-controls"><label for="ucanSkySelect">Escoger objeto celeste</label><select id="ucanSkySelect"></select></div><div id="ucanSkyBody"><p>Entre a la terraza y seleccione una estrella o planeta.</p></div>`;
    document.body.appendChild(panel);
    state.panel = panel;
    state.panelTitle = panel.querySelector('#ucanSkyTitle');
    state.panelBody = panel.querySelector('#ucanSkyBody');
    state.select = panel.querySelector('#ucanSkySelect');
    panel.querySelector('#ucanSkyClose').addEventListener('click', () => {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden','true');
    });
    state.select.addEventListener('change', () => selectEntry(state.select.value));

    const utility = document.getElementById('utilityActions') || document.querySelector('.control-grid');
    if (utility) {
      const button = document.createElement('button');
      button.id = 'ucanSkyExplorerBtn';
      button.className = 'secondary';
      button.textContent = 'Cielo interactivo';
      button.addEventListener('click', () => {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden','false');
        if (!onTerrace()) window.__UCAN_API__?.goTo?.('rooftop');
      });
      utility.appendChild(button);
    }
  }

  function createInfoPlane(scene, root) {
    const texture = new B.DynamicTexture('panel información celeste V276', { width:1024, height:640 }, scene, false);
    const material = new B.StandardMaterial('material panel información celeste V276', scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    const plane = B.MeshBuilder.CreatePlane('panel flotante información celeste', { width:9.4, height:5.9, sideOrientation:B.Mesh.DOUBLESIDE }, scene);
    plane.material = material;
    plane.parent = root;
    plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    plane.renderingGroupId = 3;
    plane.isPickable = false;
    plane.checkCollisions = false;
    plane.setEnabled(false);
    state.infoTexture = texture;
    return plane;
  }

  function installPointerSelection(scene) {
    scene.onPointerObservable.add(pointerInfo => {
      const pick = pointerInfo?.pickInfo;
      const mesh = pick?.pickedMesh;
      const id = mesh?.metadata?.celestialId;
      if (pick?.hit && id) selectEntry(id);
    }, B.PointerEventTypes.POINTERPICK);
  }

  function updateVisibility() {
    const terrace = onTerrace();
    if (terrace !== state.enabled) {
      state.enabled = terrace;
      state.root?.setEnabled(terrace);
      if (!terrace) state.infoPlane?.setEnabled(false);
    }
    if (!terrace) return;
    positionInfoPlane();
    if (Date.now() - state.lastRefresh > REFRESH_MS && window.__UCAN_SAN_GERMAN__?.skySnapshot) rebuild();
  }

  function init(scene, camera) {
    if (state.initialized) return;
    state.initialized = true;
    state.scene = scene;
    state.desktopCamera = camera;
    createDomPanel();
    state.root = new B.TransformNode('Observatorio celeste interactivo V276', scene);
    state.dome = createDome(scene);
    state.dome.parent = state.root;
    state.infoPlane = createInfoPlane(scene, state.root);
    installPointerSelection(scene);
    rebuild();
    state.root.setEnabled(false);
    scene.onBeforeRenderObservable.add(updateVisibility);
    window.__UCAN_INTERACTIVE_SKY__ = {
      version:VERSION,
      build:BUILD,
      select:selectEntry,
      refresh:rebuild,
      open:() => state.panel?.classList.add('open'),
      getObjects:() => state.entries.map(entry => ({ ...entry })),
      getState:() => ({ enabled:state.enabled, onTerrace:onTerrace(), selected:state.selection?.name || null, objects:state.entries.length })
    };
    console.info('[UCAN V276] Cielo interactivo de la terraza instalado.');
  }

  function waitForRuntime(attempt = 0) {
    const runtime = window.__UCAN_RUNTIME__;
    if (runtime?.scene && runtime?.camera) {
      init(runtime.scene, runtime.camera);
      return;
    }
    if (attempt < 120) window.setTimeout(() => waitForRuntime(attempt + 1), 250);
  }

  waitForRuntime();
})();
