(() => {
  'use strict';

  const VERSION = 'V288';
  const BUILD = 'V288-20260720-COMPACT-CELESTIAL-WINDOW';
  const B = window.BABYLON;
  if (!B) return;

  const state = {
    scene:null,
    root:null,
    panel:null,
    panelTexture:null,
    closeButton:null,
    current:null,
    visible:false,
    initialized:false,
    lastFrame:0,
    selections:0,
    closes:0,
    legacyPlaneDisabled:false,
    wrappedApi:false
  };

  function inXR() {
    try { return window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.()?.inXR === true; }
    catch (_) { return false; }
  }

  function currentCamera() {
    return state.scene?.activeCamera || window.__UCAN_API__?.getCamera?.() || null;
  }

  function allEntries() {
    try { return window.__UCAN_INTERACTIVE_SKY__?.getObjects?.() || []; }
    catch (_) { return []; }
  }

  function entryById(id) {
    return allEntries().find(entry => entry.id === id) || null;
  }

  function disableLegacyLargePlane() {
    const legacy = state.scene?.getMeshByName?.('panel flotante cielo optimizado V287');
    if (legacy) {
      legacy.setEnabled(false);
      legacy.isPickable = false;
      state.legacyPlaneDisabled = true;
    }
  }

  function installCompactDesktopStyles() {
    if (document.getElementById('ucanCelestialWindowV288Styles')) return;
    const style = document.createElement('style');
    style.id = 'ucanCelestialWindowV288Styles';
    style.textContent = `
      #ucanSkyExplorerV287{
        width:min(340px,calc(100vw - 24px))!important;
        top:auto!important;
        right:12px!important;
        bottom:12px!important;
        max-height:min(440px,62vh)!important;
        border-radius:14px!important;
        box-shadow:0 16px 48px rgba(0,0,0,.48)!important;
      }
      #ucanSkyExplorerV287 header{padding:9px 11px!important;position:sticky;top:0;background:#071426;z-index:2}
      #ucanSkyExplorerV287 h2{font-size:16px!important;line-height:1.2!important}
      #ucanSkyExplorerV287 .sky-controls{padding:9px 11px!important}
      #ucanSkyExplorerV287 select{padding:8px!important;font-size:13px!important}
      #ucanSkyBodyV287{padding:0 11px 11px!important;font-size:13px!important;line-height:1.38!important}
      #ucanSkyBodyV287 p{margin:7px 0!important}
      #ucanSkyCloseV287{min-width:36px!important;width:36px!important;height:34px!important;padding:4px!important;font-size:20px!important;line-height:1!important}
      body.ucan-xr-celestial-window #ucanSkyExplorerV287{display:none!important}
      @media(max-width:600px){#ucanSkyExplorerV287{left:8px!important;right:8px!important;width:auto!important;bottom:8px!important;max-height:48vh!important}}
    `;
    document.head.appendChild(style);
  }

  function wrapText(ctx, text, x, startY, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      } else {
        line = candidate;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    lines.forEach((item, index) => ctx.fillText(item, x, startY + index * lineHeight));
  }

  function drawPanel(entry) {
    const texture = state.panelTexture;
    if (!texture || !entry) return;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 768, 480);

    const gradient = ctx.createLinearGradient(0, 0, 768, 480);
    gradient.addColorStop(0, '#061426');
    gradient.addColorStop(1, '#124657');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 768, 480);

    ctx.fillStyle = entry.color || '#fed141';
    ctx.fillRect(0, 0, 768, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Segoe UI, Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(String(entry.name || 'Objeto celeste').slice(0, 29), 34, 32);

    ctx.fillStyle = '#9edbe6';
    ctx.font = 'bold 23px Segoe UI, Arial';
    ctx.fillText(String(entry.category || entry.kind || 'Objeto celeste'), 35, 88);

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Segoe UI, Arial';
    let y = 140;
    const facts = [];
    if (entry.constellation) facts.push(`Constelación: ${entry.constellation}`);
    if (Number.isFinite(Number(entry.actualAltitude ?? entry.altitude))) facts.push(`Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°`);
    if (Number.isFinite(Number(entry.azimuth))) facts.push(`Azimut: ${Number(entry.azimuth).toFixed(1)}°`);
    if (entry.phase) facts.push(String(entry.phase));
    if (entry.belowHorizon) facts.push('Actualmente está bajo el horizonte.');
    facts.slice(0, 4).forEach(fact => { ctx.fillText(`• ${fact}`, 38, y); y += 34; });

    ctx.fillStyle = '#dff8ff';
    ctx.font = '21px Segoe UI, Arial';
    wrapText(ctx, entry.summary || 'Información astronómica disponible.', 38, Math.max(y + 8, 286), 690, 29, 5);

    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = '18px Segoe UI, Arial';
    ctx.fillText('Seleccione × para cerrar esta ventana.', 38, 444);
    texture.update(false);
  }

  function createTextButtonTexture(scene) {
    const texture = new B.DynamicTexture('textura cerrar ventana celeste V288', { width:128, height:128 }, scene, false);
    texture.hasAlpha = true;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#b42318';
    ctx.beginPath();
    ctx.arc(64, 64, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 68px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×', 64, 58);
    texture.update(false);
    return texture;
  }

  function create3DWindow(scene) {
    const root = new B.TransformNode('Ventana celeste compacta V288', scene);

    const panelTexture = new B.DynamicTexture('contenido ventana celeste V288', { width:768, height:480 }, scene, false);
    panelTexture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const panelMaterial = new B.StandardMaterial('material ventana celeste V288', scene);
    panelMaterial.diffuseTexture = panelTexture;
    panelMaterial.emissiveTexture = panelTexture;
    panelMaterial.disableLighting = true;
    panelMaterial.backFaceCulling = false;

    const panel = B.MeshBuilder.CreatePlane('ventana información celeste V288', {
      width:2.85,
      height:1.78,
      sideOrientation:B.Mesh.DOUBLESIDE
    }, scene);
    panel.parent = root;
    panel.material = panelMaterial;
    panel.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    panel.renderingGroupId = 3;
    panel.isPickable = false;
    panel.checkCollisions = false;

    const closeTexture = createTextButtonTexture(scene);
    const closeMaterial = new B.StandardMaterial('material cerrar ventana celeste V288', scene);
    closeMaterial.diffuseTexture = closeTexture;
    closeMaterial.emissiveTexture = closeTexture;
    closeMaterial.opacityTexture = closeTexture;
    closeMaterial.disableLighting = true;
    closeMaterial.backFaceCulling = false;

    const closeButton = B.MeshBuilder.CreatePlane('cerrar ventana celeste V288', {
      width:0.36,
      height:0.36,
      sideOrientation:B.Mesh.DOUBLESIDE
    }, scene);
    closeButton.parent = root;
    closeButton.position.set(1.25, 0.68, -0.025);
    closeButton.material = closeMaterial;
    closeButton.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    closeButton.renderingGroupId = 4;
    closeButton.isPickable = true;
    closeButton.checkCollisions = false;
    closeButton.metadata = { celestialWindowCloseV288:true };

    root.setEnabled(false);
    state.root = root;
    state.panel = panel;
    state.panelTexture = panelTexture;
    state.closeButton = closeButton;
  }

  function place3DWindow() {
    const camera = currentCamera();
    if (!camera || !state.root) return;
    const origin = camera.globalPosition?.clone?.() || camera.position?.clone?.();
    if (!origin) return;
    let forward;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward || forward.lengthSquared() < 0.001) forward = new B.Vector3(0, 0, 1);
    forward.normalize();
    const target = origin.add(forward.scale(3.7));
    target.y = origin.y - 0.06;
    state.root.position.copyFrom(target);
  }

  function close3DWindow() {
    if (!state.visible) return;
    state.visible = false;
    state.root?.setEnabled(false);
    state.closes += 1;
    updateAudit();
  }

  function closeDesktopWindow() {
    const panel = document.getElementById('ucanSkyExplorerV287');
    panel?.classList.remove('open');
    panel?.setAttribute('aria-hidden', 'true');
  }

  function showDesktopWindow(entry) {
    close3DWindow();
    document.body.classList.remove('ucan-xr-celestial-window');
    const panel = document.getElementById('ucanSkyExplorerV287');
    const title = document.getElementById('ucanSkyTitleV287');
    const body = document.getElementById('ucanSkyBodyV287');
    if (title) title.textContent = entry.name || 'Objeto celeste';
    if (body) {
      body.textContent = '';
      const type = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = entry.category || entry.kind || 'Objeto celeste';
      type.appendChild(strong);
      const summary = document.createElement('p');
      summary.textContent = entry.summary || 'Información astronómica disponible.';
      const details = document.createElement('p');
      const parts = [];
      if (entry.constellation) parts.push(`Constelación: ${entry.constellation}`);
      if (Number.isFinite(Number(entry.actualAltitude ?? entry.altitude))) parts.push(`Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°`);
      if (Number.isFinite(Number(entry.azimuth))) parts.push(`Azimut: ${Number(entry.azimuth).toFixed(1)}°`);
      details.textContent = parts.join(' · ');
      body.append(type, summary);
      if (parts.length) body.appendChild(details);
    }
    panel?.classList.add('open');
    panel?.setAttribute('aria-hidden', 'false');
  }

  function show3DWindow(entry) {
    closeDesktopWindow();
    document.body.classList.add('ucan-xr-celestial-window');
    state.current = entry;
    drawPanel(entry);
    place3DWindow();
    state.root?.setEnabled(true);
    state.visible = true;
    updateAudit();
  }

  function present(entry) {
    if (!entry) return;
    disableLegacyLargePlane();
    state.current = entry;
    state.selections += 1;
    if (inXR()) show3DWindow(entry);
    else showDesktopWindow(entry);
    updateAudit();
  }

  function wrapSkyApi() {
    const sky = window.__UCAN_INTERACTIVE_SKY__;
    if (!sky || state.wrappedApi) return;
    const originalSelect = typeof sky.select === 'function' ? sky.select.bind(sky) : null;
    if (originalSelect) {
      sky.select = id => {
        const result = originalSelect(id);
        window.setTimeout(() => present(entryById(id)), 0);
        return result;
      };
    }
    state.wrappedApi = true;
  }

  function updateAudit() {
    window.__UCAN_CELESTIAL_WINDOW_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:state.initialized,
      desktopCompactWindow:true,
      xrCompact3DWindow:true,
      closableInDesktop:true,
      closableInXR:true,
      legacyLargePlaneDisabled:state.legacyPlaneDisabled,
      widthMeters:2.85,
      heightMeters:1.78,
      selections:state.selections,
      closes:state.closes,
      visible:state.visible,
      current:state.current?.name || null,
      inXR:inXR()
    };
    window.__UCAN_CELESTIAL_WINDOW__ = {
      version:VERSION,
      build:BUILD,
      show:id => present(entryById(id)),
      close:() => { close3DWindow(); closeDesktopWindow(); },
      recenter:() => place3DWindow(),
      getState:() => ({ ...window.__UCAN_CELESTIAL_WINDOW_AUDIT__ })
    };
  }

  function frame() {
    const now = performance.now();
    if (now - state.lastFrame < 120) return;
    state.lastFrame = now;
    disableLegacyLargePlane();
    wrapSkyApi();
    if (inXR()) {
      document.body.classList.add('ucan-xr-celestial-window');
      if (document.getElementById('ucanSkyExplorerV287')?.classList.contains('open')) closeDesktopWindow();
    } else {
      document.body.classList.remove('ucan-xr-celestial-window');
      if (state.visible) close3DWindow();
    }
    updateAudit();
  }

  function init(scene) {
    if (state.initialized) return;
    state.initialized = true;
    state.scene = scene;
    installCompactDesktopStyles();
    create3DWindow(scene);
    disableLegacyLargePlane();
    wrapSkyApi();

    scene.onPointerObservable.add(pointerInfo => {
      const mesh = pointerInfo?.pickInfo?.pickedMesh;
      if (!pointerInfo?.pickInfo?.hit || !mesh) return;
      if (mesh.metadata?.celestialWindowCloseV288) {
        close3DWindow();
        return;
      }
      const entry = mesh.metadata?.celestialData || entryById(mesh.metadata?.celestialId);
      if (entry) present(entry);
    }, B.PointerEventTypes.POINTERPICK);

    document.addEventListener('change', event => {
      if (event.target?.id === 'ucanSkySelectV287') {
        window.setTimeout(() => present(entryById(event.target.value)), 0);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        close3DWindow();
        closeDesktopWindow();
      }
    });

    scene.onBeforeRenderObservable.add(frame);
    updateAudit();
    console.info('[UCAN V288] Ventana compacta y cerrable para objetos celestes instalada.');
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    if (scene && window.__UCAN_INTERACTIVE_SKY__) return init(scene);
    if (attempt < 180) window.setTimeout(() => boot(attempt + 1), 100);
  }

  boot();
})();
