(() => {
  'use strict';

  const VERSION = 'V287';
  const BUILD = 'V287-20260720-FLOOR-STATE-SKY-OPT';
  const B = window.BABYLON;
  if (!B) return;

  const LEVEL = Object.freeze({ rooftop:27.2 });
  const SKY_RADIUS = 145;
  const FRAME_THROTTLE_MS = 250;
  const REFRESH_MS = 600000;
  const STAR_BUDGET = 14;
  const LABELLED_STAR_BUDGET = 5;

  const PLANET_COLORS = Object.freeze({
    Mercurio:'#b8aaa0', Venus:'#f4c878', Tierra:'#4b93d1', Marte:'#d86f45',
    Júpiter:'#d7b18a', Saturno:'#e3ce92', Urano:'#8ad7df', Neptuno:'#496fd0'
  });

  const FALLBACK_STARS = Object.freeze([
    { id:'sirius', name:'Sirio', constellation:'Can Mayor', altitude:38, azimuth:205, mag:-1.46 },
    { id:'canopus', name:'Canopo', constellation:'Carina', altitude:18, azimuth:190, mag:-0.74 },
    { id:'arcturus', name:'Arturo', constellation:'Boyero', altitude:52, azimuth:284, mag:-0.05 },
    { id:'vega', name:'Vega', constellation:'Lira', altitude:63, azimuth:42, mag:0.03 },
    { id:'capella', name:'Capella', constellation:'Auriga', altitude:34, azimuth:318, mag:0.08 },
    { id:'rigel', name:'Rigel', constellation:'Orión', altitude:29, azimuth:222, mag:0.13 },
    { id:'procyon', name:'Proción', constellation:'Can Menor', altitude:44, azimuth:214, mag:0.34 },
    { id:'betelgeuse', name:'Betelgeuse', constellation:'Orión', altitude:41, azimuth:232, mag:0.42 }
  ]);

  const state = {
    scene:null,
    camera:null,
    root:null,
    dome:null,
    domeTexture:null,
    entries:new Map(),
    objects:new Map(),
    panel:null,
    select:null,
    title:null,
    body:null,
    infoPlane:null,
    infoTexture:null,
    selected:null,
    enabled:false,
    initialized:false,
    lastFrame:0,
    lastRefresh:0,
    lastSnapshotStamp:'',
    refreshes:0,
    createdObjects:0,
    reusedObjects:0,
    disposedObjects:0
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = value => Number.isFinite(Number(value));
  const normalizeDegrees = value => ((Number(value) % 360) + 360) % 360;

  function currentCamera() {
    return state.scene?.activeCamera || state.camera || window.__UCAN_API__?.getCamera?.() || null;
  }

  function currentFloorBase() {
    try {
      const xr = window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.();
      if (xr?.inXR && finite(xr.floor)) return Number(xr.floor);
    } catch (_) {}
    try {
      const floor = window.__UCAN_FLOOR_STATE_V287__?.getState?.()?.floorBase;
      if (finite(floor)) return Number(floor);
    } catch (_) {}
    const camera = currentCamera();
    const y = Number(camera?.globalPosition?.y ?? camera?.position?.y ?? 0);
    return y >= LEVEL.rooftop - 0.8 ? LEVEL.rooftop : y;
  }

  function onTerrace() {
    return currentFloorBase() >= LEVEL.rooftop - 0.35;
  }

  function cameraPosition() {
    const camera = currentCamera();
    return camera?.globalPosition?.clone?.() || camera?.position?.clone?.() || new B.Vector3(0, LEVEL.rooftop + 1.72, 42);
  }

  function skyPoint(altitude, azimuth, radius = SKY_RADIUS) {
    const alt = clamp(Number(altitude), 4, 88) * Math.PI / 180;
    const az = normalizeDegrees(azimuth) * Math.PI / 180;
    const horizontal = Math.cos(alt) * radius;
    return new B.Vector3(
      Math.sin(az) * horizontal,
      LEVEL.rooftop + 7 + Math.sin(alt) * radius,
      -Math.cos(az) * horizontal
    );
  }

  function createDome(scene) {
    const dome = B.MeshBuilder.CreateSphere('cielo optimizado terraza V287', {
      diameter:SKY_RADIUS * 2.45,
      segments:20,
      sideOrientation:B.Mesh.BACKSIDE
    }, scene);
    dome.position.set(0, LEVEL.rooftop + 9, 0);
    dome.isPickable = false;
    dome.checkCollisions = false;
    dome.infiniteDistance = true;
    dome.renderingGroupId = 0;

    const texture = new B.DynamicTexture('textura cielo optimizada V287', { width:1024, height:512 }, scene, false);
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const material = new B.StandardMaterial('material cielo optimizado V287', scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.specularColor = B.Color3.Black();
    material.alpha = 0.985;
    dome.material = material;
    state.domeTexture = texture;
    drawDomeTexture();
    dome.freezeWorldMatrix?.();
    return dome;
  }

  function drawDomeTexture() {
    const texture = state.domeTexture;
    if (!texture) return;
    const live = window.__UCAN_SAN_GERMAN__ || {};
    const snapshotDate = live.skySnapshot?.date ? new Date(live.skySnapshot.date) : new Date();
    const hour = snapshotDate.getHours() + snapshotDate.getMinutes() / 60;
    const night = hour >= 18.5 || hour < 5.8;
    const ctx = texture.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    if (night) {
      gradient.addColorStop(0, '#01030d');
      gradient.addColorStop(0.42, '#06142b');
      gradient.addColorStop(0.78, '#12344c');
      gradient.addColorStop(1, '#6f5a57');
    } else {
      gradient.addColorStop(0, '#4c98d6');
      gradient.addColorStop(0.58, '#86c9ed');
      gradient.addColorStop(1, '#d9e8ec');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    if (night) {
      ctx.fillStyle = 'rgba(220,232,255,.055)';
      ctx.beginPath();
      ctx.ellipse(530, 245, 430, 36, -0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    texture.update(false);
  }

  function buildEntries() {
    const live = window.__UCAN_SAN_GERMAN__ || {};
    const snapshot = live.skySnapshot || {};
    const entries = [];
    const stars = (Array.isArray(snapshot.stars) && snapshot.stars.length ? snapshot.stars : FALLBACK_STARS)
      .filter(item => Number(item.altitude) > 2)
      .sort((a, b) => Number(a.mag ?? 9) - Number(b.mag ?? 9))
      .slice(0, STAR_BUDGET);

    stars.forEach((star, index) => {
      const magnitude = Number(star.mag ?? 2.5);
      entries.push({
        id:`star-${star.id || String(star.name || index).toLowerCase().replace(/\W+/g, '-')}`,
        name:star.name || `Estrella ${index + 1}`,
        kind:'star',
        category:'Estrella',
        constellation:star.constellation || 'Sin constelación marcada',
        magnitude,
        altitude:Number(star.altitude),
        azimuth:Number(star.azimuth),
        radius:clamp(1.35 - magnitude * 0.16, 0.42, 1.65),
        color:/Antares|Betelgeuse/i.test(star.name || '') ? '#ff9f7b' : magnitude < 0.3 ? '#fff1bd' : '#dcecff',
        label:index < LABELLED_STAR_BUDGET,
        visible:true,
        summary:`${star.name || 'Esta estrella'} pertenece a ${star.constellation || 'una región del cielo sin marcar'}.`
      });
    });

    for (const planet of Array.isArray(snapshot.planets) ? snapshot.planets : []) {
      const altitude = Number(planet.altitude);
      entries.push({
        id:`planet-${planet.name}`,
        name:planet.name,
        kind:'planet',
        category:'Planeta',
        altitude:Math.max(6, altitude),
        actualAltitude:altitude,
        azimuth:Number(planet.azimuth),
        radius:planet.name === 'Júpiter' ? 3.2 : planet.name === 'Saturno' ? 3.0 : 2.35,
        color:PLANET_COLORS[planet.name] || '#ffffff',
        label:true,
        visible:altitude > 0,
        belowHorizon:altitude <= 0,
        summary:altitude > 0 ? 'Planeta visible sobre el horizonte desde San Germán.' : 'Planeta bajo el horizonte; permanece disponible en el panel educativo.'
      });
    }

    const moonAge = Number(live.moonAge || 0);
    entries.push({
      id:'moon', name:'Luna', kind:'moon', category:'Satélite natural', altitude:43,
      azimuth:normalizeDegrees(185 + moonAge * 12.19), radius:3.8, color:'#e8edf3', label:true, visible:true,
      phase:live.moonPhase || 'Fase lunar', summary:`Fase actual: ${live.moonPhase || 'no disponible'}.`
    });

    if (snapshot.iss && Number(snapshot.iss.altitude) > 0) {
      entries.push({
        id:'iss', name:'Estación Espacial Internacional', kind:'spacecraft', category:'Estación orbital',
        altitude:Number(snapshot.iss.altitude), azimuth:Number(snapshot.iss.azimuth), radius:1.15,
        color:'#fff7dc', label:true, visible:true, summary:'Laboratorio orbital internacional visible durante pasos favorables.'
      });
    }

    return entries;
  }

  function makeMaterial(entry) {
    const material = new B.StandardMaterial(`material cielo V287 ${entry.id}`, state.scene);
    const color = B.Color3.FromHexString(entry.color || '#ffffff');
    material.diffuseColor = color.scale(entry.kind === 'star' ? 0.55 : 0.72);
    material.emissiveColor = color.scale(entry.kind === 'star' ? 1.0 : 0.68);
    material.specularColor = entry.kind === 'star' ? B.Color3.Black() : color.scale(0.18);
    material.specularPower = 24;
    material.disableLighting = entry.kind === 'star';
    material.backFaceCulling = true;
    material.freeze?.();
    return material;
  }

  function createLabel(entry, parent) {
    if (!entry.label) return null;
    const texture = new B.DynamicTexture(`etiqueta cielo V287 ${entry.id}`, { width:320, height:80 }, state.scene, false);
    texture.hasAlpha = true;
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 320, 80);
    ctx.fillStyle = 'rgba(3,12,25,.78)';
    ctx.fillRect(0, 8, 320, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 27px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.name, 160, 40);
    texture.update(false);

    const material = new B.StandardMaterial(`material etiqueta V287 ${entry.id}`, state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.freeze?.();

    const label = B.MeshBuilder.CreatePlane(`etiqueta cielo V287 ${entry.name}`, { width:6.6, height:1.65, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    label.parent = parent;
    label.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    label.material = material;
    label.renderingGroupId = 3;
    label.isPickable = true;
    label.checkCollisions = false;
    label.metadata = { celestialId:entry.id, celestialObject:true, kind:entry.kind };
    return label;
  }

  function createObject(entry) {
    const node = new B.TransformNode(`nodo cielo V287 ${entry.id}`, state.scene);
    node.parent = state.root;
    const mesh = B.MeshBuilder.CreateSphere(`objeto cielo V287 ${entry.name}`, {
      diameter:entry.radius * 2,
      segments:entry.kind === 'star' ? 6 : 12
    }, state.scene);
    mesh.parent = node;
    mesh.material = makeMaterial(entry);
    mesh.renderingGroupId = 2;
    mesh.isPickable = true;
    mesh.checkCollisions = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.doNotSyncBoundingInfo = true;
    mesh.metadata = { celestialId:entry.id, celestialObject:true, kind:entry.kind };
    const label = createLabel(entry, node);
    const record = { node, mesh, label, entry };
    state.objects.set(entry.id, record);
    state.createdObjects += 1;
    return record;
  }

  function updateObject(record, entry) {
    const position = skyPoint(entry.altitude, entry.azimuth);
    record.node.position.copyFrom(position);
    record.mesh.setEnabled(entry.visible !== false);
    record.label?.setEnabled(entry.visible !== false);
    if (record.label) record.label.position.set(0, entry.radius + 1.45, 0);
    record.entry = entry;
    record.mesh.metadata.celestialData = entry;
    if (record.label) record.label.metadata.celestialData = entry;
  }

  function disposeObject(record) {
    try { record.node.dispose(false, true); } catch (_) {}
    state.disposedObjects += 1;
  }

  function reconcile() {
    if (!state.scene || !state.root) return;
    const entries = buildEntries();
    const nextIds = new Set(entries.map(entry => entry.id));
    for (const [id, record] of state.objects) {
      if (!nextIds.has(id)) {
        disposeObject(record);
        state.objects.delete(id);
      }
    }
    state.entries.clear();
    for (const entry of entries) {
      state.entries.set(entry.id, entry);
      const record = state.objects.get(entry.id) || createObject(entry);
      if (state.objects.has(entry.id) && record.entry !== entry) state.reusedObjects += 1;
      updateObject(record, entry);
    }
    fillSelect();
    drawDomeTexture();
    state.lastRefresh = Date.now();
    state.lastSnapshotStamp = String(window.__UCAN_SAN_GERMAN__?.lastUpdated || window.__UCAN_SAN_GERMAN__?.skySnapshot?.date || 'fallback');
    state.refreshes += 1;
    updateAudit();
  }

  function drawInfo(entry) {
    if (!state.infoTexture) return;
    const ctx = state.infoTexture.getContext();
    ctx.clearRect(0, 0, 768, 420);
    const gradient = ctx.createLinearGradient(0, 0, 768, 420);
    gradient.addColorStop(0, '#071426');
    gradient.addColorStop(1, '#123b50');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 768, 420);
    ctx.fillStyle = entry.color || '#fed141';
    ctx.fillRect(0, 0, 768, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Segoe UI, Arial';
    ctx.fillText(entry.name, 34, 68);
    ctx.fillStyle = '#9edbe6';
    ctx.font = 'bold 24px Segoe UI, Arial';
    ctx.fillText(entry.category || entry.kind, 35, 108);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Segoe UI, Arial';
    const facts = [];
    if (entry.constellation) facts.push(`Constelación: ${entry.constellation}`);
    if (finite(entry.actualAltitude ?? entry.altitude)) facts.push(`Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°`);
    if (finite(entry.azimuth)) facts.push(`Azimut: ${Number(entry.azimuth).toFixed(1)}°`);
    if (entry.phase) facts.push(entry.phase);
    if (entry.belowHorizon) facts.push('Actualmente bajo el horizonte.');
    let y = 154;
    for (const fact of facts.slice(0, 4)) { ctx.fillText(`• ${fact}`, 38, y); y += 34; }
    ctx.fillStyle = '#dff8ff';
    ctx.font = '21px Segoe UI, Arial';
    const words = String(entry.summary || '').split(/\s+/);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 690 && line) { ctx.fillText(line, 38, y); y += 30; line = word; }
      else line = next;
    }
    if (line) ctx.fillText(line, 38, y);
    state.infoTexture.update(false);
  }

  function positionInfoPlane() {
    if (!state.infoPlane?.isEnabled?.() || !state.selected) return;
    const camera = currentCamera();
    if (!camera) return;
    const origin = cameraPosition();
    let direction;
    try { direction = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!direction || direction.lengthSquared() < 0.001) direction = new B.Vector3(0, 0, 1);
    direction.normalize();
    const target = origin.add(direction.scale(4.8));
    target.y = Math.max(LEVEL.rooftop + 2.0, origin.y - 0.1);
    state.infoPlane.position.copyFrom(target);
  }

  function selectEntry(id) {
    const entry = state.entries.get(id);
    if (!entry) return;
    state.selected = entry;
    drawInfo(entry);
    state.infoPlane.setEnabled(onTerrace());
    positionInfoPlane();
    if (state.title) state.title.textContent = entry.name;
    if (state.body) state.body.innerHTML = `<p><strong>${entry.category || entry.kind}</strong></p><p>${entry.summary || ''}</p>`;
    if (state.select) state.select.value = entry.id;
    state.panel?.classList.add('open');
    state.panel?.setAttribute('aria-hidden', 'false');
    window.__UCAN_API__?.setStatus?.(`Objeto celeste seleccionado: ${entry.name}.`);
  }

  function fillSelect() {
    if (!state.select) return;
    state.select.innerHTML = '';
    const groups = [
      ['Planetas y objetos', [...state.entries.values()].filter(item => item.kind !== 'star')],
      ['Estrellas principales', [...state.entries.values()].filter(item => item.kind === 'star')]
    ];
    for (const [label, items] of groups) {
      const group = document.createElement('optgroup');
      group.label = label;
      for (const entry of items) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.belowHorizon ? `${entry.name} · bajo el horizonte` : entry.name;
        group.appendChild(option);
      }
      state.select.appendChild(group);
    }
    if (state.selected && state.entries.has(state.selected.id)) state.select.value = state.selected.id;
  }

  function createPanel() {
    const style = document.createElement('style');
    style.textContent = `#ucanSkyExplorerV287{position:fixed;right:16px;top:16px;z-index:52;width:min(380px,calc(100vw - 32px));max-height:86vh;overflow:auto;background:rgba(4,15,31,.94);border:1px solid rgba(143,214,236,.5);border-radius:18px;color:#fff;box-shadow:0 22px 70px rgba(0,0,0,.5);backdrop-filter:blur(10px);display:none}#ucanSkyExplorerV287.open{display:block}#ucanSkyExplorerV287 header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.15)}#ucanSkyExplorerV287 h2{font-size:18px;margin:0}#ucanSkyExplorerV287 button{border:0;border-radius:10px;padding:8px 11px;background:#fed141;color:#071713;font-weight:800;cursor:pointer}#ucanSkyExplorerV287 .sky-controls{padding:12px 15px}#ucanSkyExplorerV287 select{width:100%;padding:10px;border-radius:10px;border:1px solid #7cb8c8;background:#eef8fb;color:#102733;font:inherit}#ucanSkyBodyV287{padding:0 15px 15px;line-height:1.5;color:#e5f8ff}`;
    document.head.appendChild(style);
    const panel = document.createElement('aside');
    panel.id = 'ucanSkyExplorerV287';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `<header><h2 id="ucanSkyTitleV287">Cielo optimizado</h2><button id="ucanSkyCloseV287" aria-label="Cerrar">×</button></header><div class="sky-controls"><label for="ucanSkySelectV287">Objeto celeste</label><select id="ucanSkySelectV287"></select></div><div id="ucanSkyBodyV287"><p>Entre a la terraza para explorar el cielo.</p></div>`;
    document.body.appendChild(panel);
    state.panel = panel;
    state.title = panel.querySelector('#ucanSkyTitleV287');
    state.body = panel.querySelector('#ucanSkyBodyV287');
    state.select = panel.querySelector('#ucanSkySelectV287');
    panel.querySelector('#ucanSkyCloseV287').addEventListener('click', () => {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    });
    state.select.addEventListener('change', () => selectEntry(state.select.value));

    const utility = document.getElementById('utilityActions') || document.querySelector('.control-grid');
    if (utility) {
      const button = document.createElement('button');
      button.id = 'ucanSkyExplorerBtnV287';
      button.className = 'secondary';
      button.textContent = 'Cielo optimizado';
      button.addEventListener('click', () => {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        if (!onTerrace()) window.__UCAN_API__?.goToArea?.('rooftop');
      });
      utility.appendChild(button);
    }
  }

  function createInfoPlane() {
    const texture = new B.DynamicTexture('panel cielo optimizado V287', { width:768, height:420 }, state.scene, false);
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const material = new B.StandardMaterial('material panel cielo optimizado V287', state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    const plane = B.MeshBuilder.CreatePlane('panel flotante cielo optimizado V287', { width:8.6, height:4.7, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    plane.parent = state.root;
    plane.material = material;
    plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    plane.renderingGroupId = 3;
    plane.isPickable = false;
    plane.checkCollisions = false;
    plane.setEnabled(false);
    state.infoTexture = texture;
    return plane;
  }

  function updateAudit() {
    const values = [...state.entries.values()];
    window.__UCAN_SKY_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      initialized:state.initialized,
      optimized:true,
      terraceOnly:true,
      enabled:state.enabled,
      domeSegments:20,
      domeTexture:'1024x512',
      starBudget:STAR_BUDGET,
      labelledStarBudget:LABELLED_STAR_BUDGET,
      activeObjects:values.filter(item => item.visible !== false).length,
      totalEntries:values.length,
      refreshIntervalMs:REFRESH_MS,
      frameThrottleMs:FRAME_THROTTLE_MS,
      duplicateRefreshTimerRemoved:true,
      recreatesOnlyMissingObjects:true,
      alwaysSelectAsActiveMesh:false,
      refreshes:state.refreshes,
      createdObjects:state.createdObjects,
      reusedObjects:state.reusedObjects,
      disposedObjects:state.disposedObjects,
      selected:state.selected?.name || null,
      onTerrace:onTerrace()
    };
  }

  function frame() {
    const now = performance.now();
    if (now - state.lastFrame < FRAME_THROTTLE_MS) return;
    state.lastFrame = now;
    const terrace = onTerrace();
    if (terrace !== state.enabled) {
      state.enabled = terrace;
      state.root?.setEnabled(terrace);
      if (!terrace) state.infoPlane?.setEnabled(false);
      if (terrace && state.lastRefresh === 0) reconcile();
      updateAudit();
    }
    if (!terrace || document.hidden) return;
    positionInfoPlane();
    const stamp = String(window.__UCAN_SAN_GERMAN__?.lastUpdated || window.__UCAN_SAN_GERMAN__?.skySnapshot?.date || 'fallback');
    if ((Date.now() - state.lastRefresh >= REFRESH_MS) && stamp !== state.lastSnapshotStamp) reconcile();
  }

  function init(scene, camera) {
    if (state.initialized) return;
    state.initialized = true;
    state.scene = scene;
    state.camera = camera;
    createPanel();
    state.root = new B.TransformNode('Cielo optimizado terraza V287', scene);
    state.dome = createDome(scene);
    state.dome.parent = state.root;
    state.infoPlane = createInfoPlane();
    state.root.setEnabled(false);
    scene.onPointerObservable.add(pointerInfo => {
      const id = pointerInfo?.pickInfo?.pickedMesh?.metadata?.celestialId;
      if (pointerInfo?.pickInfo?.hit && id) selectEntry(id);
    }, B.PointerEventTypes.POINTERPICK);
    scene.onBeforeRenderObservable.add(frame);
    window.__UCAN_INTERACTIVE_SKY__ = {
      version:VERSION,
      build:BUILD,
      select:selectEntry,
      refresh:reconcile,
      open:() => { state.panel?.classList.add('open'); state.panel?.setAttribute('aria-hidden', 'false'); },
      getObjects:() => [...state.entries.values()].map(entry => ({ ...entry })),
      getState:() => ({ enabled:state.enabled, onTerrace:onTerrace(), selected:state.selected?.name || null, objects:state.entries.size, refreshes:state.refreshes })
    };
    updateAudit();
    console.info('[UCAN V287] Cielo optimizado de la terraza instalado.');
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const camera = window.__UCAN_API__?.getCamera?.();
    if (scene && camera) return init(scene, camera);
    if (attempt < 160) window.setTimeout(() => boot(attempt + 1), 100);
  }

  boot();
})();
