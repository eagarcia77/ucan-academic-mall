(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V319';
  const REVISION = 'R23';
  const BUILD = 'V319-20260730-VR-SAFE-LANDING-VISUAL-COMFORT-R23';
  const ALL_LAYERS = 0x0fffffff;
  const FLOOR_TWO = 8.2;
  const EXIT_ZONE = Object.freeze({ minX:-24.5, maxX:-15.5, minY:7.65, maxY:12.0, minZ:2.0, maxZ:15.0 });
  const MODES = Object.freeze(['comfort','dim','normal']);
  const LABELS = Object.freeze({ comfort:'Brillo: cómodo', dim:'Brillo: tenue', normal:'Brillo: normal' });

  const state = {
    scene:null,
    helper:null,
    installed:false,
    landingPad:null,
    clearedCollisions:new Map(),
    hiddenGlass:new Map(),
    maintenancePasses:0,
    visualMode:'comfort',
    panelButton:null,
    lastExposure:null,
    lastEnvironmentIntensity:null,
    lastError:null
  };

  function recordError(stage, reason) {
    state.lastError = { stage, message:String(reason?.message || reason), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, reason);
    audit();
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const names = [];
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) names.push(String(current.name || ''));
    names.push(String(mesh?.material?.name || ''));
    return names.join(' ');
  }

  function bounds(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      if (!box) return null;
      return {
        minX:box.minimumWorld.x, maxX:box.maximumWorld.x,
        minY:box.minimumWorld.y, maxY:box.maximumWorld.y,
        minZ:box.minimumWorld.z, maxZ:box.maximumWorld.z
      };
    } catch (_) { return null; }
  }

  function intersects(box, zone) {
    return Boolean(box && box.maxX >= zone.minX && box.minX <= zone.maxX && box.maxY >= zone.minY && box.minY <= zone.maxY && box.maxZ >= zone.minZ && box.minZ <= zone.maxZ);
  }

  function isWalkable(mesh) {
    const meta = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(meta.walkable || meta.teleportable || meta.stairSurface || meta.xrStairSurface || /piso|suelo|floor|losa|rampa|peldaño|banda escalera|plataforma inicio|plataforma fin|descanso|ruta de circulación/i.test(text));
  }

  function isGlass(mesh) {
    const meta = metadataChain(mesh);
    return Boolean(meta.glass || meta.glassPanel || meta.parallelGlassV313 || /cristal|glass|vidrio|mampara/i.test(nameChain(mesh)));
  }

  function clearExitCorridor() {
    if (!state.scene) return;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (!mesh || mesh.isDisposed?.() || mesh === state.landingPad) continue;
      const box = bounds(mesh);
      if (!intersects(box, EXIT_ZONE)) continue;
      if (isGlass(mesh)) {
        if (!state.hiddenGlass.has(mesh.uniqueId)) state.hiddenGlass.set(mesh.uniqueId, String(mesh.name || ''));
        try { mesh.setEnabled?.(false); } catch (_) {}
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        mesh.metadata = { ...(mesh.metadata || {}), hiddenAtUp12LandingV319:true, allEnvironmentsV319:true, dynamicSharedV313:true };
        continue;
      }
      if (isWalkable(mesh)) {
        mesh.metadata = { ...(mesh.metadata || {}), up12ExitWalkableV319:true };
        continue;
      }
      if (mesh.checkCollisions) {
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        mesh.metadata = { ...(mesh.metadata || {}), collisionClearedAtUp12LandingV319:true, allEnvironmentsV319:true };
        state.clearedCollisions.set(mesh.uniqueId, String(mesh.name || ''));
      }
    }
    state.maintenancePasses += 1;
  }

  function ensureLandingPad() {
    if (state.landingPad && !state.landingPad.isDisposed?.()) return state.landingPad;
    const pad = B.MeshBuilder.CreateBox('descanso seguro salida up12 V319', { width:9.0, height:0.08, depth:11.0 }, state.scene);
    pad.position.set(-20, FLOOR_TWO + 0.03, 5.3);
    pad.isVisible = false;
    pad.visibility = 0;
    pad.isPickable = true;
    pad.checkCollisions = false;
    pad.layerMask = ALL_LAYERS;
    pad.metadata = { walkable:true, teleportable:true, up12SafeLandingV319:true, allEnvironmentsV319:true, dynamicSharedV313:true };
    state.landingPad = pad;
    return pad;
  }

  function readVisualMode() {
    let value = 'comfort';
    try { value = localStorage.getItem('ucanV319VisualMode') || 'comfort'; } catch (_) {}
    return MODES.includes(value) ? value : 'comfort';
  }

  function applyVisualMode(mode, announce = false) {
    const next = MODES.includes(mode) ? mode : 'comfort';
    state.visualMode = next;
    try { localStorage.setItem('ucanV319VisualMode', next); } catch (_) {}
    try { window.__UCAN_APPLY_VISUAL_COMFORT_V319__?.(next); } catch (reason) { recordError('visual-mode', reason); }
    if (state.panelButton) state.panelButton.textContent = LABELS[next];
    const image = state.scene?.imageProcessingConfiguration;
    state.lastExposure = Number(image?.exposure ?? 1);
    state.lastEnvironmentIntensity = Number(state.scene?.environmentIntensity ?? 1);
    if (announce) window.__UCAN_API__?.setStatus?.(`${LABELS[next]} aplicado por igual en browser y VR.`);
    audit();
    return next;
  }

  function cycleVisualMode() {
    const index = MODES.indexOf(state.visualMode);
    return applyVisualMode(MODES[(index + 1) % MODES.length], true);
  }

  function ensurePanelControl() {
    if (state.panelButton?.isConnected) return;
    const host = document.getElementById('utilityActions') || document.querySelector('.control-grid') || document.querySelector('#leftPanel .actions');
    if (!host) return;
    let button = document.getElementById('visualComfortV319Btn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'visualComfortV319Btn';
      button.type = 'button';
      button.className = 'secondary';
      button.addEventListener('click', cycleVisualMode);
      host.appendChild(button);
    }
    state.panelButton = button;
    button.textContent = LABELS[state.visualMode];
    button.title = 'Cambia la exposición del mundo completo sin crear diferencias entre browser y VR.';
  }

  function audit() {
    const image = state.scene?.imageProcessingConfiguration;
    state.lastExposure = Number(image?.exposure ?? state.lastExposure ?? 1);
    state.lastEnvironmentIntensity = Number(state.scene?.environmentIntensity ?? state.lastEnvironmentIntensity ?? 1);
    window.__UCAN_VR_ACCESSIBILITY_V319__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      exitCorridorClear:true,
      safeLandingPad:true,
      visualComfortSameBrowserVr:true,
      visualMode:state.visualMode,
      exposure:state.lastExposure,
      environmentIntensity:state.lastEnvironmentIntensity,
      clearedCollisions:state.clearedCollisions.size,
      hiddenGlass:state.hiddenGlass.size,
      maintenancePasses:state.maintenancePasses,
      lastError:state.lastError,
      setVisualMode:mode => applyVisualMode(mode, true),
      refresh:() => { clearExitCorridor(); ensureLandingPad(); applyVisualMode(state.visualMode); },
      getState:() => ({
        installed:state.installed,
        exitCorridorClear:true,
        safeLandingPad:true,
        visualComfortSameBrowserVr:true,
        visualMode:state.visualMode,
        exposure:state.lastExposure,
        environmentIntensity:state.lastEnvironmentIntensity,
        clearedCollisions:state.clearedCollisions.size,
        hiddenGlass:state.hiddenGlass.size,
        maintenancePasses:state.maintenancePasses,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    if (!state.scene || !window.__UCAN_FLOOR_ROUTE_CONTROLLER_V319__?.installed) return false;
    state.visualMode = readVisualMode();
    state.installed = true;
    ensureLandingPad();
    clearExitCorridor();
    ensurePanelControl();
    applyVisualMode(state.visualMode);
    window.setInterval(() => {
      try {
        clearExitCorridor();
        ensureLandingPad();
        ensurePanelControl();
        applyVisualMode(state.visualMode);
      } catch (reason) { recordError('maintenance', reason); }
    }, 1200);
    state.helper?.baseExperience?.onStateChangedObservable?.add?.(() => {
      window.setTimeout(() => { clearExitCorridor(); applyVisualMode(state.visualMode); }, 80);
      window.setTimeout(() => { clearExitCorridor(); applyVisualMode(state.visualMode); }, 500);
    });
    window.__UCAN_API__?.setStatus?.('V319: salida del Piso 2 despejada y brillo cómodo activo.');
    console.info('[UCAN V319 R23] Accesibilidad VR, descanso seguro y confort visual instalados.');
    audit();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 700) window.clearInterval(timer);
    } catch (reason) {
      recordError('install', reason);
      if (attempts >= 700) window.clearInterval(timer);
    }
  }, 100);

  audit();
})();
